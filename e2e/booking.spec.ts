import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Locator, type Page } from '@playwright/test';

const panel = (page: Page) => page.locator('.panel');
// Controls used before the application has started are outside what the site supports, and
// data-smooth cannot tell: the head's script sets it before Angular runs.
async function open(page: Page, path: string) {
  const response = await page.goto(path);
  await expect(page.locator('html')).toHaveAttribute('data-started', '');
  return response;
}
// The shown season, and not one leaving after a change, and its shown month.
const season = (page: Page) => page.locator('.panel-season:visible:not([data-leaving])');
const month = (page: Page) => season(page).locator('.month[data-current]:not([data-leaving])');
const chosen = (page: Page) => month(page).locator('[aria-selected=true]');
const monthName = (page: Page) => month(page).locator('.month-name');

const next = (page: Page) => season(page).getByRole('button', { name: /Nächster|Next|successivo/ });
// German money, as the page writes it: "€ 1.669,50", "€ 49".
const amount = (text: string) => Number(text.replace(/[^\d,]/g, '').replace(',', '.'));
const euro = (value: number) => {
  const digits = Number.isInteger(value) ? 0 : 2;
  return new Intl.NumberFormat('de-AT', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(value);
};

// The server dates the seasons by today, and the season shown by date may have no week left.
// The simulator prices every season ahead of today, so the next season always has free weeks:
// tests that need them open the page in it.
async function openNext(page: Page, path: string) {
  await open(page, path);
  const later = await page.locator('.panel-season').last().getAttribute('data-for');
  if ((await page.locator('html').getAttribute('data-season')) !== later)
    await open(page, `${path}${path.includes('?') ? '&' : '?'}season=${later}`);
}

// The next month, once shown: until then a count or a click still finds the month before, whose
// cells a click would wait on after they have gone.
async function toNext(page: Page) {
  const shown = await monthName(page).innerText();
  await next(page).click();
  await expect(monthName(page)).not.toHaveText(shown);
}

// The first month of the shown season with a free week of its own, and that week's cell.
async function firstFree(page: Page) {
  for (let i = 0; i < 12; i++) {
    const free = month(page).locator('.week:not(.full, .outside) [role=gridcell]');
    if (await free.count()) return free.first();
    await toNext(page);
  }
  throw new Error('no free week in the season');
}

async function pickCount(page: Page, id: 'adults' | 'children', value: number) {
  await page.locator(`#${id}`).click();
  await page.getByRole('option', { name: String(value), exact: true }).click();
  await expect(page.locator(`#${id}`)).toHaveText(String(value));
}

const options = async (page: Page, id: 'adults' | 'children') => {
  await page.locator(`#${id}`).click();
  await expect(page.getByRole('listbox')).toBeVisible();
  const names = await page.getByRole('option').allInnerTexts();
  await page.keyboard.press('Escape');
  return names.map((name) => Number(name.trim()));
};

test(
  'a week and the guests make the total, and the button takes them on to booking',
  { tag: '@any-engine' },
  async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await openNext(page, '/de/wohnungen/laerche');
    await expect(
      panel(page).getByRole('button', { name: 'Erst eine Woche wählen' }),
    ).toBeDisabled();
    await expect(panel(page).locator('.from:visible')).toHaveText(/ab €\s[\d.,]+ pro Woche/);
    const week = await firstFree(page);
    const price = amount(await week.innerText());
    await week.click();
    await expect(week).toHaveAttribute('aria-selected', 'true');
    const total = panel(page).locator('.outcome:visible .total');
    await expect(total.locator('div').nth(1)).toHaveText(
      /Ortstaxe: 2 Erwachsene × 7 Nächte × €\s3,50\s*€\s49/,
    );
    await expect(total.locator('.sum dd')).toHaveText(euro(price + 49));

    await pickCount(page, 'adults', 3);
    await pickCount(page, 'children', 1);
    await expect(total.locator('div').nth(1)).toContainText('3 Erwachsene × 7 Nächte');
    await expect(total.locator('.sum dd')).toHaveText(euro(price + 73.5));
    // The address keeps the choice, so a reload shows it again.
    await expect(page).toHaveURL(/adults=3&children=1/);
    const kept = new URL(page.url()).searchParams;
    expect(kept.get('arrival')).toMatch(/^\d{4}-\d\d-\d\d$/);
    expect(kept.get('departure')).toMatch(/^\d{4}-\d\d-\d\d$/);
    expect(kept.get('season')).toBe(await page.locator('html').getAttribute('data-season'));
    // So does the other language's link.
    const english = new URL(
      (await page.locator('link[rel=alternate][hreflang=en-GB]').getAttribute('href'))!,
      'http://localhost',
    );
    expect(english.search).toBe(new URL(page.url()).search);
    await page.reload();
    await expect(page.locator('#adults')).toHaveText('3');
    await expect(page.locator('#children')).toHaveText('1');
    await expect(chosen(page)).toHaveCount(1);

    const link = panel(page).getByRole('link', { name: 'Weiter zur Buchung' });
    const href = new URL((await link.getAttribute('href'))!, 'http://localhost');
    expect(href.pathname).toBe('/de/wohnungen/laerche/buchen');
    expect([...href.searchParams.keys()]).toEqual(['arrival', 'departure', 'adults', 'children']);
    expect(href.searchParams.get('adults')).toBe('3');
    expect(href.searchParams.get('children')).toBe('1');
    const days =
      (Date.parse(href.searchParams.get('departure')!) -
        Date.parse(href.searchParams.get('arrival')!)) /
      864e5;
    expect(days).toBe(7);
  },
);

