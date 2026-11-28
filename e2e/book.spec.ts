import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { toLanguage } from './header';

// A free or a booked week of the apartment's later season, as its page offers it.
async function weekOf(page: Page, path: string, kind: 'free' | 'full') {
  await page.goto(path);
  const later = (await page.locator('.panel-season').last().getAttribute('data-for'))!;
  const cells = page.locator(
    `.panel-season[data-for=${later}] .week${kind === 'full' ? '.full' : ':not(.full)'} .week-cell`,
  );
  return (await cells.first().getAttribute('data-date'))!;
}

// The step of a free week of the apartment, once the application has started.
async function stepOf(page: Page, path: string, query = 'adults=2') {
  const arrival = await weekOf(page, path, 'free');
  const step = `${path}/${path.startsWith('/de') ? 'buchen' : 'book'}?arrival=${arrival}&${query}`;
  await page.goto(step);
  await expect(page.locator('html')).toHaveAttribute('data-started', '');
  return { arrival, step };
}

// A field by its name, by role: Firefox's driver crashes the page when a lookup by label meets
// brain's checkbox, whose aria-labelledby names the label that names it already.
const field = (page: Page, name: string) =>
  page
    .getByRole('textbox', { name, exact: true })
    .or(page.getByRole('combobox', { name, exact: true }));

// Each label's text, as read: its name and "(optional)" are two boxes, which innerText breaks.
const labels = async (page: Page) =>
  (await page.locator('form').locator('label[data-slot=field-label], legend').allInnerTexts()).map(
    (text) => text.replace(/\s+/g, ' '),
  );

// Haus Firn's questions, as Beds24 orders them: its mobile is internal, so not asked.
const firn = {
  en: [
    'First name',
    'Surname',
    'E-mail address',
    'Phone number',
    'Country',
    'Arrival time (optional)',
    'Message to your hosts (optional)',
  ],
  de: [
    'Vorname',
    'Nachname',
    'E-Mail-Adresse',
    'Telefonnummer',
    'Land',
    'Ankunftszeit (optional)',
    'Nachricht an die Gastgeber (optional)',
  ],
};

for (const [lang, path, guests, total] of [
  ['de', '/de/wohnungen/laerche', '2 Erwachsene und 1 Kind', 'Gesamt'],
  ['en', '/en/apartments/laerche', '2 adults and 1 child', 'Total'],
] as const)
  test(`the booking step shows the stay, its total and Beds24's questions (${lang})`, async ({
    page,
    browser,
  }) => {
    const { arrival, step } = await stepOf(page, path, 'adults=2&children=1');
    // Rendered by the server, before the application starts.
    const fresh = await browser.newPage();
    await fresh.route(/\/main-[\w-]+\.js$/, () => undefined);
    const response = await fresh.goto(step, { waitUntil: 'commit' });
    expect(response!.status()).toBe(200);
    await expect(fresh.locator('.summary h2')).toHaveText('Lärche');
    await expect(fresh.locator('.summary .facts li')).toHaveText([/^2\s\D+$/, /^61\sm²\s*$/]);
    await expect(fresh.locator('.summary img:visible')).toHaveAttribute('alt', /\w/);
    // The days of arrival and departure, a week apart, with the hours Beds24 sets.
    await expect(fresh.locator('.dates dt')).toHaveText(
      lang === 'de' ? ['Anreise', 'Abreise', 'Gäste'] : ['Check-in', 'Check-out', 'Guests'],
    );
    await expect(fresh.locator('.dates dd')).toHaveText([
      /2\d\d\d$/,
      lang === 'de' ? '16:00 – 20:00 Uhr' : '16:00 – 20:00',
      /2\d\d\d$/,
      lang === 'de' ? 'bis 10:00 Uhr' : 'by 10:00',
      guests,
    ]);
    expect(await labels(fresh)).toEqual(firn[lang]);
    await fresh.close();

    await expect(page.locator('.total dt')).toHaveText(
      lang === 'de' ? ['Miete', 'Ortstaxe', total] : ['Rent', 'Local tax', total],
    );
    // The price, 49 of tax for two adults, and their sum.
    const [price, tax, sum] = (await page.locator('.total dd').allInnerTexts()).map((text) =>
      Number(
        text
          .replace(/[^\d,.]/g, '')
          .replace(lang === 'de' ? /\./g : /,/g, '')
          .replace(',', '.'),
      ),
    );
    expect(tax).toBe(49);
    expect(sum).toBeCloseTo(price + tax);
    expect(await labels(page)).toEqual(firn[lang]);
    await expect(
      page.getByRole('link', {
        name: lang === 'de' ? 'Mietbedingungen' : 'rental terms',
        exact: true,
      }),
    ).toHaveAttribute('href', lang === 'de' ? '/de/agb' : '/en/terms');
    await expect(
      page.getByRole('button', { name: lang === 'de' ? 'Buchen und bezahlen' : 'Book and pay' }),
    ).toBeVisible();
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);

    // Rendered in the browser: the other language keeps the stay, and asks in its words.
    const [current, other, label] =
      lang === 'de'
        ? ['Sprache: Deutsch', 'English', 'Lärche: Book']
        : ['Language: English', 'Deutsch', 'Lärche: Buchen'];
    await toLanguage(page, current, other);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(label);
    await expect(page).toHaveURL(new RegExp(`\\?arrival=${arrival}&adults=2&children=1$`));
    expect(await labels(page)).toEqual(firn[lang === 'de' ? 'en' : 'de']);
  });

