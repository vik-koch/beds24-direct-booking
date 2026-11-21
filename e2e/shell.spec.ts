import { readdirSync, readFileSync } from 'node:fs';
import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Locator, type Page } from '@playwright/test';

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

// Opens a menu of the wide header by keyboard, once the application has started, with the
// pointer resting where its pane is attached before it is placed (#212).
async function open(page: Page, name: string) {
  const menu = page.getByRole('button', { name });
  await expect(page.locator('html')).toHaveAttribute('data-started', '');
  await page.mouse.move(0, 0);
  await menu.focus();
  await page.keyboard.press('Enter');
  await expect(menu).toHaveAttribute('aria-expanded', 'true');
  return menu;
}

// The header is folded where there is no hover or less than 64rem of width.
const folded = (page: Page) => page.getByRole('button', { name: 'Menü' }).isVisible();

test(
  'every page of the site map answers in both languages and names the other',
  { tag: '@any-engine' },
  async ({ request }) => {
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
  },
);

test(
  'the bare address redirects to the browser language, else to the first, with its query',
  { tag: '@any-engine' },
  async ({ request }) => {
    const to = async (accept: string, path = '/') =>
      (
        await request.get(path, { headers: { 'Accept-Language': accept }, maxRedirects: 0 })
      ).headers()['location'];
    expect(await to('en-GB,en;q=0.9,de;q=0.5')).toBe('/en');
    expect(await to('fr-FR,fr;q=0.9')).toBe('/de');
    expect(await to('en', '/?adults=3&children=1')).toBe('/en?adults=3&children=1');
  },
);

test(
  'an unknown address and an unknown apartment answer 404',
  { tag: '@any-engine' },
  async ({ request }) => {
    for (const path of ['/de/nichts', '/en/apartments/nothing', '/xx']) {
      expect((await request.get(path)).status(), path).toBe(404);
    }
  },
);

test(
  'an unknown language answers the not-found page in the browser language, else the first',
  { tag: '@any-engine' },
  async ({ browser }) => {
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
  },
);

test('the home page comes from the server with the apartments, the notice and the footer', async ({
  page,
  request,
}) => {
  const html = await (await request.get('/de')).text();
  for (const name of ['Zirbe', 'Lärche', 'Ahorn']) expect(html).toContain(`>${name}</a></h3>`);

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
    // Firefox 159 crashes on the fade that follows axe's run over the open menu, a state no
    // visitor's page is in: the change starts from a fresh page.
    await page.reload();
    await open(page, 'Sprache: Deutsch');
  }
  await page.getByRole('link', { name: 'English' }).click();
  await expect(page).toHaveURL('/en/apartments/laerche');
  await expect(page.locator('html')).toHaveAttribute('lang', 'en-GB');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Lärche');
  // Inside the app: the server's answer carried every language's texts.
  await expect(page.locator('.prose')).toContainText('on the second floor');
  await expect(page.locator('.rooms h3').first()).toHaveText('Bedroom 1');
});

// Where an element stands against the header's lower edge, in pixels.
const fromEdge = (target: Locator) =>
  target.evaluate(
    (element) =>
      element.getBoundingClientRect().top -
      document.querySelector('app-header')!.getBoundingClientRect().bottom,
  );

// Through the header's language menu, or the sheet where the header is folded. The menu
// button is pressed by its coordinates: a locator's click scrolls the sticky header's button
// "into view" and moves the page.
async function toLanguage(page: Page, current: string, other: string) {
  const menu = page.locator('.header-narrow .icon-button');
  if (await menu.isVisible()) {
    const box = (await menu.boundingBox())!;
    await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  } else await open(page, current);
  await page.getByRole('link', { name: other }).click();
}

const settled = (page: Page) =>
  expect.poll(() => page.evaluate(() => document.getAnimations().length)).toBe(0);

// The next season always has free weeks (weeks.spec.ts); the current one may be full.
async function toNextSeason(page: Page) {
  const season = await page.locator('html').getAttribute('data-season');
  await expect(page.locator('html')).toHaveAttribute('data-started', '');
  await page.locator('.other-season').click();
  await expect(page.locator('html')).not.toHaveAttribute('data-season', season!);
  await settled(page);
}

