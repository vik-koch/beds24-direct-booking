import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

const panel = (page: Page) => page.locator('.panel');
// Controls used before the application has started are outside what the site supports.
async function open(page: Page, path: string) {
  const response = await page.goto(path);
  await expect(page.locator('html')).toHaveAttribute('data-smooth', '');
  return response;
}
// The shown season's shown month.
// The shown season, and not one leaving after a change.
const season = (page: Page) => page.locator('.panel-season:visible:not([data-leaving])');
const month = (page: Page) => season(page).locator('.month[data-current]');
const monthName = (page: Page) => season(page).locator('.month-head h3');
const next = (page: Page) => season(page).getByRole('button', { name: /Nächster|Next/ });
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

// The first month of the shown season with a free week, and that week's row.
async function firstFree(page: Page) {
  for (let i = 0; i < 12; i++) {
    const free = month(page).locator('label.stay');
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
  await open(page, '/de/wohnungen/laerche');
  await expect(panel(page).getByRole('button', { name: 'Erst eine Woche wählen' })).toBeDisabled();
  await expect(panel(page).locator('.from:visible')).toHaveText(/ab €\s[\d.,]+ pro Woche/);
  const week = await firstFree(page);
  const price = amount(await week.locator('.price').innerText());
  await week.click();
  await expect(week.locator('input')).toBeChecked();
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
  await expect(page).toHaveURL(
    /arrival=\d{4}-\d\d-\d\d&departure=\d{4}-\d\d-\d\d&adults=3&children=1/,
  );
  await page.reload();
  await expect(page.locator('#adults')).toHaveText('3');
  await expect(page.locator('#children')).toHaveText('1');
  await expect(month(page).locator('input:checked')).toHaveCount(1);

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
  await open(page, '/de/wohnungen/laerche');
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

  // Zirbe asks Beds24 for no children: one count of guests, each taxed as an adult.
  await open(page, '/de/wohnungen/zirbe?season=summer');
  await expect(page.locator('#children')).toHaveCount(0);
  await expect(page.getByRole('combobox', { name: 'Gäste' })).toHaveText('2');
  expect(await options(page, 'adults')).toEqual([1, 2]);
  await (await firstFree(page)).click();
  await expect(panel(page).locator('.outcome:visible .total')).toContainText(
    'Ortstaxe: 2 Gäste × 7 Nächte',
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
  await open(page, '/de/wohnungen/laerche');
  await next(page).click();
  const week = await firstFree(page);
  const name = await monthName(page).innerText();
  await week.click();
  const url = new URL(page.url());
  await open(
    page,
    `/de/wohnungen/laerche?arrival=${url.searchParams.get('arrival')}&departure=${url.searchParams.get('departure')}`,
  );
  await expect(monthName(page)).toHaveText(name);
  await expect(month(page).locator('input:checked')).toHaveCount(1);
  await expect(panel(page).getByRole('link', { name: 'Weiter zur Buchung' })).toBeVisible();
  // A week that is not free is not chosen.
  await open(page, '/de/wohnungen/laerche?arrival=2020-01-04&departure=2020-01-11');
  await expect(panel(page).locator('input[name^=week]:checked')).toHaveCount(0);
});

test('the calendar shows the list’s month and week, at the same height', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await open(page, '/de/wohnungen/laerche');
  const week = await firstFree(page);
  const name = await monthName(page).innerText();
  const height = await month(page)
    .locator('..')
    .evaluate((box) => box.offsetHeight);
  await week.click();
  const arrival = new URL(page.url()).searchParams.get('arrival')!;
  await page.getByRole('radio', { name: 'Kalender' }).check({ force: true });
  await expect(monthName(page)).toHaveText(name);
  expect(
    await month(page)
      .locator('..')
      .evaluate((box) => box.offsetHeight),
  ).toBe(height);
  const day = Number(arrival.slice(8));
  const start = month(page).locator('label.start', { has: page.locator('input:checked') });
  await expect(start).toHaveText(String(day));
  // The band runs from the arrival to the departure, its ends under their circles.
  await expect(month(page).locator('.band-start')).toHaveCount(1);
  expect(await month(page).locator('.in-band').count()).toBeGreaterThanOrEqual(
    Math.min(6, new Date(Date.UTC(2000, Number(arrival.slice(5, 7)), 0)).getUTCDate() - day),
  );
  // A free week's first day is a radio named with its stay and price.
  await expect(start.locator('input')).toHaveAttribute(
    'aria-label',
    /^Samstag, .+ – Samstag, .+, €\s/,
  );
  await page.getByRole('radio', { name: 'Liste' }).check({ force: true });
  await expect(month(page).locator('label.stay input:checked')).toHaveCount(1);
});

