import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { toLanguage } from './header';

const other = 'http://localhost:4002';

test('a content page shows its file, and the language switch leads to the same page', async ({
  page,
}) => {
  await page.goto(`${other}/it/condizioni`);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Condizioni');
  await expect(page.getByRole('main').getByRole('heading', { level: 2 })).toHaveText(
    'Cancellazione',
  );
  await expect(page.getByRole('columnheader', { name: 'Disdetta' })).toBeVisible();
  await expect(page).toHaveTitle('Condizioni · Casa Prova Alta');
  await toLanguage(page, 'Lingua: Italiano', 'Nederlands');
  await expect(page).toHaveURL(`${other}/nl/voorwaarden`);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Voorwaarden');
  await expect(page.getByRole('columnheader', { name: 'Opzegging' })).toBeVisible();
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
});

test("a page's first heading sits under its title, a later one with room above it", async ({
  page,
}) => {
  await page.goto(`${other}/it/condizioni`);
  await expect(page.getByRole('heading', { level: 2, name: 'Cancellazione' })).toHaveCSS(
    'margin-top',
    '0px',
  );
  await page.goto('/en/faq');
  await expect(page.getByRole('heading', { level: 2, name: 'Arrival' })).toHaveCSS(
    'margin-top',
    '36px',
  );
});

test('a table wider than the column scrolls in its frame, reached by keyboard', async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 640 });
  await page.goto(`${other}/it/condizioni`);
  const frame = page.locator('.table-frame');
  await expect(frame).toHaveAttribute('tabindex', '0');
  const sizes = await frame.evaluate((box) => {
    const root = document.documentElement;
    return { box: [box.scrollWidth, box.clientWidth], page: [root.scrollWidth, root.clientWidth] };
  });
  expect(sizes.box[0]).toBeGreaterThan(sizes.box[1]);
  expect(sizes.page[0]).toBeLessThanOrEqual(sizes.page[1]);
  await frame.focus();
  await page.keyboard.press('ArrowRight');
  await expect.poll(() => frame.evaluate((box) => box.scrollLeft)).toBeGreaterThan(0);
  // Where it fits, it is no tab stop.
  await page.setViewportSize({ width: 1280, height: 800 });
  await expect(frame).not.toHaveAttribute('tabindex');
});

test(
  "a link to the site's own page carries the chosen guests",
  { tag: '@any-engine' },
  async ({ page }) => {
    await page.goto(`${other}/it/domande?adults=3`);
    const link = page.getByRole('link', { name: 'gli appartamenti' });
    await expect(link).toHaveAttribute('href', '/it?adults=3#appartamenti');
    await link.click();
    await expect(page).toHaveURL(`${other}/it?adults=3#appartamenti`);
  },
);

test('a question the address names is open, below the header, also when the address changes', async ({
  page,
}) => {
  await page.goto(`${other}/it/domande#chiavi`);
  const keys = page.locator('details#chiavi');
  const arrival = page.locator('details#arrivo');
  await expect(keys).toHaveAttribute('open');
  await expect(keys.getByText('In una cassetta')).toBeVisible();
  await expect(arrival).not.toHaveAttribute('open');
  await expect(page.locator('html')).toHaveAttribute('data-started', '');
  const header = await page.locator('app-header').evaluate((h) => h.getBoundingClientRect().bottom);
  expect(await keys.evaluate((d) => d.getBoundingClientRect().top)).toBeGreaterThanOrEqual(header);
  await page.evaluate(() => (location.hash = 'arrivo'));
  await expect(arrival).toHaveAttribute('open');
  // A link to the question the address already names opens it, though the address stays.
  const link = arrival.getByRole('link', { name: 'dove trovarle' });
  await link.click();
  await expect(page).toHaveURL(/#chiavi$/);
  await keys.locator('summary').click();
  await expect(keys).not.toHaveAttribute('open');
  await link.click();
  await expect(keys).toHaveAttribute('open');
  // Followed into a new tab, it leaves this tab's question as it is.
  await keys.locator('summary').click();
  const opened = page.context().waitForEvent('page');
  await link.click({ modifiers: ['ControlOrMeta'] });
  await (await opened).close();
  await expect(keys).not.toHaveAttribute('open');
  // A question opens and closes by keyboard.
  await arrival.locator('summary').focus();
  await page.keyboard.press('Enter');
  await expect(arrival).not.toHaveAttribute('open');
});

test("the company page's picture is converted, fits a phone, and is credited", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 640 });
  await page.goto('/en/about');
  const picture = page.getByRole('img', { name: /^Saalbach in summer/ });
  await picture.scrollIntoViewIfNeeded();
  await expect
    .poll(() => picture.evaluate((img: HTMLImageElement) => img.naturalWidth))
    .toBeGreaterThan(0);
  expect(await picture.evaluate((img: HTMLImageElement) => img.currentSrc)).toMatch(
    /\/pictures\/pages\/saalbach-summer-\d+\.[0-9a-f]{8}\.webp$/,
  );
  const sizes = await page.evaluate(() => [
    document.documentElement.scrollWidth,
    document.documentElement.clientWidth,
  ]);
  expect(sizes[0]).toBeLessThanOrEqual(sizes[1]);
  await page.goto('/en/picture-credits');
  await expect(page.getByRole('link', { name: 'Saalbach from above.jpg' })).toHaveAttribute(
    'href',
    'https://commons.wikimedia.org/wiki/File:Saalbach_from_above.jpg',
  );
});

