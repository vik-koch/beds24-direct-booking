import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

const panel = (page: Page) => page.locator('.panel');
// Controls used before the application has started are outside what the site supports.
async function open(page: Page, path: string) {
  const response = await page.goto(path);
  await expect(page.locator('html')).toHaveAttribute('data-smooth', '');
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

// The first month of the shown season with a free week of its own, and that week's cell.
async function firstFree(page: Page) {
  for (let i = 0; i < 12; i++) {
    const free = month(page).locator('.week:not(.full, .outside) [role=gridcell]');
    if (await free.count()) return free.first();
    await next(page).click();
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

test('a week and the guests make the total, and the button takes them on to booking', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await openNext(page, '/de/wohnungen/laerche');
  await expect(panel(page).getByRole('button', { name: 'Erst eine Woche wählen' })).toBeDisabled();
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
});

test('the counts offer what Beds24 allows, and more adults make room by fewer children', async ({
  page,
}) => {
  // Lärche: four guests, any of them adults, up to three children.
  await openNext(page, '/de/wohnungen/laerche');
  expect(await options(page, 'adults')).toEqual([1, 2, 3, 4]);
  expect(await options(page, 'children')).toEqual([0, 1, 2]);
  await pickCount(page, 'adults', 1);
  expect(await options(page, 'children')).toEqual([0, 1, 2, 3]);
  await pickCount(page, 'children', 3);
  await pickCount(page, 'adults', 4);
  await expect(page.locator('#children')).toHaveText('0');
  expect(await options(page, 'children')).toEqual([0]);

  // Ahorn: six guests, at most four of them adults.
  await open(page, '/en/apartments/ahorn');
  await expect(page.locator('label[for=children]')).toHaveText(/Children\s+up to 14/);
  expect(await options(page, 'adults')).toEqual([1, 2, 3, 4]);
  expect(await options(page, 'children')).toEqual([0, 1, 2, 3, 4]);

  // Zirbe's room asks Beds24 for no children: one count of guests, each taxed as an adult. The
  // second site's Vista is that room, in a season of a whole year that always has free weeks.
  await open(page, 'http://localhost:4002/it/appartamenti/vista');
  await expect(page.locator('#children')).toHaveCount(0);
  await expect(page.getByRole('combobox', { name: 'Ospiti' })).toHaveText('2');
  expect(await options(page, 'adults')).toEqual([1, 2]);
  await (await firstFree(page)).click();
  await expect(panel(page).locator('.outcome:visible .total')).toContainText(
    'Tassa di soggiorno: 2 ospiti × 7 notti',
  );
});

test('an address over the limits opens at them, and an arrival from the list is chosen', async ({
  page,
}) => {
  await open(page, '/de/wohnungen/laerche?adults=9&children=9');
  await expect(page.locator('#adults')).toHaveText('4');
  await expect(page.locator('#children')).toHaveText('0');
  await open(page, '/de/wohnungen/laerche?adults=0&children=9');
  await expect(page.locator('#adults')).toHaveText('1');
  await expect(page.locator('#children')).toHaveText('3');

  // A week in a later month, as the free-weeks list links it.
  await openNext(page, '/de/wohnungen/laerche');
  await next(page).click();
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
});

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
  await expect(start).toHaveAttribute('aria-label', /^Samstag, .+ – Samstag, .+, €\s/);
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
  for (let i = 0; i < 12 && (await next(page).isEnabled()); i++) await page.keyboard.press('Enter');
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
  await expect(page.getByRole('listbox')).toBeVisible();
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
  for (let i = 0; i < 12 && !(await row.count()); i++) await next(page).click();
  const arrival = await row.locator('[role=gridcell]').getAttribute('data-date');
  const shown = await monthName(page).innerText();
  await row.locator('[role=gridcell]').click();
  await expect(monthName(page)).not.toHaveText(shown);
  await expect(chosen(page)).toHaveAttribute('data-date', arrival!);
  await expect(page).toHaveURL(new RegExp(`arrival=${arrival}`));
  // In the calendar, a free week's first day in the month after.
  await page.locator('.views').getByTitle('Calendar').click();
  const day = month(page).locator('.day.outside:has(.start)');
  for (let i = 0; i < 12 && !(await day.count()); i++) await next(page).click();
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

test('a shared link opens at its week’s season, whatever season the page would show', async ({
  page,
  browser,
}) => {
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
});

test('a full season, one not open yet and an unreachable Beds24 each say so', async ({ page }) => {
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
});

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

test('on a phone a bar leads to the panel while it is out of view, then on to booking', async ({
  page,
}) => {
  await page.setViewportSize({ width: 375, height: 700 });
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
  await expect(bar.getByRole('link', { name: 'Weiter' })).toHaveAttribute(
    'href',
    /^\/de\/wohnungen\/laerche\/buchen\?arrival=/,
  );
  await page.setViewportSize({ width: 1280, height: 800 });
  await expect(bar).toBeHidden();
  // A season with no week to choose has no bar: the full one of a site with prices up to today.
  await page.setViewportSize({ width: 375, height: 700 });
  await open(page, 'http://localhost:4003/de/wohnungen/laerche');
  await page.evaluate(() => scrollTo({ top: 0, behavior: 'instant' }));
  await expect(bar).toBeHidden();
});

// One test per width: six scans in one come too close to the test's time limit.
for (const width of [320, 1280])
  test(`the panel passes axe at ${width} px, in both views and with a list open`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 800 });
    await openNext(page, '/en/apartments/laerche');
    await (await firstFree(page)).click();
    const scan = async (place: string) => {
      // Once the new view has faded in.
      await page.waitForFunction(() => !document.getAnimations().length);
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
  });
