import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

const axe = async (page: Page) => (await new AxeBuilder({ page }).analyze()).violations;
const season = (page: Page) => page.locator('html').getAttribute('data-season');
const stored = (page: Page) => page.evaluate(() => localStorage.getItem('season'));
// The glide and the fades have ended, so axe measures the final colours.
const settled = (page: Page) =>
  expect.poll(() => page.evaluate(() => document.getAnimations().length)).toBe(0);
const store = (page: Page, value: string) =>
  page.addInitScript((v) => localStorage.setItem('season', v), value);

// The demo: winter from 1 September, summer from 1 April. Noon, so no time zone moves the day.
const november = new Date(2026, 10, 16, 12);
const july = new Date(2027, 6, 1, 12);

// Switches by clicking the season's side of the pill, once the application has started.
async function switchTo(page: Page, name: 'winter' | 'summer') {
  await expect(page.locator('html')).toHaveAttribute('data-started', '');
  await page.locator(`.season-switch label[data-for=${name}]`).click();
  await expect(page.locator('html')).toHaveAttribute('data-season', name);
}

test(
  'the season follows the date, on server-rendered and prerendered pages',
  { tag: '@any-engine' },
  async ({ page }) => {
    await page.clock.setFixedTime(july);
    for (const path of ['/de', '/de/bildnachweis']) {
      await page.goto(path);
      expect(await season(page)).toBe('summer');
    }
    await page.clock.setFixedTime(november);
    await page.goto('/en');
    expect(await season(page)).toBe('winter');
    await expect(page.getByRole('radio', { name: 'Winter' })).toBeChecked();
  },
);

test('the season is chosen before the application starts', async ({ page }) => {
  await page.clock.setFixedTime(july);
  // Hold the application's scripts back: only the inline script in the head runs.
  await page.route(/\/(main|chunk)-[\w-]+\.js$/, () => undefined);
  // Module scripts hold DOMContentLoaded back, so wait for the answer only.
  await page.goto('/de', { waitUntil: 'commit' });
  await expect(page.locator('html')).toHaveAttribute('data-season', 'summer');
  await expect(page.locator('html')).toHaveAttribute('data-script', '');
  // The server checked winter by its own date; the pill must show summer all the same.
  await expect(page.locator('label[data-for=summer] .season-name')).toHaveCSS('opacity', '1');
  await expect(page.locator('label[data-for=winter] .season-name')).toHaveCSS('opacity', '0');
  await expect(page.getByRole('img', { name: /Almwiese/ })).toBeVisible();
  await expect(page.getByRole('img', { name: /Glemmtal/ })).toBeHidden();
});

test('one click before the application starts is not lost', async ({ page }) => {
  await page.clock.setFixedTime(november);
  const { promise: held, resolve: release } = Promise.withResolvers<void>();
  await page.route(/\/main-[\w-]+\.js$/, async (route) => {
    await held;
    await route.continue();
  });
  await page.goto('/de', { waitUntil: 'commit' });
  await page.locator('.season-switch label[data-for=summer]').click();
  release();
  await expect(page.locator('html')).toHaveAttribute('data-season', 'summer');
  await expect.poll(() => stored(page)).toContain('summer-2027');
});

// The server checks its own day's season. When the script chooses the other one, the radio
// the visitor clicks is still checked from the server, so the click brings no change event.
test('a click on the season the server checked is not lost either', async ({ page, request }) => {
  const served = (await (await request.get('/de')).text()).match(/data-season="(\w+)"/)![1];
  const other = served === 'winter' ? 'summer' : 'winter';
  await page.clock.setFixedTime(other === 'summer' ? july : november);
  const { promise: held, resolve: release } = Promise.withResolvers<void>();
  await page.route(/\/main-[\w-]+\.js$/, async (route) => {
    await held;
    await route.continue();
  });
  await page.goto('/de', { waitUntil: 'commit' });
  await expect(page.locator('html')).toHaveAttribute('data-season', other);
  await page.locator(`.season-switch label[data-for=${served}]`).click();
  release();
  await expect(
    page.getByRole('radio', { name: served === 'winter' ? 'Winter' : 'Sommer' }),
  ).toBeChecked();
  await expect(page.locator('html')).toHaveAttribute('data-season', served);
});

