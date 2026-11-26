import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { toLanguage } from './header';

const plus = (date: string, days: number) =>
  new Date(Date.parse(date) + days * 864e5).toISOString().slice(0, 10);

// A free or a booked week of the apartment's later season, as its page offers it.
async function weekOf(page: Page, path: string, kind: 'free' | 'full') {
  await page.goto(path);
  const later = (await page.locator('.panel-season').last().getAttribute('data-for'))!;
  const cells = page.locator(
    `.panel-season[data-for=${later}] .week${kind === 'full' ? '.full' : ':not(.full)'} .week-cell`,
  );
  return (await cells.first().getAttribute('data-date'))!;
}

for (const [lang, path, week, guests, text] of [
  [
    'de',
    '/de/wohnungen/laerche',
    'Woche',
    '2 Erwachsene und 1 Kind',
    'Die Direktbuchung kommt bald.',
  ],
  ['en', '/en/apartments/laerche', 'Week', '2 adults and 1 child', 'Direct booking opens soon.'],
] as const)
  test(`the booking step shows the stay (${lang})`, async ({ page, browser }) => {
    const arrival = await weekOf(page, path, 'free');
    // As the panel's button links it.
    const book = `${path}/${lang === 'de' ? 'buchen' : 'book'}?arrival=${arrival}&adults=2&children=1`;
    // Rendered by the server, before the application starts.
    const fresh = await browser.newPage();
    await fresh.route(/\/main-[\w-]+\.js$/, () => undefined);
    const response = await fresh.goto(book, { waitUntil: 'commit' });
    expect(response!.status()).toBe(200);
    await expect(fresh.locator('main dd')).toHaveText(['Lärche', /2\d\d\d.*–.*2\d\d\d/, guests]);
    await fresh.close();

    await page.goto(book);
    await expect(page.locator('html')).toHaveAttribute('data-started', '');
    await expect(page.locator('main dt')).toHaveText([
      lang === 'de' ? 'Wohnung' : 'Apartment',
      week,
      lang === 'de' ? 'Gäste' : 'Guests',
    ]);
    await expect(page.locator('main')).toContainText(text);
    // The demo's apartments give no other place to book them.
    await expect(page.locator('main a')).toHaveCount(0);
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);

    // Rendered in the browser: the other language keeps the stay.
    const [current, other, label] =
      lang === 'de'
        ? ['Sprache: Deutsch', 'English', 'Lärche: Book']
        : ['Language: English', 'Deutsch', 'Lärche: Buchen'];
    await toLanguage(page, current, other);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(label);
    await expect(page).toHaveURL(new RegExp(`\\?arrival=${arrival}&adults=2&children=1$`));
    await expect(page.locator('main dd').nth(2)).toHaveText(
      lang === 'de' ? '2 adults and 1 child' : '2 Erwachsene und 1 Kind',
    );
  });

test('the booking step links where the apartment can be booked meanwhile, with the stay', async ({
  page,
}) => {
  const path = 'http://localhost:4002/it/appartamenti/vista';
  const arrival = await weekOf(page, path, 'free');
  // Vista asks for no children: the site linked counts them as adults.
  await page.goto(`${path}/prenota?arrival=${arrival}&adults=1&children=1`);
  await expect(page.locator('html')).toHaveAttribute('data-started', '');
  const link = page.getByRole('link', { name: 'Prenota questa settimana su Booking.com' });
  await expect(link).toHaveAttribute(
    'href',
    `https://booking.example/vista?checkin=${arrival}&checkout=${plus(arrival, 7)}` +
      '&group_adults=2&group_children=0&no_rooms=1',
  );
  // Without a stay there is nothing to link.
  await page.goto(`${path}/prenota`);
  await expect(page.getByRole('link', { name: 'Torna a Vista sul Ghiacciaio' })).toBeVisible();
  await expect(page.getByRole('link', { name: /Booking\.com/ })).toHaveCount(0);
  await page.goto(`${path}/prenota?arrival=${arrival}&adults=1&children=1`);
  // By keyboard: after the header's links.
  for (let i = 0; i < 30 && !(await link.evaluate((a) => a === document.activeElement)); i++)
    await page.keyboard.press('Tab');
  await expect(link).toBeFocused();
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
});