test(
  'the counts offer what one of the apartments takes, and more adults make room by fewer children',
  { tag: '@any-engine' },
  async ({ page }) => {
    // Lärche's panel offers every apartment's range, the largest one's total of six (Ahorn): up
    // to six adults, and beside two adults up to four children.
    await openNext(page, '/de/wohnungen/laerche');
    expect(await options(page, 'adults')).toEqual([1, 2, 3, 4, 5, 6]);
    expect(await options(page, 'children')).toEqual([0, 1, 2, 3, 4]);
    await pickCount(page, 'adults', 1);
    await pickCount(page, 'children', 4);
    await pickCount(page, 'adults', 4);
    await expect(page.locator('#children')).toHaveText('2');
    expect(await options(page, 'children')).toEqual([0, 1, 2]);
    // Both counts are described by the note an asterisk points to, which a screen reader skips.
    await expect(page.locator('#children')).toHaveAccessibleName('Kinder');
    for (const id of ['adults', 'children'])
      await expect(page.locator(`#${id}`)).toHaveAccessibleDescription(/^Kinder bis 14 Jahre\./);

    // Zirbe's room asks Beds24 for no children: they count, and are taxed, as adults. The second
    // site's Vista is that room, in a season of a whole year that always has free weeks.
    await open(page, 'http://localhost:4002/it/appartamenti/vista');
    await pickCount(page, 'adults', 1);
    await pickCount(page, 'children', 1);
    await (await firstFree(page)).click();
    await expect(panel(page).locator('.outcome:visible .total')).toContainText(
      'Tassa di soggiorno: 2 ospiti × 7 notti',
    );
  },
);

test(
  'an address over the limits opens at them, and an arrival from the list is chosen',
  { tag: '@any-engine' },
  async ({ page }) => {
    // What the largest apartment takes, six: six adults and no child, or one adult and five.
    await open(page, '/de/wohnungen/laerche?adults=9&children=9');
    await expect(page.locator('#adults')).toHaveText('6');
    await expect(page.locator('#children')).toHaveText('0');
    await expect(page).toHaveURL(/\?adults=6$/);
    await open(page, '/de/wohnungen/laerche?adults=0&children=9');
    await expect(page.locator('#adults')).toHaveText('1');
    await expect(page.locator('#children')).toHaveText('5');

    // A week in a later month, as the free-weeks list links it.
    await openNext(page, '/de/wohnungen/laerche');
    await toNext(page);
    const week = await firstFree(page);
    const name = await monthName(page).innerText();
    await week.click();
    const url = new URL(page.url());
    const stay = ['arrival', 'departure', 'season'].map(
      (name) => `${name}=${url.searchParams.get(name)}`,
    );
    await open(page, `/de/wohnungen/laerche?${stay.join('&')}`);
    await expect(monthName(page)).toHaveText(name);
    await expect(chosen(page)).toHaveCount(1);
    await expect(panel(page).getByRole('link', { name: 'Weiter zur Buchung' })).toBeVisible();
    // A week that is not free is not chosen.
    await open(page, '/de/wohnungen/laerche?arrival=2020-01-04&departure=2020-01-11');
    await expect(panel(page).locator('[aria-selected=true]')).toHaveCount(0);
  },
);