test('without JavaScript the header keeps its ground over the hero', async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  await page.goto('/de');
  const ground = await page
    .locator('app-header')
    .evaluate((header) => getComputedStyle(header).backgroundColor);
  expect(ground).not.toBe('rgba(0, 0, 0, 0)');
  await context.close();
});

test(
  'a switch changes the page, is remembered, and wins over the date',
  { tag: '@any-engine' },
  async ({ page }) => {
    await page.clock.setFixedTime(november);
    await page.goto('/de');
    await expect(page.getByRole('img', { name: /Glemmtal/ })).toBeVisible();
    await switchTo(page, 'summer');
    await expect(page.getByRole('img', { name: /Almwiese/ })).toBeVisible();
    await expect(page.getByRole('img', { name: /Glemmtal/ })).toBeHidden();
    await expect(page.getByRole('radio', { name: 'Sommer' })).toBeChecked();
    expect(JSON.parse((await stored(page))!)).toEqual({ season: 'summer-2027', on: '2026-11-16' });

    // Another page, and the other language, open in the chosen season.
    await page.goto('/en/picture-credits');
    expect(await season(page)).toBe('summer');
    await expect(page.getByRole('radio', { name: 'Summer' })).toBeChecked();
  },
);

test('the switch works by keyboard', async ({ page }) => {
  await page.clock.setFixedTime(november);
  await page.goto('/en');
  await expect(page.locator('html')).toHaveAttribute('data-started', '');
  await page.getByRole('radio', { name: 'Winter' }).focus();
  await page.keyboard.press('ArrowRight');
  await expect(page.locator('html')).toHaveAttribute('data-season', 'summer');
  await expect(page.getByRole('radio', { name: 'Summer' })).toBeFocused();
  await settled(page);
  expect(await axe(page)).toEqual([]);
});

test('a switch on a scrolled page keeps its place, and focus in the page lands below the header', async ({
  page,
}) => {
  await page.clock.setFixedTime(november);
  const at = () => page.evaluate(() => Math.round(window.scrollY));
  const scrollTo = (top: number) =>
    page.evaluate((y) => window.scrollTo({ top: y, behavior: 'instant' }), top);
  for (const width of [1280, 320]) {
    await page.setViewportSize({ width, height: 700 });
    await page.goto('/en');
    await scrollTo(832);
    // By the pointer at the label's place: a locator's click would first scroll it into view
    // itself, which WebKit does even for the sticky header.
    await expect(page.locator('html')).toHaveAttribute('data-started', '');
    const box = (await page.locator('.season-switch label[data-for=summer]').boundingBox())!;
    await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
    await expect(page.locator('html')).toHaveAttribute('data-season', 'summer');
    await settled(page);
    expect(await at(), `click at ${width}`).toBe(832);

    await page.getByRole('radio', { name: 'Summer' }).focus();
    await page.keyboard.press('ArrowLeft');
    await expect(page.locator('html')).toHaveAttribute('data-season', 'winter');
    await settled(page);
    expect(await at(), `keyboard at ${width}`).toBe(832);

    // A control in the page that lies under the header comes out below it when focused.
    const control = page.getByRole('link', { name: 'See the free weeks' });
    const top = await control.evaluate((element) => element.getBoundingClientRect().top);
    await scrollTo((await at()) + top - 20);
    await control.focus();
    await expect
      .poll(() =>
        page.evaluate(
          () =>
            document.activeElement!.getBoundingClientRect().top >=
            document.querySelector('app-header')!.getBoundingClientRect().bottom,
        ),
      )
      .toBe(true);
  }
});

test(
  'a link that names a season wins and lasts for the visit',
  { tag: '@any-engine' },
  async ({ page }) => {
    await page.clock.setFixedTime(november);
    await store(page, JSON.stringify({ season: 'winter-2026', on: '2026-11-15' }));
    await page.goto('/de?season=summer');
    expect(await season(page)).toBe('summer');
    await expect.poll(() => stored(page)).toContain('summer-2027');

    // A switch takes the link's season out of the address, or a reload would bring it back.
    await switchTo(page, 'winter');
    await expect(page).toHaveURL('/de');
    await page.reload();
    expect(await season(page)).toBe('winter');
  },
);