test('a language change keeps the place and the chosen week, and focuses the language control', async ({
  page,
}, { project }) => {
  await page.goto('/en');
  await toNextSeason(page);
  const widths = project.use.isMobile ? [project.use.viewport!.width] : [1280, 320];
  for (const [round, width] of widths.entries()) {
    await page.setViewportSize({ width, height: 800 });
    const stays = page.locator('.weeks-body:visible .stay:visible');
    // Another week each round, so the click chooses rather than clears.
    const stay = stays.nth(Math.floor((await stays.count()) / 2) + round);
    const pick = (await stay.getAttribute('data-pick'))!;
    await stay.locator('.price').click();
    // The week a little below the header's edge.
    await stay.evaluate((cell) => {
      const edge = document.querySelector('app-header')!.getBoundingClientRect().bottom;
      scrollBy({ top: cell.getBoundingClientRect().top - edge + 10, behavior: 'instant' });
    });
    const before = await fromEdge(stay);

    // The focus moves once the place is put back, so it is waited for first.
    const control = page.locator(width < 1024 ? '.header-narrow .icon-button' : '[data-language]');
    await toLanguage(page, 'Language: English', 'Deutsch');
    await expect(page.locator('html')).toHaveAttribute('lang', 'de-AT');
    await expect(control).toBeFocused();
    // The page takes no pointer while it fades.
    await settled(page);
    const same = page.locator(`.weeks-body:visible [data-pick="${pick}"]`);
    expect(Math.abs((await fromEdge(same)) - before), `${width}`).toBeLessThan(2);
    await expect(same).toHaveAttribute('aria-selected', 'true');
    await expect(page.locator('.pick')).toBeVisible();

    // And back, from a section's heading, as far down as the page goes.
    const heading = page.locator('main').getByRole('heading', { name: 'Wohnungen', exact: true });
    await heading.evaluate((element) => {
      const edge = document.querySelector('app-header')!.getBoundingClientRect().bottom;
      const box = element.getBoundingClientRect();
      scrollBy({ top: box.top + box.height / 2 - edge, behavior: 'instant' });
    });
    const middle = await fromEdge(heading);
    await toLanguage(page, 'Sprache: Deutsch', 'English');
    await expect(page.locator('html')).toHaveAttribute('lang', 'en-GB');
    await expect(control).toBeFocused();
    const back = page.locator('main').getByRole('heading', { name: 'Apartments', exact: true });
    expect(Math.abs((await fromEdge(back)) - middle), `${width}`).toBeLessThan(2);
  }
});

// The place is found by the element's place in <main>, on every page. Half as far down as the
// page goes, so that the page's end cannot hide a place that was not put back.
test('a language change keeps the place on a page besides the home page', async ({ page }, {
  project,
}) => {
  await page.goto('/en/picture-credits');
  for (const width of project.use.isMobile ? [project.use.viewport!.width] : [1280, 320]) {
    await page.setViewportSize({ width, height: 800 });
    for (const [from, to, lang] of [
      ['Language: English', 'Deutsch', 'de-AT'],
      ['Sprache: Deutsch', 'English', 'en-GB'],
    ]) {
      await page.evaluate(() =>
        scrollTo({
          top: (document.documentElement.scrollHeight - innerHeight) / 2,
          behavior: 'instant',
        }),
      );
      const credit = page.locator('main li').nth(1);
      const before = await fromEdge(credit);
      await toLanguage(page, from, to);
      await expect(page.locator('html')).toHaveAttribute('lang', lang);
      await settled(page);
      expect(Math.abs((await fromEdge(credit)) - before), `${width} to ${to}`).toBeLessThan(2);
    }
  }
});