test("the partner's logo keeps its set width and leads to the partner", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 640 });
  await page.goto('/en/about');
  const link = page.getByRole('link', { name: 'Skischule Musterberg' });
  await expect(link).toHaveAttribute('href', 'https://example.com/');
  const logo = link.getByRole('img');
  await logo.scrollIntoViewIfNeeded();
  await expect
    .poll(() => logo.evaluate((img: HTMLImageElement) => img.currentSrc))
    .toMatch(/\/pictures\/pages\/skischule-musterberg-(160|320)\.[0-9a-f]{8}\.webp$/);
  // The link, and with it the focus ring, is as large as the logo.
  const box = await logo.boundingBox();
  expect(box?.width).toBe(160);
  expect(await link.boundingBox()).toEqual(box);
});

test("the FAQ's list leads to its groups and a question's address opens it, below the header", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 640 });
  const below = (target: ReturnType<typeof page.locator>) =>
    expect
      .poll(async () => {
        const header = await page
          .locator('app-header')
          .evaluate((h) => h.getBoundingClientRect().bottom);
        const top = await target.evaluate((t) => t.getBoundingClientRect().top);
        return top >= header && top < header + 48;
      })
      .toBe(true);
  await page.goto('/en/faq?adults=3');
  await expect(page.locator('html')).toHaveAttribute('data-started', '');
  const link = page.getByRole('link', { name: 'Getting here' });
  await expect(link).toHaveAttribute('href', '/en/faq?adults=3#getting-here');
  await link.click();
  await expect(page).toHaveURL(/\/en\/faq\?adults=3#getting-here$/);
  await below(page.getByRole('heading', { level: 2, name: 'Getting here' }));
  // By keyboard too.
  await page.getByRole('link', { name: 'Arrival' }).focus();
  await page.keyboard.press('Enter');
  await below(page.getByRole('heading', { level: 2, name: 'Arrival' }));
  await page.goto('/de/haeufige-fragen#parking');
  const parking = page.locator('details#parking');
  await expect(parking).toHaveAttribute('open');
  await below(parking);
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
});

test("the FAQ's groups and its note open with an icon the heading's name leaves out, in both languages", async ({
  page,
}) => {
  for (const [path, name, id, note] of [
    ['/en/faq', 'Booking and payment', 'booking-and-payment', 'Firn & Farn is made up'],
    [
      '/de/haeufige-fragen',
      'Buchung und Zahlung',
      'buchung-und-zahlung',
      'Firn & Farn ist erfunden',
    ],
  ]) {
    await page.goto(path);
    const heading = page.getByRole('heading', { level: 2, name, exact: true });
    await expect(heading).toHaveAttribute('id', id);
    await expect(heading.locator('svg.icon[aria-hidden="true"]')).toBeVisible();
    const icon = page.locator('.note', { hasText: note }).locator('svg.icon');
    await expect(icon).toBeVisible();
    // In soft ink, as every icon beside text: the accent is for what a visitor can act on.
    const ink = await heading.locator('svg.icon').evaluate((svg) => getComputedStyle(svg).color);
    await expect(icon).toHaveCSS('color', ink);
  }
});