test(
  'the tab shows the season’s icon, from the server on and after a switch',
  { tag: '@any-engine' },
  async ({ page, request }) => {
    const served = await (await request.get('/en')).text();
    const name = served.match(/data-season="(\w+)"/)![1] as 'winter' | 'summer';
    const other = name === 'winter' ? 'summer' : 'winter';
    expect(served).toMatch(new RegExp(`<link rel="icon"[^>]* href="/pictures/icon-${name}.svg"`));
    const file = await request.get(`/pictures/icon-${name}.svg`);
    expect(file.headers()['content-type']).toContain('image/svg+xml');

    // The head script takes the other season's icon before the application starts.
    const icon = page.locator('link[rel=icon]');
    await page.route(/\/(main|chunk)-[\w-]+\.js$/, () => undefined);
    await page.goto(`/en?season=${other}`, { waitUntil: 'commit' });
    await expect(icon).toHaveAttribute('href', `/pictures/icon-${other}.svg`);
    await page.unrouteAll({ behavior: 'ignoreErrors' });

    await page.goto(`/en?season=${other}`);
    await switchTo(page, name);
    await expect(icon).toHaveAttribute('href', `/pictures/icon-${name}.svg`);
    await expect(icon).toHaveCount(1);
  },
);

test(
  'a stored choice ends after 30 days, or when its season is no longer shown',
  { tag: '@any-engine' },
  async ({ page }) => {
    await page.clock.setFixedTime(november);
    await store(page, JSON.stringify({ season: 'summer-2027', on: '2026-10-17' }));
    await page.goto('/de');
    expect(await season(page)).toBe('summer');

    await page.clock.setFixedTime(new Date(2026, 10, 17, 12));
    await page.reload();
    expect(await season(page)).toBe('winter');
    await expect.poll(() => stored(page)).toBeNull();
  },
);

test('a summer chosen in August is over in September', { tag: '@any-engine' }, async ({ page }) => {
  await page.clock.setFixedTime(november);
  await store(page, JSON.stringify({ season: 'summer-2026', on: '2026-08-20' }));
  await page.goto('/de');
  expect(await season(page)).toBe('winter');
});

test('only the shown season’s photo is fetched, the other one on approach', async ({ page }) => {
  const photos: string[] = [];
  page.on('request', (request) => {
    const path = new URL(request.url()).pathname;
    if (path.startsWith('/pictures/hero-')) photos.push(path);
  });
  await page.clock.setFixedTime(november);
  await page.goto('/de');
  await page.waitForLoadState('networkidle');
  expect(photos).toEqual(['/pictures/hero-winter.webp']);
  await expect(async () => {
    await page.getByRole('radio', { name: 'Sommer' }).focus();
    expect(photos).toContain('/pictures/hero-summer.webp');
  }).toPass();
});

test('both seasons pass axe; the switch keeps its width, the accent part fits the name', async ({
  page,
}) => {
  await page.clock.setFixedTime(november);
  await page.goto('/de');
  const width = async () => (await page.locator('.season-switch').boundingBox())!.width;
  // The chosen label carries the accent. Its width against the sum of its padding, icon, gap
  // and name: a label stretched to the other season's longer name would be wider.
  const accent = (name: 'winter' | 'summer') =>
    page.locator(`.season-switch label[data-for=${name}]`).evaluate((label) => {
      const style = getComputedStyle(label);
      const parts = [label.querySelector('ng-icon')!, label.querySelector('.season-name')!];
      const content =
        parseFloat(style.paddingLeft) +
        parseFloat(style.paddingRight) +
        parseFloat(style.columnGap) +
        parts.reduce((sum, part) => sum + part.getBoundingClientRect().width, 0);
      return { width: label.getBoundingClientRect().width, content };
    });
  const before = await width();
  const winter = await accent('winter');
  expect(winter.width).toBeCloseTo(winter.content, 0);
  expect(await axe(page)).toEqual([]);
  await switchTo(page, 'summer');
  await settled(page);
  expect(await width()).toBe(before);
  const summer = await accent('summer');
  expect(summer.width).toBeCloseTo(summer.content, 0);
  // The demo's names differ in length, so the two accent parts do too.
  expect(Math.abs(summer.width - winter.width)).toBeGreaterThan(4);
  expect(await axe(page)).toEqual([]);
});

