import { readdirSync, readFileSync } from 'node:fs';
import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import sharp from 'sharp';

// The pixels the map itself draws in the accent colour, the routes', with pins and panel hidden.
async function accentPixels(page: Page) {
  const hide = await page.addStyleTag({
    content: '.map-pin, .map-panel { visibility: hidden !important; }',
  });
  const accent = await page.evaluate(() => {
    const canvas = document.createElement('canvas').getContext('2d')!;
    canvas.fillStyle = getComputedStyle(document.documentElement).getPropertyValue(
      '--color-accent',
    );
    return String(canvas.fillStyle);
  });
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(accent.slice(i, i + 2), 16));
  const shot = await page.locator('.location-map').screenshot();
  await hide.evaluate((element) => element.remove());
  const { data, info } = await sharp(shot).raw().toBuffer({ resolveWithObject: true });
  let count = 0;
  for (let i = 0; i < data.length; i += info.channels)
    if (Math.abs(data[i]! - r!) + Math.abs(data[i + 1]! - g!) + Math.abs(data[i + 2]! - b!) < 30)
      count++;
  return count;
}

const panel = (page: Page) => page.locator('.map-panel');
// The places shown: folded ones are inert.
const places = (page: Page) => panel(page).locator('.map-places:not([inert]) li');

// The section's heading brings the map into view, which loads it.
const scrollToMap = (page: Page) =>
  page.getByRole('heading', { name: /^(Location|Lage)$/ }).scrollIntoViewIfNeeded();

// The home page's map, scrolled into view and drawn. CI's headless Firefox has no WebGL and draws
// none (ADR 14); Chromium and WebKit must.
async function openMap(page: Page, path = '/en') {
  await page.goto(path);
  const webgl = await page.evaluate(() => !!document.createElement('canvas').getContext('webgl2'));
  const firefox = page.context().browser()?.browserType().name() === 'firefox';
  test.skip(firefox && !webgl, 'No WebGL in this Firefox; the panel is tested without the map.');
  expect(webgl, 'WebGL in Chromium and WebKit').toBe(true);
  await scrollToMap(page);
  await expect(page.locator('.location-map[data-drawn]')).toBeVisible({ timeout: 20000 });
}

test(
  "the map's tiles are served by their build, as vector tiles",
  { tag: '@any-engine' },
  async ({ request }) => {
    const { build } = JSON.parse(readFileSync('content/demo/map/tiles.json', 'utf8'));
    const column = readdirSync(`content/demo/map/tiles/${build}/15`)[0];
    const [file] = readdirSync(`content/demo/map/tiles/${build}/15/${column}`);
    const response = await request.get(`/map/tiles/${build}/15/${column}/${file}`);
    expect(response.status()).toBe(200);
    expect(response.headers()['content-type']).toBe('application/vnd.mapbox-vector-tile');
  },
);

test('the map draws from the site alone, and loads only once in view', async ({ page }) => {
  const asked: string[] = [];
  page.on('request', (request) => asked.push(request.url()));
  await page.goto('/en');
  expect(asked.filter((url) => url.includes('/map/'))).toEqual([]);
  await openMap(page, '/en');
  expect(asked.some((url) => url.endsWith('.mvt'))).toBe(true);
  expect(new Set(asked.map((url) => new URL(url).host))).toEqual(new Set(['localhost:4000']));
});

test("a pin or the panel chooses an apartment, whose routes' distances show", async ({ page }) => {
  // Wide enough that no pin lies under the panel, which there lies over the map's left side.
  await page.setViewportSize({ width: 1280, height: 900 });
  await openMap(page);
  await expect(places(page)).toHaveCount(2);
  await expect(places(page).first()).not.toContainText(' m');
  await expect.poll(() => accentPixels(page)).toBeLessThan(50);
  await page.getByRole('button', { name: 'Ahorn' }).click();
  await expect.poll(() => accentPixels(page)).toBeGreaterThan(500);
  await expect(panel(page).getByRole('radio', { name: 'Ahorn' })).toBeChecked();
  await expect(places(page).first()).toContainText('900 m');
  await expect(page.locator('.map-place').first()).toHaveText('900 m');
  await panel(page).getByText('Zirbe').click();
  await expect(page.getByRole('button', { name: 'Zirbe' })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('button', { name: 'Ahorn' })).toHaveAttribute(
    'aria-pressed',
    'false',
  );
  await expect(places(page).first()).toContainText('1.1 km');
});

