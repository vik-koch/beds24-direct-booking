import { readdirSync, readFileSync } from 'node:fs';
import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

// The site map's table: every page in both languages.
const pages = [
  ['/de', '/en'],
  ['/de/wohnungen/zirbe', '/en/apartments/zirbe'],
  ['/de/wohnungen/zirbe/buchen', '/en/apartments/zirbe/book'],
  ['/de/buchungsbestaetigung', '/en/booking-confirmation'],
  ['/de/haeufige-fragen', '/en/faq'],
  ['/de/ueber-uns', '/en/about'],
  ['/de/impressum', '/en/imprint'],
  ['/de/datenschutz', '/en/privacy'],
  ['/de/agb', '/en/terms'],
  ['/de/bildnachweis', '/en/picture-credits'],
];

const axe = async (page: Page) => (await new AxeBuilder({ page }).analyze()).violations;

// Opens a menu of the wide header by keyboard. A press during hydration can be undone by it,
// so the menu must still be open a moment later.
async function open(page: Page, name: string) {
  const menu = page.getByRole('button', { name });
  await expect(async () => {
    await menu.focus();
    if ((await menu.getAttribute('aria-expanded')) !== 'true') await page.keyboard.press('Enter');
    await expect(menu).toHaveAttribute('aria-expanded', 'true', { timeout: 500 });
    await page.waitForTimeout(300);
    await expect(menu).toHaveAttribute('aria-expanded', 'true', { timeout: 100 });
  }).toPass();
  return menu;
}

// The header is folded where there is no hover or less than 64rem of width.
const folded = (page: Page) => page.getByRole('button', { name: 'Menü' }).isVisible();

test('every page of the site map answers in both languages and names the other', async ({
  request,
}) => {
  for (const [de, en] of pages)
    for (const [path, lang] of [
      [de, 'de'],
      [en, 'en'],
    ]) {
      const response = await request.get(path);
      expect(response.status(), path).toBe(200);
      const html = await response.text();
      expect(html, path).toContain(`<html lang="${lang}"`);
      expect(html, path).toMatch(/<h1[^>]*>[^<]+<\/h1>/);
      expect(html, path).toContain(`<link rel="alternate" hreflang="de" href="${de}">`);
      expect(html, path).toContain(`<link rel="alternate" hreflang="en" href="${en}">`);
    }
});

test('the bare address redirects to the browser language, else to the first', async ({
  request,
}) => {
  const to = async (accept: string) =>
    (await request.get('/', { headers: { 'Accept-Language': accept }, maxRedirects: 0 })).headers()[
      'location'
    ];
  expect(await to('en-GB,en;q=0.9,de;q=0.5')).toBe('/en');
  expect(await to('fr-FR,fr;q=0.9')).toBe('/de');
});

test('an unknown address and an unknown apartment answer 404', async ({ request }) => {
  for (const path of ['/de/nichts', '/en/apartments/nothing', '/xx']) {
    expect((await request.get(path)).status(), path).toBe(404);
  }
});

test('the home page comes from the server with the apartments, the notice and the footer', async ({
  page,
  request,
}) => {
  const html = await (await request.get('/de')).text();
  for (const name of ['Zirbe', 'Lärche', 'Ahorn']) expect(html).toContain(`<li>${name}</li>`);

  await page.goto('/de');
  await expect(page.getByText('Demo: Firn & Farn ist erfunden.')).toBeVisible();
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  const footer = page.getByRole('contentinfo');
  await expect(footer.getByRole('link', { name: 'Impressum' })).toHaveAttribute(
    'href',
    '/de/impressum',
  );
  await expect(footer.getByText('5753 Saalbach')).toBeVisible();
  expect(await axe(page)).toEqual([]);

  await page.goto('/en/privacy');
  expect(await axe(page)).toEqual([]);
});

test('the language menu leads to the same page in the other language', async ({ page }) => {
  await page.goto('/de/wohnungen/laerche');
  if (await folded(page)) {
    await page.getByRole('button', { name: 'Menü' }).click();
    await expect(page.getByRole('link', { name: 'Deutsch' })).toHaveAttribute('aria-current');
    expect(await axe(page)).toEqual([]);
  } else {
    await open(page, 'Sprache: Deutsch');
    expect(await axe(page)).toEqual([]);
  }
  await page.getByRole('link', { name: 'English' }).click();
  await expect(page).toHaveURL('/en/apartments/laerche');
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Lärche');
});

test('the apartments menu opens by keyboard and leads to an apartment', async ({ page }) => {
  await page.goto('/de');
  test.skip(await folded(page), 'the wide header only');
  const menu = await open(page, 'Wohnungen');
  await expect(page.getByRole('link', { name: 'Zirbe' })).toBeVisible();
  await page.keyboard.press('Tab');
  await expect(page.getByRole('link', { name: 'Alle im Überblick' })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('link', { name: 'Zirbe' })).toBeHidden();
  await expect(menu).toBeFocused();

  await menu.hover();
  await page.getByRole('link', { name: 'Zirbe' }).click();
  await expect(page).toHaveURL('/de/wohnungen/zirbe');
});

test('at 320 px nothing scrolls sideways and a jump lands below the header', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 480 });
  await page.goto('/de/impressum');
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(320);

  await page.getByRole('button', { name: 'Menü' }).click();
  await page.getByRole('link', { name: 'Lage' }).click();
  await expect(page).toHaveURL('/de#lage');
  await expect(page.getByRole('dialog')).toBeHidden();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(320);
  await expect
    .poll(() =>
      page.evaluate(() => {
        const header = document.querySelector('app-header')!.getBoundingClientRect().bottom;
        const heading = document.querySelector('#lage h2')!.getBoundingClientRect().top;
        return heading >= header && heading < header + 120;
      }),
    )
    .toBe(true);
});

test('a second content folder changes languages, name, wording and theme', async ({
  page,
  request,
}) => {
  const other = 'http://localhost:4002';
  const to = await request.get(other, { maxRedirects: 0 });
  expect(to.headers()['location']).toBe('/it');
  expect((await request.get(`${other}/nl/voorwaarden`)).status()).toBe(200);
  expect((await request.get(`${other}/de`)).status()).toBe(404);

  await page.goto(`${other}/it`);
  await expect(page.locator('html')).toHaveAttribute('lang', 'it');
  await expect(page.getByRole('link', { name: 'Casa Prova' })).toBeVisible();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Appartamenti per le vacanze');
  await expect(page.getByText('Demo:')).toHaveCount(0);
  expect(await page.evaluate(() => getComputedStyle(document.body).backgroundColor)).toBe(
    'rgb(244, 241, 234)',
  );
  expect(await axe(page)).toEqual([]);
});

test('a refused token answers 503 without apartments', async ({ request }) => {
  const response = await request.get('http://localhost:4001/de');
  expect(response.status()).toBe(503);
  expect(await response.text()).not.toContain('<li>Zirbe</li>');
});

test('the browser bundle does not know the token', () => {
  const browser = 'dist/beds24-direct-booking/browser';
  const scripts = readdirSync(browser).filter((file) => file.endsWith('.js'));
  expect(scripts.length).toBeGreaterThan(0);
  for (const file of scripts)
    expect(readFileSync(`${browser}/${file}`, 'utf8')).not.toContain('BEDS24_TOKEN');
});