test('the calendar shows the list’s month and week, at the same height', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await openNext(page, '/de/wohnungen/laerche');
  const week = await firstFree(page);
  const name = await monthName(page).innerText();
  const height = await month(page)
    .locator('..')
    .evaluate((box) => box.offsetHeight);
  await week.click();
  const arrival = new URL(page.url()).searchParams.get('arrival')!;
  await page.locator('.views').getByTitle('Kalender').click();
  await expect(monthName(page)).toHaveText(name);
  expect(
    await month(page)
      .locator('..')
      .evaluate((box) => box.offsetHeight),
  ).toBe(height);
  const day = Number(arrival.slice(8));
  const start = chosen(page);
  await expect(start).toHaveText(String(day));
  // The band runs from the arrival to the departure, its ends under their circles.
  await expect(month(page).locator('.band-start')).toHaveCount(1);
  expect(await month(page).locator('.in-band').count()).toBeGreaterThanOrEqual(
    Math.min(6, new Date(Date.UTC(2000, Number(arrival.slice(5, 7)), 0)).getUTCDate() - day),
  );
  // A free week's first day is named with its stay and price, another day with its date.
  await expect(start).toHaveAttribute('aria-label', /^Samstag,\s.+\s–\sSamstag,\s.+, €\s/);
  await expect(month(page).locator('.day:not(:has(.start))').first()).toHaveAttribute(
    'aria-label',
    /^\d+\. \p{L}+(, belegt)?$/u,
  );
  // Six weeks in both views, the days of the months around half seen.
  await expect(month(page).locator('[role=row]')).toHaveCount(7);
  await page.locator('.views').getByTitle('Liste').click();
  await expect(month(page).locator('.week [aria-selected=true]')).toHaveCount(1);
});

test('the months page by their buttons, slide in from their side and keep the focus', async ({
  page,
}) => {
  await openNext(page, '/en/apartments/laerche');
  const back = page
    .locator('.panel-season:visible')
    .getByRole('button', { name: 'Previous month' });
  await expect(back).toBeDisabled();
  const first = await monthName(page).innerText();
  const moves = () =>
    page.evaluate(() =>
      document
        .getAnimations()
        .map((one) => (one.effect as KeyframeEffect).getKeyframes()[0]['translate'])
        .filter(Boolean),
    );
  // The guests' place in the panel, every frame of a move in each view.
  const below = () =>
    page.evaluate(
      () =>
        new Promise<number[]>((done) => {
          const guests = document.querySelector('.guests')!;
          const card = document.querySelector('.panel')!;
          const tops = new Set<number>();
          const frame = (left: number) => {
            tops.add(
              Math.round(guests.getBoundingClientRect().top - card.getBoundingClientRect().top),
            );
            if (left) requestAnimationFrame(() => frame(left - 1));
            else done([...tops]);
          };
          frame(30);
        }),
    );
  const width = await panel(page).evaluate((card) => card.offsetWidth);
  const moved = below();
  await next(page).click();
  // The new month comes in from beyond the card's edge.
  await expect.poll(moves).toEqual(['0px', `${width}px`]);
  expect(await moved).toHaveLength(1);
  await expect(monthName(page)).not.toHaveText(first);
  await page.locator('.views').getByTitle('Calendar').click();
  const paged = below();
  await back.click();
  expect(await paged).toHaveLength(1);
  await next(page).click();
  await expect(back).toBeEnabled();
  // By keyboard to the season's last month: there the focus moves to the other button.
  await next(page).focus();
  // Each press waits for its month: until then the button still shows the month before.
  for (let i = 0; i < 12 && (await next(page).isEnabled()); i++) {
    const shown = await monthName(page).innerText();
    await page.keyboard.press('Enter');
    await expect(monthName(page)).not.toHaveText(shown);
  }
  await expect(next(page)).toBeDisabled();
  await expect(back).toBeFocused();
});