for (const [lang, path, invalid, taken, back] of [
  [
    'de',
    '/de/wohnungen/laerche',
    'Diese Adresse nennt keine Woche, die sich buchen lässt.',
    'Diese Woche ist nicht mehr frei.',
    'Zurück zu Lärche',
  ],
  [
    'en',
    '/en/apartments/laerche',
    'This address names no week that can be booked.',
    'This week is no longer free.',
    'Back to Lärche',
  ],
] as const)
  test(`a stay that cannot be booked says so and links back (${lang})`, async ({ page }) => {
    const step = `${path}/${lang === 'de' ? 'buchen' : 'book'}`;
    for (const query of ['', '?arrival=2020-01-04', '?arrival=2027-02-30', '?arrival=x']) {
      await page.goto(`${step}${query}`);
      await expect(page.locator('main p').first()).toHaveText(invalid);
      await expect(page.locator('main dl')).toHaveCount(0);
      await expect(page.getByRole('link', { name: back })).toHaveAttribute(
        'href',
        `${path}#booking`,
      );
    }
    // A week booked since: back to the panel, which shows it chosen as blocked.
    const arrival = await weekOf(page, path, 'full');
    await page.goto(`${step}?arrival=${arrival}&adults=3`);
    await expect(page.locator('main p').first()).toHaveText(taken);
    await expect(page.locator('html')).toHaveAttribute('data-started', '');
    const link = page.getByRole('link', { name: back });
    await expect(link).toHaveAttribute('href', new RegExp(`arrival=${arrival}&adults=3#booking$`));
    // The season switched to on the step goes with the link.
    const shown = await page.locator('html').getAttribute('data-season');
    const other = shown === 'winter' ? 'summer' : 'winter';
    await page.locator(`.season-switch label[data-for=${other}]`).click();
    await expect(link).toHaveAttribute('href', new RegExp(`&season=${other}#booking$`));
    await page.locator(`.season-switch label[data-for=${shown}]`).click();
    await expect(link).toHaveAttribute('href', new RegExp(`arrival=${arrival}&adults=3#booking$`));
    await link.click();
    await expect(page).toHaveURL(new RegExp(`arrival=${arrival}&adults=3#booking$`));
    await expect(page.locator('.panel')).toHaveAttribute('data-blocked', '');
  });

test('more guests than the apartment takes are named on the booking step', async ({ page }) => {
  const arrival = await weekOf(page, '/en/apartments/zirbe', 'free');
  await page.goto(`/en/apartments/zirbe/book?arrival=${arrival}&adults=3`);
  await expect(page.locator('main p').first()).toHaveText('Zirbe sleeps up to 2 guests.');
  await expect(page.getByRole('link', { name: 'Back to Zirbe' })).toHaveAttribute(
    'href',
    `/en/apartments/zirbe?arrival=${arrival}&adults=3#booking`,
  );
});

test(
  'while Beds24 cannot be reached the booking step shows the stay unchecked',
  { tag: '@any-engine' },
  async ({ page }) => {
    const response = await page.goto(
      'http://localhost:4001/en/apartments/zirbe/book?arrival=2027-01-02',
    );
    expect(response!.status()).toBe(503);
    await expect(page.locator('main dd')).toHaveText([
      'Zirbe',
      'Sat, 2 January 2027 – Sat, 9 January 2027',
      '2 adults',
    ]);
  },
);

test('at 320 px the booking step does not scroll sideways, in both seasons', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 640 });
  const arrival = await weekOf(page, '/de/wohnungen/ahorn', 'free');
  for (const season of ['winter', 'summer'])
    for (const path of ['/de/wohnungen/ahorn/buchen', '/en/apartments/ahorn/book']) {
      await page.goto(`${path}?arrival=${arrival}&adults=4&children=2&season=${season}`);
      await expect(page.locator('main dl')).toBeVisible();
      await expect
        .poll(() => page.locator('html').evaluate((html) => html.scrollWidth - html.offsetWidth))
        .toBe(0);
    }
});