test('a question opens with a transition where the browser eases to auto, at once with reduced motion', async ({
  page,
}) => {
  const durations = () =>
    page.locator('details#price').evaluate((details) => ({
      answer: getComputedStyle(details, '::details-content').transitionDuration,
      arrow: getComputedStyle(details.querySelector('summary')!, '::after').transitionDuration,
    }));
  await page.goto('/en/faq');
  if (await page.evaluate(() => CSS.supports('interpolate-size: allow-keywords')))
    await expect.poll(durations).toMatchObject({ answer: '0.3s, 0.3s' });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect.poll(durations).toEqual({ answer: '0s', arrow: '0s' });
});

test("an apartment's page a fold links to is public, with the visitor's choice, in both languages", async ({
  page,
}) => {
  await page.goto('/en/apartments/zirbe?adults=3');
  await page.getByRole('button', { name: 'Getting here' }).click();
  await page.getByRole('link', { name: 'Getting to Zirbe' }).click();
  await expect(page).toHaveURL('/en/apartments/zirbe/getting-here?adults=3');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Getting to Zirbe');
  await expect(page).toHaveTitle('Getting to Zirbe · Firn & Farn');
  await expect(page.locator('meta[name=robots]')).toHaveCount(0);
  await toLanguage(page, 'Language: English', 'Deutsch');
  await expect(page).toHaveURL('/de/wohnungen/zirbe/anfahrt?adults=3');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Anfahrt zur Zirbe');
  await expect(page.locator('meta[name=robots]')).toHaveCount(0);
});

test('an unlisted page is not indexed and linked from nowhere, and only its apartment has it', async ({
  page,
}) => {
  await page.goto('/en/apartments/zirbe');
  await page.getByRole('button', { name: 'Getting here' }).click();
  await expect(page.getByRole('link', { name: 'Getting to Zirbe' })).toBeVisible();
  await expect(page.locator('a[href*="/guide"]')).toHaveCount(0);
  await page.goto('/de/wohnungen/zirbe/wohnungsmappe');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Ihre Wohnungsmappe zur Zirbe');
  await expect(page.locator('meta[name=robots]')).toHaveAttribute('content', 'noindex');
  await toLanguage(page, 'Sprache: Deutsch', 'English');
  await expect(page).toHaveURL('/en/apartments/zirbe/guide');
  await expect(page.locator('meta[name=robots]')).toHaveAttribute('content', 'noindex');
  // A page the footer links is indexed again after a navigation in the page.
  await page.getByRole('contentinfo').getByRole('link', { name: 'Imprint' }).click();
  await expect(page).toHaveURL('/en/imprint');
  await expect(page.locator('meta[name=robots]')).toHaveCount(0);
  expect((await page.goto('/en/apartments/laerche/guide'))!.status()).toBe(404);
  await page.goto('/en/apartments/laerche');
  await expect(page.getByRole('button', { name: 'Getting here' })).toHaveCount(0);
});

test(
  "an apartment's page opens while Beds24 cannot be reached",
  { tag: '@any-engine' },
  async ({ page }) => {
    const response = await page.goto('http://localhost:4001/en/apartments/zirbe/getting-here');
    expect(response!.status()).toBe(200);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Getting to Zirbe');
  },
);

// One test per page and width, as the apartment page's scans.
for (const path of [
  '/de/wohnungen/zirbe/anfahrt',
  '/en/apartments/zirbe/getting-here',
  '/de/wohnungen/zirbe/wohnungsmappe',
  '/en/apartments/zirbe/guide',
])
  for (const width of [320, 1280])
    test(
      `${path} passes axe at ${width} px in both seasons`,
      { tag: '@any-engine' },
      async ({ page }) => {
        await page.setViewportSize({ width, height: 800 });
        for (const season of ['winter', 'summer']) {
          await page.goto(`${path}?season=${season}`);
          const { violations } = await new AxeBuilder({ page }).analyze();
          expect(violations, `in ${season}`).toEqual([]);
        }
      },
    );