test('the week, the view and the guests can be chosen by keyboard alone', async ({ page }) => {
  await openNext(page, '/de/wohnungen/laerche');
  await firstFree(page);
  // The view: two radios, one tab stop.
  await page.getByRole('radio', { name: 'Liste' }).focus();
  await page.keyboard.press('ArrowRight');
  await expect(page.getByRole('radio', { name: 'Kalender' })).toBeChecked();
  await expect(month(page).locator('.calendar')).toBeVisible();
  await page.keyboard.press('ArrowLeft');
  await expect(month(page).locator('.week').first()).toBeVisible();
  // The month's weeks are one tab stop after the month's buttons; Space and Enter choose a
  // week and, on the chosen one, choose none. A booked week is passed by.
  const focused = month(page).locator('[role=gridcell]:focus');
  for (let i = 0; i < 6 && !(await focused.count()); i++) await page.keyboard.press('Tab');
  await expect(focused).toHaveCount(1);
  const passed = () => page.evaluate(() => document.activeElement!.closest('.full, .outside'));
  // The grid moves the focus a frame after the key, so each step waits for it.
  for (let i = 0; i < 6 && (await passed()); i++) {
    const from = await focused.getAttribute('data-date');
    await page.keyboard.press('ArrowDown');
    await expect(focused).not.toHaveAttribute('data-date', from!);
  }
  await page.keyboard.press('Space');
  await expect(focused).toHaveAttribute('aria-selected', 'true');
  await page.keyboard.press('Enter');
  await expect(chosen(page)).toHaveCount(0);
  await expect(page).not.toHaveURL(/arrival=/);
  await page.keyboard.press('Enter');
  await expect(focused).toHaveAttribute('aria-selected', 'true');
  await expect(panel(page).getByRole('link', { name: 'Weiter zur Buchung' })).toBeVisible();
  // Booked weeks and plain days can be reached, but Tab enters a month again at its chosen
  // week: in the calendar, where the chosen day always has another beside it.
  const pick = await focused.getAttribute('data-date');
  await page.getByRole('radio', { name: 'Liste' }).focus();
  await page.keyboard.press('ArrowRight');
  // Tab only once the calendar is there, or it would go through the list's cells.
  await expect(month(page).locator('.calendar')).toBeVisible();
  for (let i = 0; i < 6 && !(await focused.count()); i++) await page.keyboard.press('Tab');
  await expect(focused).toHaveAttribute('data-date', pick!);
  await page.keyboard.press('ArrowLeft');
  await expect(focused).not.toHaveAttribute('data-date', pick!);
  await page.keyboard.press('Shift+Tab');
  await page.keyboard.press('Tab');
  await expect(focused).toHaveAttribute('data-date', pick!);
  // Page Down shows the next month, at the same place.
  const first = await monthName(page).innerText();
  await page.keyboard.press('PageDown');
  await expect(monthName(page)).not.toHaveText(first);
  await expect(focused).toHaveCount(1);
  // The counts: Enter opens, the arrows move, Enter chooses.
  await page.locator('#adults').focus();
  await page.keyboard.press('Enter');
  // The list shows at once and marks its current option a render later.
  await expect(page.locator('#adults')).toHaveAttribute('aria-activedescendant', /./);
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  await expect(page.locator('#adults')).toHaveText('3');
  await expect(page.getByRole('listbox')).toHaveCount(0);
  await expect(page.locator('#adults')).toBeFocused();
});

test('a week or a day of the month before or after chooses its week and shows its month', async ({
  page,
}) => {
  await openNext(page, '/en/apartments/laerche');
  // In the list, the week that ends in the month, from the month before.
  const row = month(page).locator('.week.outside:not(.full)');
  for (let i = 0; i < 12 && !(await row.count()); i++) await toNext(page);
  const arrival = await row.locator('[role=gridcell]').getAttribute('data-date');
  const shown = await monthName(page).innerText();
  await row.locator('[role=gridcell]').click();
  await expect(monthName(page)).not.toHaveText(shown);
  await expect(chosen(page)).toHaveAttribute('data-date', arrival!);
  await expect(page).toHaveURL(new RegExp(`arrival=${arrival}`));
  // In the calendar, a free week's first day in the month after.
  await page.locator('.views').getByTitle('Calendar').click();
  const day = month(page).locator('.day.outside:has(.start)');
  for (let i = 0; i < 12 && !(await day.count()); i++) await toNext(page);
  const start = await day.last().getAttribute('data-date');
  await day.last().click();
  await expect(chosen(page)).toHaveAttribute('data-date', start!);
  await expect(monthName(page)).toHaveText(
    new Intl.DateTimeFormat('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(
      new Date(start!),
    ),
  );
  // A click on the chosen week chooses none.
  await chosen(page).click();
  await expect(chosen(page)).toHaveCount(0);
  await expect(page).not.toHaveURL(/arrival=/);
});

