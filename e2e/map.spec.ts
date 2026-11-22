import { readdirSync, readFileSync } from 'node:fs';
import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import sharp from 'sharp';

const panel = (page: Page) => page.locator('.map-panel');
const places = (page: Page) => panel(page).locator('.map-places li');

// The section's heading brings the map into view, which loads it.
const scrollToMap = (page: Page) =>
  page.getByRole('heading', { name: /^(Location|Lage)$/ }).scrollIntoViewIfNeeded();

// The home page's map, scrolled into view and drawn; an engine without WebGL draws none.
async function openMap(page: Page, path = '/en') {
  await page.goto(path);
  const webgl = await page.evaluate(() => !!document.createElement('canvas').getContext('webgl2'));
  test.skip(!webgl, 'This engine has no WebGL here; the panel is tested without the map.');
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
  // Wide enough that no pin lies under the panel, which on a phone covers the map's foot.
  await page.setViewportSize({ width: 1280, height: 900 });
  await openMap(page);
  await expect(places(page)).toHaveCount(2);
  await expect(places(page).first()).not.toContainText(' m');
  await page.getByRole('button', { name: 'Ahorn' }).click();
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
  const pin = page.getByRole('button', { name: 'Lärche' });
  await pin.click();
  await expect(pin).toHaveAttribute('aria-pressed', 'true');
  await pin.click();
  await expect(pin).toHaveAttribute('aria-pressed', 'false');
  await expect(panel(page).getByRole('radio', { name: 'Lärche' })).not.toBeChecked();
});

test("the map's hint to hold Ctrl while scrolling stays under the panel", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await openMap(page);
  const hint = page.locator('.maplibregl-cooperative-gesture-screen');
  await page.locator('.maplibregl-canvas').hover({ position: { x: 800, y: 300 } });
  await page.mouse.wheel(0, 40);
  await expect(hint).toHaveClass(/maplibregl-show/);
  await expect(hint).toHaveCSS('opacity', '1');
  // The panel's white ground stays white: the hint's dark veil lies only on the map.
  const shot = await panel(page).screenshot();
  const { data, info } = await sharp(shot).raw().toBuffer({ resolveWithObject: true });
  // A pixel of the padding above the panel's first line, away from its round corners.
  const at = (8 * info.width + Math.round(info.width / 2)) * info.channels;
  expect(Math.min(...data.subarray(at, at + 3))).toBeGreaterThan(240);
});

test('the switch adds the other places, with their pins', async ({ page }) => {
  await openMap(page);
  await expect(page.locator('.map-place')).toHaveCount(2);
  await panel(page).getByText('More places').click();
  await expect(panel(page).getByRole('switch', { name: 'More places' })).toBeChecked();
  await expect(places(page)).toHaveText([
    /Schattberg/,
    /Kohlmais/,
    /Tourist office/,
    /Supermarket/,
  ]);
  await expect(page.locator('.map-place')).toHaveCount(4);
});

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
  await panel(page).getByText('Ahorn').click();
  await expect(places(page).first()).toContainText('900 m');
  await expect(page.locator('.location-map')).not.toHaveAttribute('data-drawn');
  await expect(page.locator('.map-pin').first()).toBeHidden();
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
  expect(seen.length).toBeGreaterThan(5);
});

test('the map section passes axe', async ({ page }) => {
  await openMap(page);
  await panel(page).getByText('Ahorn').click();
  const results = await new AxeBuilder({ page }).include('app-location-map').analyze();
  expect(results.violations.map((v) => v.id)).toEqual([]);
});