test('on a phone a language change keeps the apartment of the chosen tab', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 800 });
  await page.goto('/en');
  await toNextSeason(page);
  const tabs = page.locator('.room-tabs input');
  await page.locator('.room-tabs label').nth(2).click();
  await expect(tabs.nth(2)).toBeChecked();
  // The radio is checked at once, its apartment's weeks a frame later.
  const stay = page.locator('.weeks-body:visible [data-pick]:visible').first();
  await expect(stay).toHaveAttribute('data-pick', /^2-/);
  const pick = (await stay.getAttribute('data-pick'))!;
  await stay.evaluate((cell) => {
    const edge = document.querySelector('app-header')!.getBoundingClientRect().bottom;
    scrollBy({ top: cell.getBoundingClientRect().top - edge + 10, behavior: 'instant' });
  });
  const before = await fromEdge(stay);
  await toLanguage(page, 'Language: English', 'Deutsch');
  await expect(page.locator('html')).toHaveAttribute('lang', 'de-AT');
  await settled(page);
  await expect(tabs.nth(2)).toBeChecked();
  const same = page.locator(`.weeks-body:visible [data-pick="${pick}"]`);
  expect(Math.abs((await fromEdge(same)) - before)).toBeLessThan(2);
});

// The home page's free weeks come with a full load only (ADR 6), so a 404's links, which lead
// there, load it.
test('from a missing page the language link loads the home page with its free weeks', async ({
  page,
}) => {
  await page.goto('/de/nichts');
  await toLanguage(page, 'Sprache: Deutsch', 'English');
  await expect(page).toHaveURL('/en');
  await expect(page.getByRole('grid', { name: 'Free weeks' })).toBeVisible();
});

test('a language change fades, and changes at once with reduced motion', async ({ page }) => {
  for (const motion of ['no-preference', 'reduce'] as const) {
    await page.emulateMedia({ reducedMotion: motion });
    await page.goto('/en');
    // A change during the first navigation would take the skip of its fade.
    await expect(page.locator('html')).toHaveAttribute('data-started', '');
    const supported = await page.evaluate(() => 'startViewTransition' in document);
    test.skip(!supported, 'no view transitions in this browser');
    // The number of the fade's animations, counted once it has started.
    await page.evaluate(() => {
      const start = document.startViewTransition.bind(document);
      document.startViewTransition = (update) => {
        const transition = start(update);
        void transition.ready.then(() => {
          (window as unknown as { fades: number }).fades = document
            .getAnimations()
            .filter(({ effect }) =>
              (effect as KeyframeEffect).pseudoElement?.startsWith('::view-transition'),
            ).length;
        });
        return transition;
      };
    });
    await toLanguage(page, 'Language: English', 'Deutsch');
    const fades = () => page.evaluate(() => (window as unknown as { fades?: number }).fades);
    await expect.poll(fades).toBeDefined();
    if (motion === 'reduce') expect(await fades()).toBe(0);
    else expect(await fades()).toBeGreaterThan(0);
  }
});

test(
  'a link to the home page from another page shows the apartments',
  { tag: '@any-engine' },
  async ({ page }) => {
    await page.goto('/de/impressum');
    await page.getByRole('link', { name: 'Firn & Farn', exact: true }).click();
    await expect(page).toHaveURL('/de');
    await expect(page.locator('section:has(#wohnungen) h3')).toHaveText([
      'Zirbe',
      'Lärche',
      'Ahorn',
    ]);
  },
);

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
  const zirbe = page.getByRole('navigation', { name: 'Wohnungen' }).getByRole('link', {
    name: 'Zirbe',
  });
  expect(await menu.evaluate((e) => getComputedStyle(e).outlineStyle)).toBe('solid');
  await expect(zirbe).toBeVisible();
  await page.keyboard.press('Tab');
  await expect(page.getByRole('link', { name: 'Alle im Überblick' })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(zirbe).toBeHidden();
  await expect(menu).toBeFocused();

  await menu.hover();
  await zirbe.click();
  await expect(page).toHaveURL('/de/wohnungen/zirbe');
});