test('a change of language or a reload keeps the view and the month', async ({ page }) => {
  await openNext(page, '/de/wohnungen/laerche');
  // A week chosen, then the calendar and another month shown.
  await (await firstFree(page)).click();
  await page.locator('.views').getByTitle('Kalender').click();
  await expect(page).toHaveURL(/view=calendar/);
  const before = await month(page).getAttribute('data-month');
  await next(page).click();
  await expect(month(page)).not.toHaveAttribute('data-month', before!);
  const shown = await month(page).getAttribute('data-month');
  // From the header's menu on a phone, else from its language control.
  const menu = page.locator('.header-narrow .icon-button');
  const control = (await menu.isVisible()) ? menu : page.locator('[data-language]');
  const box = (await control.boundingBox())!;
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  await page.getByRole('link', { name: 'English' }).click();
  await expect(page).toHaveURL(/\/en\/apartments\/laerche/);
  await expect(page.getByRole('radio', { name: 'Calendar' })).toBeChecked();
  await expect(month(page)).toHaveAttribute('data-month', shown!);
  await expect(panel(page).locator('[aria-selected=true]')).not.toHaveCount(0);
  // A reload shows the calendar from the server on, at the chosen week's month.
  const response = await page.reload();
  expect(await response!.text()).toContain('class="calendar"');
  await expect(page.getByRole('radio', { name: 'Calendar' })).toBeChecked();
});

test(
  'a shared link opens at its week’s season, whatever season the page would show',
  { tag: '@any-engine' },
  async ({ page, browser }) => {
    await open(page, '/de/wohnungen/laerche');
    const other = await page.locator('html').getAttribute('data-season');
    await panel(page).locator('.other-season').click();
    await expect(page.locator('html')).not.toHaveAttribute('data-season', other!);
    const shown = await page.locator('html').getAttribute('data-season');
    await (await firstFree(page)).click();
    await expect(page).toHaveURL(new RegExp(`season=${shown}`));
    // Away from the week's season and back: the address names it again.
    await panel(page).locator('.other-season').click();
    await expect(page).not.toHaveURL(/season=/);
    await panel(page).locator('.other-season').click();
    await expect(page).toHaveURL(new RegExp(`season=${shown}`));
    // Opened afresh, in this language and in the other.
    const english = await page.locator('link[rel=alternate][hreflang=en-GB]').getAttribute('href');
    for (const [link, book] of [
      [page.url(), 'Weiter zur Buchung'],
      [english!, 'Continue to booking'],
    ]) {
      const fresh = await browser.newPage();
      await open(fresh, link);
      await expect(fresh.locator('html')).toHaveAttribute('data-season', shown!);
      await expect(chosen(fresh)).toHaveCount(1);
      await expect(panel(fresh).getByRole('link', { name: book })).toBeVisible();
      await fresh.close();
    }
  },
);

test(
  'a full season, one not open yet and an unreachable Beds24 each say so',
  { tag: '@any-engine' },
  async ({ page }) => {
    // Where Beds24 has prices only up to today, the season shown by date is full and the next one
    // not open yet; neither has a total.
    await open(page, 'http://localhost:4003/en/apartments/laerche');
    await expect(panel(page).locator('.panel-empty:visible')).toHaveText(
      /No week of (Winter \d{4}\/\d\d|Summer \d{4}) is free any more\./,
    );
    await expect(panel(page).locator('.outcome:visible')).toHaveCount(0);
    await panel(page).locator('.other-season').click();
    await expect(season(page).locator('.panel-empty')).toContainText('are not open yet');
    const response = await open(page, 'http://localhost:4001/en/apartments/laerche');
    expect(response!.status()).toBe(503);
    await expect(panel(page)).toContainText('The free weeks cannot be shown just now.');
    await expect(panel(page).locator('button, a, input')).toHaveCount(0);
  },
);