test('a second click on the chosen apartment clears the choice', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await openMap(page);
  const radio = panel(page).getByRole('radio', { name: 'Ahorn' });
  await panel(page).getByText('Ahorn').click();
  await expect(radio).toBeChecked();
  await panel(page).getByText('Ahorn').click();
  await expect(radio).not.toBeChecked();
  await expect(page.locator('.map-place').first()).toHaveText('');
  await expect.poll(() => accentPixels(page)).toBeLessThan(50);
  const pin = page.getByRole('button', { name: 'Lärche' });
  await pin.click();
  await expect(pin).toHaveAttribute('aria-pressed', 'true');
  await pin.click();
  await expect(pin).toHaveAttribute('aria-pressed', 'false');
  await expect(panel(page).getByRole('radio', { name: 'Lärche' })).not.toBeChecked();
});

test("the map's hint to hold Ctrl while scrolling stays under the panel", async ({
  page,
  isMobile,
}) => {
  test.skip(
    isMobile,
    'A phone has no mouse wheel; the hint lies under the panel in every engine alike.',
  );
  await page.setViewportSize({ width: 1280, height: 900 });
  await openMap(page);
  const hint = page.locator('.maplibregl-cooperative-gesture-screen');
  await page.locator('.maplibregl-canvas').hover({ position: { x: 800, y: 300 } });
  // A wheel while the page still scrolls the map into view can miss it.
  await expect(async () => {
    await page.mouse.wheel(0, 40);
    await expect(hint).toHaveClass(/maplibregl-show/, { timeout: 1000 });
  }).toPass();
  await expect(hint).toHaveCSS('opacity', '1');
  // The panel's white ground stays white: the hint's dark veil lies only on the map.
  const shot = await panel(page).screenshot();
  const { data, info } = await sharp(shot).raw().toBuffer({ resolveWithObject: true });
  // A pixel of the padding above the panel's first line, away from its round corners.
  const at = (8 * info.width + Math.round(info.width / 2)) * info.channels;
  expect(Math.min(...data.subarray(at, at + 3))).toBeGreaterThan(240);
});

test('the arrow unfolds the other places with their pins, and leaves the view', async ({
  page,
}) => {
  await openMap(page);
  const more = panel(page).getByRole('button', { name: 'More places' });
  // Where the pin stands in the map, whatever the page's scroll.
  const spot = () =>
    page
      .getByRole('button', { name: 'Ahorn' })
      .evaluate(
        (pin) =>
          pin.getBoundingClientRect().y - pin.closest('.map-frame')!.getBoundingClientRect().y,
      );
  const before = await spot();
  await expect(page.locator('.map-place')).toHaveCount(2);
  await expect(panel(page).locator('#map-more')).toHaveAttribute('inert');
  await more.click();
  await expect(more).toHaveAttribute('aria-expanded', 'true');
  await expect(panel(page).locator('#map-more')).not.toHaveAttribute('inert');
  await expect(places(page)).toHaveText([
    /Schattberg/,
    /Kohlmais/,
    /Tourist office/,
    /Supermarket/,
  ]);
  await expect(page.locator('.map-place')).toHaveCount(4);
  expect(await spot()).toBe(before);
  await more.click();
  await expect(page.locator('.map-place')).toHaveCount(2);
  expect(await spot()).toBe(before);
});

test('the other places grow into the list, and appear at once with reduced motion', async ({
  page,
}) => {
  await openMap(page);
  const fold = panel(page).locator('.map-more');
  await expect(fold).toHaveCSS('transition-duration', '0.3s');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect(fold).toHaveCSS('transition-duration', '0s');
});

test('the zoom buttons zoom the map, and stop at its widest view', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await openMap(page);
  const pin = page.getByRole('button', { name: 'Ahorn' });
  const zoomOut = page.getByRole('button', { name: 'Zoom out' });
  const before = (await pin.boundingBox())!;
  await page.getByRole('button', { name: 'Zoom in' }).click();
  await expect.poll(async () => (await pin.boundingBox())!.x).not.toBeCloseTo(before.x, 0);
  await expect(async () => {
    if (await zoomOut.isEnabled()) await zoomOut.click();
    await expect(zoomOut).toBeDisabled({ timeout: 500 });
  }).toPass({ timeout: 15000 });
});