test('the wordmark keeps one line on a phone', async ({ page }) => {
  for (const path of ['/de', '/de/bildnachweis', '/en', '/en/picture-credits']) {
    for (const season of ['winter', 'summer']) {
      await page.goto(`${path}?season=${season}`);
      for (const width of [320, 340, 360, 375, 384, 390]) {
        await page.setViewportSize({ width, height: 600 });
        const place = `${path} in ${season} at ${width}`;
        const { lines, end, next } = await page
          .locator('app-header a')
          .first()
          .evaluate((link) => {
            const range = document.createRange();
            range.selectNodeContents(link);
            const switcher = document.querySelector('app-header .season-switch')!;
            return {
              lines: range.getClientRects().length,
              end: range.getBoundingClientRect().right,
              next: switcher.getBoundingClientRect().left,
            };
          });
        expect(lines, place).toBe(1);
        expect(end, place).toBeLessThanOrEqual(next);
        expect(
          await page.locator('html').evaluate((html) => html.scrollWidth - html.offsetWidth),
          place,
        ).toBe(0);
      }
    }
  }
});

test('the wordmark, the hero card and the free weeks start on the 72rem column’s edge', async ({
  page,
}) => {
  for (const width of [1280, 1440, 1920]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/de');
    // The scrollbar's room is kept on every page, and the column is centred in the rest.
    const inner = await page.evaluate(() => document.documentElement.offsetWidth);
    const edge = (inner - 72 * 16) / 2 + 32;
    for (const selector of ['.wordmark', '.hero-copy', '.weeks-head'])
      expect(
        await page
          .locator(selector)
          .first()
          .evaluate((e) => e.getBoundingClientRect().left),
        `${selector} at ${width}`,
      ).toBe(edge);
  }
});

// Headless Firefox and the phone draw scrollbars over the page; Playwright hides Chromium's
// unless told otherwise.
test('the header stays in place between a long page and a short one', async ({
  playwright,
  browserName,
  baseURL,
}) => {
  test.skip(browserName !== 'chromium', 'only Chromium has a classic scrollbar here');
  const browser = await playwright.chromium.launch({ ignoreDefaultArgs: ['--hide-scrollbars'] });
  const page = await browser.newPage({ baseURL });
  // A larger default font size leaves the 320 px limit where it is.
  await (
    await page.context().newCDPSession(page)
  ).send('Page.setFontSizes', {
    fontSizes: { standard: 20 },
  });
  const bar = () => page.evaluate(() => innerWidth - document.documentElement.clientWidth);
  const scrolls = () => page.evaluate(() => document.documentElement.scrollHeight > innerHeight);
  const left = (selector: string) =>
    page.locator(selector).evaluate((e) => e.getBoundingClientRect().left);
  // The wordmark where the 72rem column, at 20 px a rem, has room on both sides; in a narrow
  // window, the menu button at the right.
  for (const [width, selector] of [
    [1600, '.wordmark'],
    [320, '.header-narrow .icon-button'],
  ] as const) {
    await page.setViewportSize({ width, height: 2000 });
    await page.goto('/en');
    expect(await bar(), `${width}`).toBeGreaterThan(0);
    const long = await left(selector);
    await page.goto('/en/picture-credits');
    expect(await scrolls(), `${width}`).toBe(false);
    expect(await left(selector), `${width}`).toBe(long);
  }
  // Narrower, a short page keeps its whole width, so nothing scrolls sideways.
  await page.setViewportSize({ width: 319, height: 2000 });
  expect(await scrolls()).toBe(false);
  expect(await bar()).toBe(0);
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth)).toBe(319);
  await browser.close();
});

test('narrower than 300 px the page keeps its 300 px layout and scrolls sideways', async ({
  page,
}) => {
  await page.setViewportSize({ width: 280, height: 480 });
  await page.goto('/de');
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth)).toBe(300);
  await expect.poll(() => page.locator('app-header').evaluate((e) => e.offsetWidth)).toBe(300);
});

test('a 320 px window with a classic scrollbar does not scroll sideways', async ({
  playwright,
  baseURL,
  browserName,
}) => {
  test.skip(browserName !== 'chromium', 'Only Chromium can show its scrollbars here.');
  const browser = await playwright.chromium.launch({ ignoreDefaultArgs: ['--hide-scrollbars'] });
  const page = await browser.newPage({ baseURL, viewport: { width: 320, height: 480 } });
  for (const path of ['/de', '/en/apartments/zirbe']) {
    await page.goto(path);
    // The scrollbar takes room, and the page fits in the rest.
    await expect
      .poll(
        () =>
          page.evaluate(() => {
            const { clientWidth, scrollWidth } = document.documentElement;
            return clientWidth < 320 && scrollWidth === clientWidth;
          }),
        { message: path },
      )
      .toBe(true);
  }
  await browser.close();
});