test("each field is asked as Beds24's question and the browser may fill it in", async ({
  page,
}) => {
  await stepOf(page, '/en/apartments/ahorn');
  // Haus Farn hides the first name, which is asked first, and asks the e-mail as optional, which
  // Stripe and the confirmation need; its note is internal.
  expect(await labels(page)).toEqual([
    'First name',
    'Surname',
    'E-mail address',
    'Phone number',
    'Country',
    'Arriving by',
    'Pillows (optional)',
    'Ski school from (optional)',
    'Arrival time (optional)',
    'Cot for a baby (optional)',
    'Message to your hosts (optional)',
  ]);
  for (const [name, type, autocomplete] of [
    ['First name', 'text', 'given-name'],
    ['Surname', 'text', 'family-name'],
    ['E-mail address', 'email', 'email'],
    ['Phone number', 'tel', 'tel'],
    ['Ski school from (optional)', 'date', 'off'],
    ['Arrival time (optional)', 'time', 'off'],
  ]) {
    await expect(field(page, name)).toHaveAttribute('type', type);
    await expect(field(page, name)).toHaveAttribute('autocomplete', autocomplete);
  }
  await expect(field(page, 'Country')).toHaveAttribute('autocomplete', 'country');
  // Countries by their names in the page's language, the value Beds24's code.
  await expect(field(page, 'Country').locator('option[value=AT]')).toHaveText('Austria');
  await expect(field(page, 'Arriving by').locator('option')).toHaveText([
    'Choose…',
    'Car',
    'Train',
    'Plane',
  ]);
  // A list, radio buttons on Beds24's own page, is a dropdown too.
  await expect(field(page, 'Pillows (optional)').locator('option')).toHaveText([
    'Choose…',
    'Soft',
    'Firm',
  ]);
  // The phone's example is a number of the page's language's region, then of the chosen country.
  await expect(field(page, 'Phone number')).toHaveAttribute('placeholder', '+44 7400 123456');
  await field(page, 'Country').selectOption('FR');
  await expect(field(page, 'Phone number')).toHaveAttribute('placeholder', '+33 6 12 34 56 78');
  await expect(page.getByRole('checkbox', { name: 'Cot for a baby (optional)' })).not.toBeChecked();
  await expect(field(page, 'Message to your hosts (optional)')).toHaveJSProperty(
    'tagName',
    'TEXTAREA',
  );

  // From 40rem a pair shares a row, as does a short field with the tick box after it, and a short
  // field alone takes half of one; on a phone each takes its own.
  const wide = page.viewportSize()!.width >= 640;
  const top = async (name: string) => (await field(page, name).boundingBox())!.y;
  const row = async (one: string, other: string) =>
    expect(Math.abs((await top(one)) - (await top(other))) < 1).toBe(wide);
  await row('First name', 'Surname');
  await row('E-mail address', 'Phone number');
  const time = (await field(page, 'Arrival time (optional)').boundingBox())!;
  const cot = (await page
    .getByRole('checkbox', { name: 'Cot for a baby (optional)' })
    .boundingBox())!;
  expect(Math.abs(time.y + time.height / 2 - (cot.y + cot.height / 2)) < 4).toBe(wide);
  expect(cot.x > time.x + time.width).toBe(wide);
  const form = (await page.locator('.answers').boundingBox())!;
  expect(time.width < form.width / 2).toBe(wide);
  expect(await top('Ski school from (optional)')).toBeLessThan(time.y - 1);
});

test('the form names each error and its fix once the button is pressed, then as the guest types', async ({
  page,
}) => {
  await stepOf(page, '/en/apartments/ahorn');
  const email = field(page, 'E-mail address');
  const button = page.getByRole('button', { name: 'Book and pay' });
  const errors = page.locator('form hlm-field-error:visible');
  // Leaving a field shows no error, which would move the button under a pressing pointer.
  await email.fill('ada@');
  await email.blur();
  await expect(button).toBeVisible();
  await expect(errors).toHaveCount(0);
  await expect(page.locator('form [aria-invalid=true]')).toHaveCount(0);

  // Pressed with the e-mail still focused, as a guest does.
  await email.focus();
  await button.click();
  await expect(field(page, 'First name')).toBeFocused();
  await expect(errors).toHaveText([
    'Enter your first name.',
    'Enter your surname.',
    'Enter an e-mail address such as name@example.com.',
    'Enter your phone number.',
    'Choose your country.',
    'Choose an answer to “Arriving by”.',
  ]);
  await expect(email).toHaveAttribute('aria-invalid', 'true');
  await expect(email).toHaveAccessibleDescription(
    'Enter an e-mail address such as name@example.com.',
  );
  expect((await new AxeBuilder({ page }).include('form').analyze()).violations).toEqual([]);

  // Then each error follows the answer: a number written as at home is whole once its country is
  // chosen.
  const phone = 'Enter a full phone number, with its country code, such as +44 7400 123456.';
  await field(page, 'Phone number').fill('06 12 34 56 78');
  await expect(errors.nth(3)).toHaveText(phone);
  await field(page, 'Country').selectOption('FR');
  await expect(errors).toHaveCount(4);
  await field(page, 'Surname').fill('Lovelace 2');
  await expect(errors.nth(1)).toHaveText('Enter your surname in letters.');
  await email.fill('ada@example.com');
  await field(page, 'Ski school from (optional)').fill('2027-02-06');
  await expect(errors).toHaveCount(3);
  await expect(email).not.toHaveAttribute('aria-invalid');
});