test('below 24rem the switch shows its icons only, the names stay the radios’ names', async ({
  page,
}) => {
  for (const [path, names] of [
    ['/de', ['Winter', 'Sommer']],
    ['/en', ['Winter', 'Summer']],
  ] as const) {
    await page.goto(path);
    for (const name of ['winter', 'summer'] as const) {
      await switchTo(page, name);
      await settled(page);
      for (const width of [320, 360, 375, 383, 384]) {
        await page.setViewportSize({ width, height: 700 });
        const place = `${path} in ${name} at ${width}`;
        const chosen = page.locator(`.season-switch label[data-for=${name}] .season-name`);
        expect((await chosen.boundingBox())!.width > 1, place).toBe(width >= 384);
        for (const [index, radio] of ['winter', 'summer'].entries()) {
          await expect(page.getByRole('radio', { name: names[index] }), place).toHaveValue(radio);
        }
        if (width === 320) expect(await axe(page), place).toEqual([]);
      }
    }
  }
});

test('the picture credits name each photo’s author, source and licence', async ({ page }) => {
  await page.goto('/en/picture-credits');
  await expect(page.getByRole('link', { name: 'Saalbach (8450786397).jpg' })).toHaveAttribute(
    'href',
    'https://commons.wikimedia.org/wiki/File:Saalbach_(8450786397).jpg',
  );
  await expect(page.getByText('Ian Gratton')).toBeVisible();
  // The changes follow the title, outside its link.
  await expect(page.getByText('(scaled down)')).toHaveCount(2);
  await expect(page.getByRole('link', { name: 'CC BY-SA 4.0' })).toHaveAttribute(
    'href',
    'https://creativecommons.org/licenses/by-sa/4.0',
  );
  expect(await axe(page)).toEqual([]);
});

test(
  'a site with a single season has no switch and no credits',
  { tag: '@any-engine' },
  async ({ page }) => {
    const other = 'http://localhost:4002';
    await page.clock.setFixedTime(november);
    await store(page, JSON.stringify({ season: 'winter-2026', on: '2026-11-15' }));
    await page.goto(`${other}/it?season=winter`);
    expect(await season(page)).toBe('summer');
    await expect(page.getByRole('radiogroup')).toHaveCount(0);
    await expect(page.getByRole('img', { name: /sfumatura/ })).toBeVisible();
    await expect(page.locator('link[rel=icon]')).toHaveAttribute('href', '/pictures/icon.svg');
    await expect.poll(() => stored(page)).toBeNull();

    await page.goto(`${other}/it/crediti`);
    await expect(page.getByText('Questo sito non mostra foto di altri.')).toBeVisible();
  },
);

test('the hero fills the first screen, and the jump to the weeks ends it at the header', async ({
  page,
}) => {
  await page.goto('/en');
  const header = page.locator('app-header');
  await expect(header).toHaveAttribute('data-over', '');
  const card = (await page.locator('.hero-copy').boundingBox())!;
  const height = page.viewportSize()!.height;
  expect(card.y + card.height).toBeLessThanOrEqual(height);
  expect(card.y + card.height).toBeGreaterThan(height / 2);

  await expect(page.locator('html')).toHaveAttribute('data-started', '');
  await page.getByRole('link', { name: 'See the free weeks' }).click();
  await expect(page).toHaveURL('/en#free-weeks');
  await expect(header).not.toHaveAttribute('data-over');
  // The header covers the hero's last strip: their lower edges meet.
  const edges = () =>
    page.evaluate(() =>
      ['.hero', 'app-header'].map((part) =>
        Math.round(document.querySelector(part)!.getBoundingClientRect().bottom),
      ),
    );
  await expect.poll(async () => new Set(await edges()).size).toBe(1);
});

test('over the hero the header takes its ground while the menu is open', async ({ page }) => {
  const header = page.locator('app-header');
  const ground = () => header.evaluate((element) => getComputedStyle(element).backgroundColor);
  for (const width of [320, 768]) {
    for (const season of ['winter', 'summer']) {
      await page.setViewportSize({ width, height: 700 });
      await page.goto(`/en?season=${season}`);
      await expect(header).toHaveAttribute('data-over', '');
      // Found by place: while the sheet is open, the page behind it has no names.
      const menu = page.locator('.header-narrow > button');
      await expect(page.locator('html')).toHaveAttribute('data-started', '');
      await menu.click();
      await expect(menu).toHaveAttribute('aria-expanded', 'true');
      await expect(header).not.toHaveAttribute('data-over');
      await expect.poll(ground).not.toBe('rgba(0, 0, 0, 0)');
      await page.keyboard.press('Escape');
      await expect(menu).toHaveAttribute('aria-expanded', 'false');
      await expect(header).toHaveAttribute('data-over', '');
    }
  }
});