test('an address with an anchor opens at its section under a frosted header; smooth scrolling starts after it', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  // The page in the first frame that shows it, while the application's scripts are held back.
  // Frames before it may be hidden and lack the section, if the transfer pauses.
  const { promise: held, resolve: release } = Promise.withResolvers<void>();
  await page.route(/\/main-[\w-]+\.js$/, async (route) => {
    await held;
    await route.continue();
  });
  await page.addInitScript(() => {
    // Styles the header while it is still over the hero, as a browser may before the script at
    // the page's end places it, so that dropping data-over there would start its fade.
    new MutationObserver((_, observer) => {
      const header = document.querySelector('app-header');
      if (!header) return;
      header.getBoundingClientRect();
      observer.disconnect();
    }).observe(document, { childList: true, subtree: true });
    const sample = () => {
      if (!document.body || getComputedStyle(document.body).visibility !== 'visible')
        return requestAnimationFrame(sample);
      const header = document.querySelector('app-header');
      const section = document.getElementById('free-weeks');
      (window as unknown as { first: unknown }).first = {
        y: scrollY,
        behavior: getComputedStyle(document.documentElement).scrollBehavior,
        over: header?.hasAttribute('data-over') ?? true,
        ground: header
          ? `${getComputedStyle(header).backgroundColor} ${getComputedStyle(header).backdropFilter}`
          : '',
        // Not a number when a visible frame lacks the section or the header.
        gap:
          (section?.getBoundingClientRect().top ?? NaN) -
          (header?.getBoundingClientRect().bottom ?? NaN),
      };
    };
    requestAnimationFrame(sample);
  });
  await page.goto('/en#free-weeks', { waitUntil: 'commit' });
  const sampled = await page.waitForFunction(
    () => (window as unknown as { first?: unknown }).first,
  );
  const first = (await sampled.jsonValue()) as {
    y: number;
    behavior: string;
    over: boolean;
    ground: string;
    gap: number;
  };
  release();
  expect(first.y).toBeGreaterThan(0);
  expect(first.over).toBe(false);
  expect(Math.abs(first.gap)).toBeLessThanOrEqual(1);

  // Smooth scrolling comes with the application, after that first jump, and not with reduced
  // motion. Whether a browser then animates is its own affair. The page stays where it is.
  expect(first.behavior).toBe('auto');
  const behavior = () =>
    page.evaluate(() => getComputedStyle(document.documentElement).scrollBehavior);
  await expect.poll(behavior).toBe('smooth');
  await page.waitForTimeout(500);
  expect(await page.evaluate(() => scrollY)).toBe(first.y);
  // The first frame already showed the header's settled ground, not the start of a fade.
  expect(first.ground).toBe(
    await page.locator('app-header').evaluate((header) => {
      const style = getComputedStyle(header);
      return `${style.backgroundColor} ${style.backdropFilter}`;
    }),
  );

  // A reload after scrolling away opens at the section again, and stays there.
  await page.evaluate(() => scrollTo({ top: 2000, behavior: 'instant' }));
  await page.reload({ waitUntil: 'commit' });
  const reloaded = await page.waitForFunction(
    () => (window as unknown as { first?: unknown }).first,
  );
  const again = (await reloaded.jsonValue()) as typeof first;
  expect(again.y).toBe(first.y);
  expect(Math.abs(again.gap)).toBeLessThanOrEqual(1);
  await expect.poll(behavior).toBe('smooth');
  await page.waitForTimeout(500);
  expect(await page.evaluate(() => scrollY)).toBe(first.y);

  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect.poll(behavior).toBe('auto');
});

test('a page whose end never arrives is still shown', async ({ page }) => {
  await page.route('**/en', async (route) => {
    const response = await route.fetch();
    const html = await response.text();
    await route.fulfill({ response, body: html.slice(0, html.indexOf('</app-root>')) });
  });
  await page.goto('/en#free-weeks');
  await expect(page.locator('body')).toBeVisible();
});