test('the months page by their buttons, slide in from their side and keep the focus', async ({
  page,
}) => {
  await open(page, '/en/apartments/laerche');
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
  await next(page).click();
  await expect
    .poll(moves)
    .toEqual([expect.stringMatching(/^0/), expect.stringMatching(/^[1-9][\d.]*px/)]);
  await expect(monthName(page)).not.toHaveText(first);
  await expect(back).toBeEnabled();
  // By keyboard to the season's last month: there the focus moves to the other button.
  await next(page).focus();
  for (let i = 0; i < 12 && (await next(page).isEnabled()); i++) await page.keyboard.press('Enter');
  await expect(next(page)).toBeDisabled();
  await expect(back).toBeFocused();
});

test('the week, the view and the guests can be chosen by keyboard alone', async ({ page }) => {
  await open(page, '/de/wohnungen/laerche');
  await firstFree(page);
  // The view: two radios, one tab stop.
  await page.getByRole('radio', { name: 'Liste' }).focus();
  await page.keyboard.press('ArrowRight');
  await expect(page.getByRole('radio', { name: 'Kalender' })).toBeChecked();
  await expect(month(page).locator('.calendar')).toBeVisible();
  await page.keyboard.press('ArrowLeft');
  await expect(month(page).locator('label.stay').first()).toBeVisible();
  // The month's weeks are one tab stop after the month's buttons; Space chooses.
  const focused = page.locator('input[name^=week]:focus');
  for (let i = 0; i < 4 && !(await focused.count()); i++) await page.keyboard.press('Tab');
  await expect(focused).toHaveCount(1);
  await page.keyboard.press('Space');
  await expect(focused).toBeChecked();
  await expect(panel(page).getByRole('link', { name: 'Weiter zur Buchung' })).toBeVisible();
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

test('a full season, one not open yet and an unreachable Beds24 each say so', async ({ page }) => {
  // Zirbe is booked all winter.
  await open(page, '/de/wohnungen/zirbe?season=winter');
  await expect(panel(page).locator('.panel-empty:visible')).toHaveText(
    /Im Winter 2026\/27 ist keine Woche mehr frei\./,
  );
  await expect(panel(page).locator('.outcome:visible')).toHaveCount(0);
  await open(page, 'http://localhost:4003/en/apartments/laerche?season=summer');
  await expect(panel(page).locator('.panel-empty:visible')).toContainText('are not open yet');
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
  await expect(page.locator('html')).toHaveAttribute('data-season', 'summer');
  await expect(panel(page).locator('h2')).toContainText('Sommer 2027');
  await expect(monthName(page)).toHaveText(/ 2027$/);
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
  await open(page, '/de/wohnungen/laerche');
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
});

test('the panel passes axe with a week chosen, in both views and with a list open', async ({
  page,
}) => {
  for (const width of [320, 1280]) {
    await page.setViewportSize({ width, height: 800 });
    await open(page, '/en/apartments/laerche');
    await (await firstFree(page)).click();
    const scan = async (place: string) => {
      // Once the new view has faded in.
      await page.waitForFunction(() => !document.getAnimations().length);
      const { violations } = await new AxeBuilder({ page }).include('.booking').analyze();
      expect(violations, `${place} at ${width}`).toEqual([]);
    };
    await scan('list');
    await page.getByRole('radio', { name: 'Calendar' }).check({ force: true });
    await scan('calendar');
    await page.locator('#adults').click();
    const { violations } = await new AxeBuilder({ page })
      .include('.booking')
      .include('.spartan-select-content')
      .analyze();
    expect(violations, `open list at ${width}`).toEqual([]);
  }
});