test('the form is filled in and sent by keyboard', async ({ page }) => {
  await stepOf(page, '/en/apartments/ahorn');
  await field(page, 'First name').focus();
  for (const text of ['Ada', 'Lovelace', 'ada@example.com', '+44 20 7946 0000']) {
    await page.keyboard.type(text);
    await page.keyboard.press('Tab');
  }
  // The country by its first letters, as a dropdown takes them.
  await page.keyboard.type('Austria');
  await expect(field(page, 'Country')).toHaveValue('AT');
  await page.keyboard.press('Tab');
  await expect(field(page, 'Arriving by')).toBeFocused();
  await page.keyboard.type('Train');
  await page.keyboard.press('Tab');
  await expect(field(page, 'Pillows (optional)')).toBeFocused();
  await page.keyboard.type('Firm');
  await expect(field(page, 'Pillows (optional)')).toHaveValue('1');
  // Through the date's and the time's parts, which take as many stops as the engine gives them.
  const cot = page.getByRole('checkbox', { name: 'Cot for a baby (optional)' });
  while (!(await cot.evaluate((box) => box === document.activeElement)))
    await page.keyboard.press('Tab');
  await page.keyboard.press('Space');
  await expect(cot).toBeChecked();
  for (let i = 0; i < 3; i++) await page.keyboard.press('Tab');
  await expect(page.getByRole('button', { name: 'Book and pay' })).toBeFocused();
  // The answers go to the server, which books the week (#349).
  const [request] = await Promise.all([
    page.waitForRequest((request) => request.method() === 'POST'),
    page.keyboard.press('Enter'),
  ]);
  const sent = new URLSearchParams(request.postData()!);
  expect(sent.get('answers.lastName')).toBe('Lovelace');
  expect(sent.get('answers.countrySelect')).toBe('AT');
  expect(sent.get('answers.custom1')).toBe('1');
});

test("an apartment that Beds24's settings let the site not book shows no booking button", async ({
  page,
}) => {
  // On the e2e test site Fienile's house takes bookings on request, and Zonneterras's asks a
  // question without an Italian text; Vista's and Castagno's asks none of its own.
  for (const [slug, bookable] of [
    ['fienile', false],
    ['vista', true],
    ['castagno', true],
    ['zonneterras', false],
  ] as const) {
    const path = `http://localhost:4002/it/appartamenti/${slug}`;
    const arrival = await weekOf(page, path, 'free');
    await page.goto(`${path}?arrival=${arrival}`);
    await expect(page.locator('.panel .total')).toBeVisible();
    await expect(page.locator('.panel').getByRole('link', { name: 'Prenota' }), slug).toHaveCount(
      bookable ? 1 : 0,
    );
    await expect(page.locator('.panel').getByRole('button', { name: 'Prenota' })).toHaveCount(0);
    await page.goto(`${path}/prenota?arrival=${arrival}`);
    await expect(page.locator('main p').first()).toHaveText(
      bookable
        ? /Prenotando accettate/
        : 'Questo appartamento al momento non si può prenotare online.',
    );
  }
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
      await expect(page.locator('main form')).toHaveCount(0);
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
  'while Beds24 cannot be reached the booking step says booking is unavailable',
  { tag: '@any-engine' },
  async ({ page }) => {
    const response = await page.goto(
      'http://localhost:4001/en/apartments/zirbe/book?arrival=2027-01-02',
    );
    expect(response!.status()).toBe(503);
    await expect(page.locator('main p').first()).toHaveText(
      'This apartment cannot be booked online at the moment.',
    );
    await expect(page.locator('main form')).toHaveCount(0);
  },
);

test('at 320 px the booking step does not scroll sideways, in both seasons', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 640 });
  for (const path of ['/de/wohnungen/laerche', '/en/apartments/ahorn']) {
    const arrival = await weekOf(page, path, 'free');
    for (const season of ['winter', 'summer']) {
      const step = `${path}/${path.startsWith('/de') ? 'buchen' : 'book'}`;
      await page.goto(`${step}?arrival=${arrival}&adults=2&season=${season}`);
      await expect(page.locator('main form')).toBeVisible();
      await page.locator('main button[type=submit]').click();
      await expect(page.locator('form hlm-field-error:visible').first()).toBeVisible();
      await expect
        .poll(() => page.locator('html').evaluate((html) => html.scrollWidth - html.offsetWidth))
        .toBe(0);
    }
  }
});