for (const width of [320, 390]) {
  test(`on a ${width} px phone the panel follows the map and needs no scroll of its own`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 800 });
    await openMap(page);
    await panel(page).getByRole('button', { name: 'More places' }).click();
    await panel(page).getByText('Lärche').click();
    const frame = (await page.locator('.map-frame').boundingBox())!;
    const box = (await panel(page).boundingBox())!;
    expect(box.y).toBeGreaterThanOrEqual(frame.y + frame.height);
    expect(box.x).toBeGreaterThanOrEqual(16);
    expect(box.x + box.width).toBeLessThanOrEqual(width - 16);
    expect(await panel(page).evaluate((e) => e.scrollHeight - e.clientHeight)).toBe(0);
    const { scrollWidth, clientWidth } = await page.evaluate(() => document.documentElement);
    expect(scrollWidth).toBe(clientWidth);
  });
}

test('a change of season keeps the choice and shows the places in that season', async ({
  page,
}) => {
  await openMap(page);
  await panel(page).getByText('Lärche').click();
  const season = await page.locator('html').getAttribute('data-season');
  const other = season === 'winter' ? 'summer' : 'winter';
  const texts = { winter: 'Gondola to the slopes', summer: 'Gondola to hiking and bike trails' };
  await expect(places(page).first()).toContainText(texts[season as 'winter']);
  await page.locator(`.season-switch label[data-for=${other}]`).click();
  await expect(places(page).first()).toContainText(texts[other]);
  await expect(panel(page).getByRole('radio', { name: 'Lärche' })).toBeChecked();
});

test('without WebGL the panel stands alone and works', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(String(error)));
  await page.addInitScript(() => {
    const get = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement, ...args: never[]) {
      return String(args[0]).startsWith('webgl') ? null : get.apply(this, args);
    } as typeof get;
  });
  await page.goto('/en');
  await scrollToMap(page);
  // The section has started once it asks for MapLibre's stylesheet; a click before that is outside
  // what the site supports.
  await expect(page.locator('link[href^="/map/maplibre-gl.css"]')).toHaveCount(1);
  await panel(page).getByText('Ahorn').click();
  await expect(places(page).first()).toContainText('900 m');
  await expect(page.locator('.location-map')).not.toHaveAttribute('data-drawn');
  await expect(page.locator('.map-pin').first()).toBeHidden();
  await expect(page.getByRole('button', { name: 'Zoom in' })).toBeHidden();
  expect(errors).toEqual([]);
});

test("the map's own texts are the page's language", async ({ page }) => {
  await openMap(page, '/de');
  await expect(page.getByRole('button', { name: 'Vergrößern' })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Karte von Saalbach' })).toBeVisible();
  await expect(panel(page)).toContainText('Wege ab');
});

test('every tab stop in the map shows a focus ring', async ({ page, browserName }) => {
  test.skip(browserName === 'webkit', 'Safari tabs only to fields unless told otherwise');
  await openMap(page);
  await panel(page).getByRole('radio', { name: 'Zirbe' }).focus();
  const seen: string[] = [];
  for (let i = 0; i < 20; i++) {
    const stop = await page.evaluate(() => {
      const element = document.activeElement as HTMLElement;
      if (!element.closest('app-location-map')) return null;
      const parts = [element, element.nextElementSibling].filter(Boolean) as Element[];
      const ring = parts.some((part) => {
        const style = getComputedStyle(part);
        return style.outlineStyle !== 'none' && parseFloat(style.outlineWidth) >= 2;
      });
      const name = `${element.tagName.toLowerCase()} ${element.getAttribute('aria-label') || element.textContent?.trim().slice(0, 30)}`;
      return { name, ring };
    });
    if (!stop) break;
    seen.push(stop.name);
    expect(stop.ring, stop.name).toBe(true);
    await page.keyboard.press('Tab');
  }
  expect(seen).toEqual(
    expect.arrayContaining(['button More places', 'button Zoom in', 'button Zoom out']),
  );
});

test('the map section passes axe', async ({ page }) => {
  await openMap(page);
  await panel(page).getByText('Ahorn').click();
  const results = await new AxeBuilder({ page }).include('app-location-map').analyze();
  expect(results.violations.map((v) => v.id)).toEqual([]);
});

test('without JavaScript the panel names the places and their seasonal texts, and nothing to choose', async ({
  browser,
}) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  await page.goto('/en');
  await expect(places(page)).toHaveText([
    /Schattberg X-press.*Gondola to/,
    /Kohlmaisbahn.*Gondola to/,
  ]);
  await expect(panel(page)).toBeVisible();
  // Its choice and its other places need the application, so they are not offered.
  await expect(panel(page).getByRole('radio')).toHaveCount(0);
  await expect(panel(page).getByRole('button', { name: 'More places' })).toBeHidden();
  await context.close();
});
