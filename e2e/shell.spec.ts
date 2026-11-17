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
      [de, 'de-AT'],
      [en, 'en-GB'],
    ]) {
      const response = await request.get(path);
      expect(response.status(), path).toBe(200);
      const html = await response.text();
      expect(html, path).toContain(`<html lang="${lang}"`);
      expect(html, path).toMatch(/<h1[^>]*>[^<]+<\/h1>/);
      // A stylesheet loaded after the first paint makes the text change its font.
      expect(html, path).not.toContain('media="print"');
      expect(html, path).toContain(
        '<link rel="preload" as="font" type="font/woff2" href="/fonts/jost-latin-wght-normal.woff2" crossorigin="">',
      );
      expect(html, path).toContain(`<link rel="alternate" hreflang="de-AT" href="${de}">`);
      expect(html, path).toContain(`<link rel="alternate" hreflang="en-GB" href="${en}">`);
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

test('an unknown language answers the not-found page in the browser language, else the first', async ({
  browser,
}) => {
  for (const [locale, title, home, href] of [
    ['en-GB', 'Page not found', 'To the home page', '/en'],
    ['fr-FR', 'Seite nicht gefunden', 'Zur Startseite', '/de'],
  ]) {
    const context = await browser.newContext({ locale });
    const page = await context.newPage();
    expect((await page.goto('/fr/quelque-chose'))?.status()).toBe(404);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(title);
    await expect(page.getByRole('link', { name: home })).toHaveAttribute('href', href);
    await context.close();
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
  await expect(footer.getByRole('link', { name: '+43 000 0000000' })).toBeVisible();
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
  await expect(page.locator('html')).toHaveAttribute('lang', 'en-GB');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Lärche');
});

test('a link to the home page from another page shows the apartments', async ({ page }) => {
  await page.goto('/de/impressum');
  await page.getByRole('link', { name: 'Firn & Farn', exact: true }).click();
  await expect(page).toHaveURL('/de');
  await expect(page.locator('section:has(#wohnungen) li')).toHaveText(['Zirbe', 'Lärche', 'Ahorn']);
});

test('the heading follows from one apartment to the next', async ({ page }) => {
  await page.goto('/de/wohnungen/zirbe');
  const go = async (name: string) => {
    if (await folded(page)) {
      await page.getByRole('button', { name: 'Menü' }).click();
      await page.getByRole('dialog').getByRole('link', { name }).click();
    } else {
      await open(page, 'Wohnungen');
      await page.getByRole('link', { name }).click();
    }
  };
  await go('Lärche');
  await expect(page).toHaveURL('/de/wohnungen/laerche');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Lärche');
  await expect(page).toHaveTitle('Lärche · Firn & Farn');
});

test('the apartments menu opens by keyboard and leads to an apartment', async ({ page }) => {
  await page.goto('/de');
  test.skip(await folded(page), 'the wide header only');
  const menu = await open(page, 'Wohnungen');
  expect(await menu.evaluate((e) => getComputedStyle(e).outlineStyle)).toBe('solid');
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

test('narrower than 320 px the page keeps its 320 px layout and scrolls sideways', async ({
  page,
}) => {
  await page.setViewportSize({ width: 280, height: 480 });
  await page.goto('/de');
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(320);
  expect(await page.locator('app-header').evaluate((header) => header.offsetWidth)).toBe(320);
});

test('an address with an anchor opens at its section, and a jump in the page is smooth', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  // The page as the first frame shows it, before the application has started.
  await page.addInitScript(() => {
    requestAnimationFrame(() => {
      const header = document.querySelector('app-header')!;
      (window as unknown as { first: unknown }).first = {
        y: scrollY,
        over: header.hasAttribute('data-over'),
        gap:
          document.getElementById('free-weeks')!.getBoundingClientRect().top -
          header.getBoundingClientRect().bottom,
      };
    });
  });
  await page.goto('/en#free-weeks');
  const first = await page.evaluate(
    () => (window as unknown as { first: { y: number; over: boolean; gap: number } }).first,
  );
  expect(first.y).toBeGreaterThan(0);
  expect(first.over).toBe(false);
  expect(Math.abs(first.gap)).toBeLessThanOrEqual(1);
  await page.waitForTimeout(500);
  expect(await page.evaluate(() => scrollY)).toBe(first.y);

  // The hero's button jumps smoothly, unless motion is reduced.
  const positions = async () => {
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
    await page.evaluate(() => {
      const seen = ((window as unknown as { seen: number[] }).seen = []);
      const tick = () => {
        seen.push(Math.round(scrollY));
        if (seen.length < 60) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });
    await page.getByRole('link', { name: 'See the free weeks' }).click();
    await page.waitForTimeout(1200);
    return new Set(await page.evaluate(() => (window as unknown as { seen: number[] }).seen)).size;
  };
  expect(await positions()).toBeGreaterThan(5);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  expect(await positions()).toBeLessThanOrEqual(2);
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
        const heading = document.querySelector('#lage')!.getBoundingClientRect().top;
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
  await expect(page.locator('link[hreflang="nl-BE"]')).toHaveAttribute('href', '/nl');
  await expect(page.getByRole('link', { name: 'Casa Prova' })).toBeVisible();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Appartamenti per le vacanze');
  await expect(page.getByText('Demo:')).toHaveCount(0);
  // This site lists no address and no phone: the footer shows the name and the email.
  const footer = page.getByRole('contentinfo');
  await expect(footer.getByRole('link', { name: 'ciao@casa-prova.example' })).toBeVisible();
  await expect(footer.locator('a[href^="tel:"]')).toHaveCount(0);
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

// Every tab stop shows the ring: on the element, or on what it draws for a hidden input.
test('every tab stop on the home page shows a focus ring', async ({ page, browserName }) => {
  test.skip(browserName === 'webkit', 'Safari tabs only to fields unless told otherwise');
  await page.goto('/en');
  const seen: string[] = [];
  for (let i = 0; i < 80; i++) {
    await page.keyboard.press('Tab');
    const stop = await page.evaluate(() => {
      const element = document.activeElement as HTMLElement | null;
      if (!element || element === document.body) return null;
      const parts = [
        element,
        element.nextElementSibling,
        element.closest('.season-switch'),
        ...element.children,
      ].filter(Boolean) as Element[];
      const ring = parts.some((part) => {
        const style = getComputedStyle(part);
        return style.outlineStyle !== 'none' && parseFloat(style.outlineWidth) >= 2;
      });
      const name = `${element.tagName.toLowerCase()} ${element.textContent?.trim().slice(0, 30) || element.getAttribute('aria-label') || ''}`;
      return { name, ring };
    });
    if (!stop || seen.includes(stop.name)) break;
    seen.push(stop.name);
    expect(stop.ring, stop.name).toBe(true);
  }
  expect(seen.length).toBeGreaterThan(5);
});

test('a click on the page does not take the focus to the main element', async ({ page }) => {
  await page.goto('/en');
  await page.getByRole('heading', { name: /^Free weeks/ }).click();
  expect(await page.evaluate(() => document.activeElement?.tagName)).not.toBe('MAIN');
  // The skip link still takes it there.
  await page.getByRole('link', { name: 'Skip to the content' }).focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('main')).toBeFocused();
});