test('the panel’s season button slides the other season in and keeps the guests', async ({
  page,
}) => {
  await open(page, '/de/wohnungen/laerche');
  await pickCount(page, 'adults', 3);
  const button = panel(page).locator('.other-season');
  const before = await page.locator('html').getAttribute('data-season');
  const label = (await button.locator('span:visible').innerText()).trim();
  const moves = () =>
    page.evaluate(() =>
      document
        .getAnimations()
        .map((one) => (one.effect as KeyframeEffect).getKeyframes()[0]['translate'])
        .filter(Boolean),
    );
  await button.focus();
  await page.keyboard.press('Enter');
  await expect.poll(moves).toContainEqual(expect.stringMatching(/^[1-9][\d.]*px/));
  await expect(page.locator('html')).not.toHaveAttribute('data-season', before!);
  const after = await page.locator('html').getAttribute('data-season');
  await expect(panel(page).locator(`#booking-season > [data-for=${after}]`)).toHaveText(label);
  await expect(page.locator('#adults')).toHaveText('3');
  await expect(button).toBeFocused();
});

test('beside the content a panel taller than the window shows its foot', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 640 });
  await open(page, '/de/wohnungen/laerche');
  await page.evaluate(() => scrollTo({ top: 2000, behavior: 'instant' }));
  await expect
    .poll(() => panel(page).evaluate((box) => Math.round(box.getBoundingClientRect().bottom)))
    .toBeLessThanOrEqual(640);
  const left = await page.locator('.apartment-main').boundingBox();
  const right = await panel(page).boundingBox();
  expect(right!.x).toBeGreaterThan(left!.x + left!.width);
});

test('on a phone a bar leads to the panel while it is below the screen, with a week to its total', async ({
  page,
}) => {
  // Low enough that the page scrolls past the panel.
  await page.setViewportSize({ width: 375, height: 560 });
  await openNext(page, '/de/wohnungen/laerche');
  const bar = page.locator('.booking-bar');
  await expect(bar).toBeVisible();
  await expect(bar.locator('output:visible')).toHaveText(/ab €\s[\d.,]+ pro Woche/);
  await bar.getByRole('button', { name: 'Woche wählen' }).click();
  await expect(panel(page).locator('h2')).toBeFocused();
  await expect(bar).toBeHidden();
  await (await firstFree(page)).click();
  await page.evaluate(() => scrollTo(0, 0));
  await expect(bar).toBeVisible();
  // The week's price, without the tax the panel's total adds.
  const price = await chosen(page).innerText();
  await expect(bar.locator('.bar-parts > span:visible').nth(1)).toHaveText(price);
  await bar.getByRole('button', { name: 'Weiter' }).click();
  const book = panel(page).getByRole('link', { name: 'Weiter zur Buchung' });
  await expect(book).toBeFocused();
  await expect(book).toHaveAttribute('href', /^\/de\/wohnungen\/laerche\/buchen\?arrival=/);
  await expect(bar).toBeHidden();
  // The panel's foot, its total and button, at the screen's foot.
  await expect
    .poll(() => panel(page).evaluate((box) => innerHeight - box.getBoundingClientRect().bottom))
    .toBeCloseTo(0, 0);
  // Past the panel the footer's links stay uncovered.
  await page.evaluate(() => scrollTo({ top: document.body.scrollHeight, behavior: 'instant' }));
  expect(await panel(page).evaluate((box) => box.getBoundingClientRect().bottom)).toBeLessThan(0);
  await expect(bar).toBeHidden();
  await page.setViewportSize({ width: 1280, height: 800 });
  await expect(bar).toBeHidden();
  // A season with no week to choose has no bar: the full one of a site with prices up to today.
  await page.setViewportSize({ width: 375, height: 560 });
  await open(page, 'http://localhost:4003/de/wohnungen/laerche');
  await page.evaluate(() => scrollTo({ top: 0, behavior: 'instant' }));
  await expect(bar).toBeHidden();
});