test('without an anchor, jumps are smooth before the application has started', async ({ page }) => {
  await page.route(/\/main-[\w-]+\.js$/, () => undefined);
  await page.goto('/en', { waitUntil: 'commit' });
  await expect(page.locator('html')).toHaveCSS('scroll-behavior', 'smooth');
});

test('after an anchored arrival, a link pressed before the application starts scrolls smoothly', async ({
  page,
}) => {
  await page.route(/\/main-[\w-]+\.js$/, () => undefined);
  await page.goto('/en#free-weeks', { waitUntil: 'commit' });
  const html = page.locator('html');
  await expect(page.locator('body')).toBeVisible();
  await expect(html).toHaveCSS('scroll-behavior', 'auto');
  // The hero's link, which every layout shows; the header's are in a menu on a phone.
  await page.getByRole('link', { name: 'See the free weeks' }).click();
  await expect(html).toHaveCSS('scroll-behavior', 'smooth');
});

test('without JavaScript, jumps are smooth', async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  await page.goto('/en');
  await expect(page.locator('html')).toHaveCSS('scroll-behavior', 'smooth');
  await context.close();
});

test('a fragment cleared while the page loads leaves it shown', async ({ page }) => {
  // As if the visitor left the anchor before the script at the page's end had run.
  await page.route('**/en', async (route) => {
    const response = await route.fetch();
    const clear = '<script>history.replaceState(null, "", location.pathname)</script>';
    await route.fulfill({
      response,
      body: (await response.text()).replace('<app-root', clear + '<app-root'),
    });
  });
  await page.goto('/en#free-weeks');
  await expect(page.locator('body')).toBeVisible();
});

test('an anchor that cannot be decoded opens the page at its top', async ({ page }) => {
  const errors: Error[] = [];
  page.on('pageerror', (error) => errors.push(error));
  await page.goto('/en#50%');
  await expect(page.locator('body')).toBeVisible();
  expect(await page.evaluate(() => scrollY)).toBe(0);
  expect(errors).toEqual([]);
});

test('at 320 px nothing scrolls sideways and a jump lands below the header', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 480 });
  await page.goto('/de/impressum');
  const sideways = () =>
    page.locator('html').evaluate((html) => html.scrollWidth - html.offsetWidth);
  await expect.poll(sideways).toBe(0);

  await page.getByRole('button', { name: 'Menü' }).click();
  await page.getByRole('link', { name: 'Lage' }).click();
  await expect(page).toHaveURL('/de#lage');
  await expect(page.getByRole('dialog')).toBeHidden();
  await expect.poll(sideways).toBe(0);
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

// The name's link ends inside its slot, which the header's other parts leave it at their own
// width, each on one line, and the page does not scroll sideways.
async function nameFits(page: Page) {
  await page.evaluate(() => document.fonts.ready);
  const { link, slot, wrapped, scroll } = await page.evaluate(() => ({
    link: document.querySelector('.wordmark a')!.getBoundingClientRect().right,
    slot: document.querySelector('.wordmark')!.getBoundingClientRect().right,
    wrapped: [...document.querySelectorAll('app-header :is(a, button, label)')]
      .filter((e) => e.checkVisibility() && e.textContent!.trim())
      .filter((e) => {
        // Visible text only: an icon beside it sits higher.
        const walker = document.createTreeWalker(e, NodeFilter.SHOW_TEXT);
        const tops = new Set<number>();
        for (let node = walker.nextNode(); node; node = walker.nextNode()) {
          if (node.parentElement!.closest('.sr-only')) continue;
          const range = document.createRange();
          range.selectNodeContents(node);
          for (const rect of range.getClientRects()) if (rect.width) tops.add(Math.round(rect.top));
        }
        return tops.size > 1;
      })
      .map((e) => e.textContent!.trim()),
    scroll: document.documentElement.scrollWidth - document.documentElement.offsetWidth,
  }));
  expect(link).toBeLessThanOrEqual(slot);
  expect(wrapped).toEqual([]);
  expect(scroll).toBe(0);
}