test('a week in the address is shown at the first paint, before the application starts', async ({
  page,
  browser,
}) => {
  await openNext(page, '/de/wohnungen/laerche');
  await (await firstFree(page)).click();
  const stay = await chosen(page).locator('xpath=..').locator('[role=rowheader]').innerText();
  // On a tall tablet the panel is in view already, and the bar would cover it.
  for (const [width, height, barShown] of [
    [375, 700, true],
    [820, 1180, false],
    [1280, 700, false],
  ] as const) {
    const fresh = await browser.newPage({ viewport: { width, height } });
    await fresh.route(/\/main-[\w-]+\.js$/, () => undefined);
    await fresh.goto(page.url(), { waitUntil: 'commit' });
    const row = fresh.locator('.panel-season:visible .month[data-current] .week.chosen');
    await expect(row.locator('[role=rowheader]')).toHaveText(stay);
    await expect(row).not.toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
    await expect(fresh.locator('.outcome:visible .total')).toBeVisible();
    const bar = fresh.locator('.booking-bar');
    await expect(bar).toBeVisible({ visible: barShown });
    if (barShown) await expect(bar.getByRole('button', { name: 'Weiter' })).toBeVisible();
    await expect(fresh.locator('html')).not.toHaveAttribute('data-started');
    await fresh.close();
  }
});

// A bar's shown line by its parts, and where it sits: its distance from the screen's sides and
// foot, and whether its buttons stand to the right of its words.
const parts = (bar: Locator) => bar.locator('.bar-parts > span:visible').allInnerTexts();
const place = (bar: Locator) =>
  bar.evaluate((box) => {
    const { left, right, bottom } = box.getBoundingClientRect();
    const line = [...box.children].find((one) => one.checkVisibility())!;
    const words = line.querySelector('output')!.getBoundingClientRect();
    const buttons = line.querySelector('.bar-actions')!.getBoundingClientRect();
    return {
      edges: [left, innerWidth - right, innerHeight - bottom].map(Math.round),
      right: buttons.left >= words.right && buttons.top < words.bottom,
    };
  });

for (const [path, book] of [
  ['/de/wohnungen/laerche', 'Weiter'],
  ['/en/apartments/laerche', 'Continue'],
] as const)
  test(`a chosen week comes back home in a bar alike (${path.slice(1, 3)})`, async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 640 });
    await openNext(page, path);
    await (await firstFree(page)).click();
    await page.evaluate(() => scrollTo({ top: 0, behavior: 'instant' }));
    const phone = page.locator('.booking-bar');
    await expect(phone.locator('.bar-parts > span:visible')).toHaveText([/^Lärche$/, /€/, /./]);
    await expect(phone.getByRole('button', { name: book })).toBeVisible();
    const said = await parts(phone);
    const sits = await place(phone);
    expect(sits.right).toBe(true);
    // Back to the home page: the week is chosen in the list, and its bar reads and sits alike.
    await expect(page.locator('a.back')).toHaveAttribute('href', /apartment=laerche&arrival=/);
    await page.locator('a.back').click();
    await expect(page).toHaveURL(/apartment=laerche&arrival=\d{4}-\d\d-\d\d/);
    await expect(page.locator('.stay.chosen:visible')).toHaveCount(1);
    const home = page.locator('.pick .booking-bar');
    await expect(home).toBeVisible();
    // At the list's top, where the bar keeps to the screen's foot.
    await page
      .locator('.weeks')
      .evaluate((list) => scrollTo({ top: list.offsetTop, behavior: 'instant' }));
    await expect(home.locator('.bar-parts > span:visible')).toHaveText(said);
    await expect.poll(() => place(home)).toEqual(sits);
    await expect(home.getByRole('link', { name: book })).toBeVisible();
    // On a desktop too the buttons stand to the right.
    await page.setViewportSize({ width: 1280, height: 800 });
    await expect.poll(async () => (await place(home)).right).toBe(true);
  });

test('a week from the address is chosen on the home page at the first paint', async ({
  page,
  browser,
}) => {
  await openNext(page, '/de/wohnungen/laerche');
  await (await firstFree(page)).click();
  await expect(page.locator('a.back')).toHaveAttribute('href', /apartment=laerche&arrival=/);
  const back = await page.locator('a.back').getAttribute('href');
  for (const width of [375, 1280]) {
    const fresh = await browser.newPage({ viewport: { width, height: 700 } });
    await fresh.route(/\/main-[\w-]+\.js$/, () => undefined);
    await fresh.goto(back!, { waitUntil: 'commit' });
    await expect(fresh.locator('.stay.chosen:visible')).toHaveCount(1);
    await expect(fresh.locator('.pick .booking-bar')).toContainText('Lärche');
    await expect(fresh.locator('html')).not.toHaveAttribute('data-started');
    await fresh.close();
  }
});

test('the phone bar’s cross clears the week and leaves the focus on its button', async ({
  page,
}) => {
  await page.setViewportSize({ width: 375, height: 700 });
  await openNext(page, '/de/wohnungen/laerche');
  await (await firstFree(page)).click();
  await page.evaluate(() => scrollTo({ top: 0, behavior: 'instant' }));
  const bar = page.locator('.booking-bar');
  await bar.getByRole('button', { name: 'Gewählte Woche aufheben' }).click();
  await expect(bar.getByRole('button', { name: 'Woche wählen' })).toBeFocused();
  await expect(page).not.toHaveURL(/arrival=/);
  await expect(panel(page).locator('[aria-selected=true]')).toHaveCount(0);
});

test(
  'the calendar view stays from one apartment page to the next',
  { tag: '@any-engine' },
  async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await open(page, '/en/apartments/laerche');
    await page.locator('.views').getByTitle('Calendar').click();
    await expect(page).toHaveURL(/view=calendar/);
    await page.getByRole('button', { name: 'Apartments' }).click();
    await page
      .getByRole('navigation', { name: 'Apartments' })
      .getByRole('link', { name: 'Ahorn' })
      .click();
    await expect(page).toHaveURL(/\/en\/apartments\/ahorn\?view=calendar/);
    await expect(page.getByRole('radio', { name: 'Calendar' })).toBeChecked();
  },
);

// One test per width: six scans in one come too close to the test's time limit.
for (const width of [320, 1280])
  test(
    `the panel passes axe at ${width} px, in both views and with a list open`,
    { tag: '@any-engine' },
    async ({ page }) => {
      await page.setViewportSize({ width, height: 800 });
      await openNext(page, '/en/apartments/laerche');
      await (await firstFree(page)).click();
      const scan = async (place: 'list' | 'calendar') => {
        // The fade starts after the view's render, so a check before it would find none.
        await page.waitForFunction(
          (view) =>
            document.querySelector(`.views[data-view="${view}"]`) &&
            !document.getAnimations().length,
          place,
        );
        const { violations } = await new AxeBuilder({ page }).include('.booking').analyze();
        expect(violations, place).toEqual([]);
      };
      await scan('list');
      expect(
        await month(page)
          .locator('.week')
          .evaluateAll((rows) => rows.every((row) => row.scrollWidth <= row.clientWidth)),
        'rows fit',
      ).toBe(true);
      await page.locator('.views').getByTitle('Calendar').click();
      await scan('calendar');
      await page.locator('#adults').click();
      const { violations } = await new AxeBuilder({ page })
        .include('.booking')
        .include('.spartan-select-content')
        .analyze();
      expect(violations, 'open list').toEqual([]);
    },
  );

test('an apartment too small says how many it takes and does not book', async ({ page }) => {
  await openNext(page, '/de/wohnungen/laerche?adults=4&children=1');
  await expect(page.locator('.too-small')).toHaveText('Lärche hat Platz für bis zu 4 Gäste.');
  await (await firstFree(page)).click();
  const outcome = panel(page).locator('.outcome:visible');
  await expect(outcome.getByRole('button', { name: 'Weiter zur Buchung' })).toBeDisabled();
  await pickCount(page, 'children', 0);
  await expect(page.locator('.too-small')).toBeEmpty();
  await expect(outcome.getByRole('link', { name: 'Weiter zur Buchung' })).toHaveAttribute(
    'href',
    /\/de\/wohnungen\/laerche\/buchen\?arrival=.+&departure=.+&adults=4$/,
  );
});