test('a site name of 15 wide letters fits the header beside the season switch', async ({
  page,
}) => {
  // Set on the server's page, with the application held back so that it keeps the name.
  const name = 'Wohnen am Walde';
  await page.route(/\/main-[\w-]+\.js$/, (route) => route.abort());
  await page.goto('/de');
  await page.evaluate((name) => {
    const wordmark = document.querySelector<HTMLElement>('.wordmark')!;
    wordmark.style.setProperty('--letters', String(name.length));
    wordmark.querySelector('a')!.textContent = name;
  }, name);
  // 320 px shows the switch's icons, 384 px its label; the wide header starts at 1,024 px.
  for (const width of [320, 384, 1024])
    for (const season of ['winter', 'summer']) {
      await page.setViewportSize({ width, height: 800 });
      await page.evaluate(
        (name) => document.documentElement.setAttribute('data-season', name),
        season,
      );
      await nameFits(page);
    }
});

test('the test site’s name at its limit fits the header', async ({ page }) => {
  await page.goto('http://localhost:4002/it');
  for (const width of [320, 1280]) {
    await page.setViewportSize({ width, height: 800 });
    await nameFits(page);
  }
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
  await expect(page.getByRole('link', { name: 'Casa Prova Alta' })).toBeVisible();
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

test(
  'a refused token answers 503 with the apartments of the content and nothing of Beds24',
  { tag: '@any-engine' },
  async ({ request }) => {
    const response = await request.get('http://localhost:4001/de');
    expect(response.status()).toBe(503);
    const html = await response.text();
    expect(html).toContain('>Zirbe</a></h3>');
    expect(html).not.toContain('Bis 2 Gäste');
  },
);

test(
  'a site with a password answers only with it, under any user name',
  { tag: '@any-engine' },
  async ({ request }) => {
    const as = (credentials?: string) =>
      credentials ? { authorization: `Basic ${btoa(credentials)}` } : {};
    for (const path of ['/en', '/pictures/icon-winter.svg']) {
      for (const credentials of [undefined, 'guest:wrong', 'under test']) {
        const response = await request.get(`http://localhost:4004${path}`, {
          headers: as(credentials),
        });
        expect(response.status()).toBe(401);
        expect(response.headers()['www-authenticate']).toMatch(/^Basic /);
      }
      for (const credentials of ['guest:under test', ':under test']) {
        const response = await request.get(`http://localhost:4004${path}`, {
          headers: as(credentials),
        });
        expect(response.status()).toBe(200);
        expect(response.headers()['cache-control']).toBe('private, no-store');
      }
    }
    const page = await request.get('http://localhost:4004/en', {
      headers: as('guest:under test'),
    });
    expect(await page.text()).toContain('Zirbe');
  },
);

test(
  "an apartment picture is served converted, with a year's cache, and its source is not",
  { tag: '@any-engine' },
  async ({ request }) => {
    const pictures = readdirSync('dist/beds24-direct-booking/browser/pictures/apartments');
    const name = pictures.find((file) => /^zirbe-1-480\.[0-9a-f]{8}\.webp$/.test(file));
    const response = await request.get(`/pictures/apartments/${name}`);
    expect(response.status()).toBe(200);
    expect(response.headers()['content-type']).toBe('image/webp');
    expect(response.headers()['cache-control']).toBe('public, max-age=31536000');
    expect((await request.get('/pictures/zirbe-1.webp')).status()).toBe(404);
  },
);

test('the browser bundle does not know the token', { tag: '@any-engine' }, () => {
  const browser = 'dist/beds24-direct-booking/browser';
  const scripts = readdirSync(browser).filter((file) => file.endsWith('.js'));
  expect(scripts.length).toBeGreaterThan(0);
  for (const file of scripts)
    expect(readFileSync(`${browser}/${file}`, 'utf8')).not.toContain('BEDS24_TOKEN');
});

// Every tab stop shows the ring: on the element, on what it draws for a hidden input, or on the
// card or pill it stands for.
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
        element.closest('.season-switch, .teaser, .count'),
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
