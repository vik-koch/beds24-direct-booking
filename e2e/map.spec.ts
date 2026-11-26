import { readdirSync, readFileSync } from 'node:fs';
import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import sharp from 'sharp';
import { toLanguage } from './header';

// The pixels the map itself draws in a theme colour, the accent of the routes by default, with
// pins, labels and panel hidden.
async function accentPixels(page: Page, color = 'accent') {
  const hide = await page.addStyleTag({
    content: '.map-pin, .map-label, .map-panel { visibility: hidden !important; }',
  });
  const [r, g, b] = await page.evaluate((color) => {
    const canvas = document.createElement('canvas').getContext('2d')!;
    canvas.fillStyle = getComputedStyle(document.documentElement).getPropertyValue(
      `--color-${color}`,
    );
    const hex = String(canvas.fillStyle);
    return [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  }, color);
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
// A walk's distance as the page writes it, English unless given, from the committed routes, which
// the weekly map data run may change; to a content page's place, by the page.
const walk = (apartment: string, place = 'schattberg', page?: string, language = 'en-GB') => {
  const { features } = JSON.parse(readFileSync('content/demo/map/routes.json', 'utf8'));
  const { meters } = features.find(
    ({ properties: p }: { properties: Record<string, string> }) =>
      p['page'] === page && p['apartment'] === apartment && p['place'] === place,
  ).properties;
  const [value, unit] = meters < 1000 ? [meters, 'meter'] : [meters / 1000, 'kilometer'];
  return new Intl.NumberFormat(language, { style: 'unit', unit, maximumFractionDigits: 1 }).format(
    value,
  );
};
// The places shown: folded ones are inert.
const places = (page: Page) => panel(page).locator('.map-places:not([inert]) li');

// The section's heading brings the map into view, which loads it.
const scrollToMap = (page: Page) =>
  page.getByRole('heading', { name: /^(Location|Lage)$/ }).scrollIntoViewIfNeeded();

// A content page's map follows its text, just before the footer.
const scrollToPageMap = (page: Page) => page.locator('footer').scrollIntoViewIfNeeded();

// The home page's map, scrolled into view and drawn. CI's headless Firefox has no WebGL and draws
// none (ADR 14); Chromium and WebKit must.
async function openMap(page: Page, path = '/en', scroll = scrollToMap) {
  await page.goto(path);
  await drawMap(page, scroll);
}

async function drawMap(page: Page, scroll: (page: Page) => Promise<void>) {
  const webgl = await page.evaluate(() => !!document.createElement('canvas').getContext('webgl2'));
  const firefox = page.context().browser()?.browserType().name() === 'firefox';
  test.skip(firefox && !webgl, 'No WebGL in this Firefox; the panel is tested without the map.');
  expect(webgl, 'WebGL in Chromium and WebKit').toBe(true);
  await scroll(page);
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
  await expect(places(page).first()).toContainText(walk('ahorn'));
  await expect(
    page.locator('.map-label').filter({ hasText: new RegExp(`^${walk('ahorn')}$`) }),
  ).toBeVisible();
  await panel(page).getByText('Zirbe').click();
  await expect(page.getByRole('button', { name: 'Zirbe' })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('button', { name: 'Ahorn' })).toHaveAttribute(
    'aria-pressed',
    'false',
  );
  await expect(places(page).first()).toContainText(walk('zirbe'));
});

test('a second click on the chosen apartment clears the choice', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await openMap(page);
  const radio = panel(page).getByRole('radio', { name: 'Ahorn' });
  await panel(page).getByText('Ahorn').click();
  await expect(radio).toBeChecked();
  await panel(page).getByText('Ahorn').click();
  await expect(radio).not.toBeChecked();
  // Only the apartments' names stand beside the pins.
  await expect(page.locator('.map-label')).toHaveCount(3);
  await expect.poll(() => accentPixels(page)).toBeLessThan(50);
  const pin = page.getByRole('button', { name: 'Lärche' });
  await pin.click();
  await expect(pin).toHaveAttribute('aria-pressed', 'true');
  await pin.click();
  await expect(pin).toHaveAttribute('aria-pressed', 'false');
  await expect(panel(page).getByRole('radio', { name: 'Lärche' })).not.toBeChecked();
});

// One finger moving up over the map, as a phone's scroll of the page starts. WebKit has no Touch
// constructor, so the events carry plain touches, which is all MapLibre reads.
const swipe = (page: Page) =>
  page.locator('.maplibregl-canvas').evaluate((canvas) => {
    const { left, top, width } = canvas.getBoundingClientRect();
    for (const [type, y] of [
      ['touchstart', 120],
      ['touchmove', 80],
      ['touchend', 80],
    ] as const) {
      const touch = { identifier: 1, target: canvas, clientX: left + width / 2, clientY: top + y };
      const touches = type === 'touchend' ? [] : [touch];
      const event = new Event(type, { bubbles: true, cancelable: true });
      Object.assign(event, { touches, targetTouches: touches, changedTouches: [touch] });
      canvas.dispatchEvent(event);
    }
  });

test("the map's hint is a pill clear of its controls, the map not dimmed", async ({
  page,
  isMobile,
}) => {
  const widths = isMobile ? [page.viewportSize()!.width] : [1280, 1024, 768, 320];
  for (const width of widths) {
    await page.setViewportSize({ width, height: 900 });
    await openMap(page);
    // The error link's label at the schema's limit, in wide letters.
    await page
      .locator('.maplibregl-ctrl-attrib a[href="https://www.openstreetmap.org/fixthemap"]')
      .evaluate((link) => (link.textContent = 'Mw '.repeat(11).slice(0, 32)));
    if (!isMobile)
      await page.locator('.maplibregl-canvas').hover({ position: { x: width / 2, y: 100 } });
    // The hint fades soon after the gesture, so it is read in one frame while fully shown. A
    // gesture while the page still scrolls the map into view can miss it.
    const read = () =>
      page.evaluate(() => {
        const box = (element: Element) => {
          const { left, right, top, bottom } = element.getBoundingClientRect();
          return { left, right, top, bottom };
        };
        const screen = document.querySelector('.maplibregl-cooperative-gesture-screen')!;
        const pill = [...screen.children].find((child) => child.checkVisibility())!;
        return {
          opacity: getComputedStyle(screen).opacity,
          ground: getComputedStyle(screen).backgroundColor,
          text: pill.textContent,
          pill: box(pill),
          frame: box(document.querySelector('.map-frame')!),
          controls: ['.map-panel', '.map-zoom', '.maplibregl-ctrl-attrib'].map((selector) =>
            box(document.querySelector(selector)!),
          ),
        };
      });
    let seen!: Awaited<ReturnType<typeof read>>;
    await expect(async () => {
      await (isMobile ? swipe(page) : page.mouse.wheel(0, 40));
      seen = await read();
      expect(seen.opacity).toBe('1');
    }).toPass();
    const { pill, frame, controls } = seen;
    expect(seen.text).toMatch(isMobile ? /two fingers/ : /Ctrl/);
    expect(seen.ground).toBe('rgba(0, 0, 0, 0)');
    for (const box of controls)
      expect(
        pill.right <= box.left ||
          box.right <= pill.left ||
          pill.bottom <= box.top ||
          box.bottom <= pill.top,
        `the hint at ${width} px clear of ${JSON.stringify(box)}`,
      ).toBe(true);
    expect(pill.left).toBeGreaterThanOrEqual(frame.left);
    expect(pill.right).toBeLessThanOrEqual(frame.right);
    // A wide map has room for it in its middle beside the panel.
    if (width === 1280)
      expect(Math.abs(pill.left + pill.right - frame.left - frame.right)).toBeLessThan(2);
  }
});

// Once the fold has finished: a view the fold moved would be moving by then.
const folded = (page: Page) =>
  page.waitForFunction(() => !document.querySelector('.map-more')!.getAnimations().length);

test('the arrow unfolds the other places with their pins, and leaves the view', async ({
  page,
}) => {
  await openMap(page);
  const more = panel(page).locator('.map-unfold');
  // Where two apartments stand in the map, whatever the page's scroll.
  const spots = () =>
    page.locator('.map-frame').evaluate((frame) => {
      const { x, y } = frame.getBoundingClientRect();
      return [...frame.querySelectorAll('button.map-pin')].slice(0, 2).map((pin) => {
        const box = pin.getBoundingClientRect();
        return [box.x - x, box.y - y];
      });
    });
  const near = (a: number[][], b: number[][]) =>
    a.flat().every((value, i) => Math.abs(value - b.flat()[i]!) < 1);
  const before = await spots();
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
  await folded(page);
  expect(near(await spots(), before)).toBe(true);
  await more.click();
  await expect(page.locator('.map-place')).toHaveCount(2);
  await folded(page);
  expect(near(await spots(), before)).toBe(true);
});

// The heights of the other places' list over the frames after the arrow is pressed.
const unfolding = (page: Page) =>
  page.evaluate(async () => {
    document.querySelector<HTMLElement>('.map-unfold')!.click();
    const list = document.querySelector('#map-more')!;
    const heights: number[] = [];
    for (let i = 0; i < 40; i++) {
      await new Promise(requestAnimationFrame);
      heights.push(list.getBoundingClientRect().height);
    }
    return heights;
  });

test('the other places grow into the list, and appear at once with reduced motion', async ({
  page,
}) => {
  await openMap(page);
  const grown = await unfolding(page);
  const full = grown.at(-1)!;
  expect(full).toBeGreaterThan(50);
  expect(grown.some((height) => height > 1 && height < full - 1)).toBe(true);
  await page.locator('.map-unfold').click();
  await folded(page);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const sudden = await unfolding(page);
  expect(sudden.some((height) => height > 1 && height < full - 1)).toBe(false);
  expect(sudden.at(-1)).toBe(full);
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

for (const [width, path] of [
  [320, '/de'],
  [390, '/en'],
] as const) {
  test(`on a ${width} px phone the map is square, the panel below it without a scroll`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 800 });
    await openMap(page, path);
    await panel(page).locator('.map-unfold').click();
    await panel(page).locator('.map-choices label').nth(1).click();
    await folded(page);
    const layout = () =>
      page.evaluate(() => {
        const frame = document.querySelector('.map-frame')!.getBoundingClientRect();
        const box = document.querySelector('.map-panel')!.getBoundingClientRect();
        const panel = document.querySelector('.map-panel')!;
        const root = document.documentElement;
        return {
          square: Math.round(frame.height) === Math.round(frame.width),
          below: box.top >= frame.bottom,
          gutters: box.left >= 16 && box.right <= root.clientWidth - 16,
          innerScroll: panel.scrollHeight - panel.clientHeight,
          sideways: root.scrollWidth > root.clientWidth,
        };
      });
    await expect
      .poll(layout)
      .toEqual({ square: true, below: true, gutters: true, innerScroll: 0, sideways: false });
  });
}

test('pins and labels at the first view: no pin lies under another or under a label', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await openMap(page);
  await panel(page).locator('.map-unfold').click();
  await panel(page).getByText('Ahorn').click();
  await expect(page.locator('.map-label')).toHaveCount(7);
  await folded(page);
  await page.locator('.map-frame').evaluate((frame) => frame.scrollIntoView({ block: 'center' }));
  // The middle of each pin's head is the pin's own, nothing else's.
  await expect
    .poll(() =>
      page.evaluate(() =>
        [...document.querySelectorAll('.map-pin')]
          .filter((pin) => {
            const box = pin.getBoundingClientRect();
            const hit = document.elementFromPoint(box.x + box.width / 2, box.y + box.width / 2);
            return !pin.contains(hit);
          })
          .map((pin) => pin.getAttribute('aria-label')),
      ),
    )
    .toEqual([]);
});

// How far apart two pins stand: it grows as the map zooms in.
const spread = (page: Page, a: string, b: string) =>
  page.evaluate(
    ([a, b]) => {
      const [p, q] = [a, b].map((name) =>
        document.querySelector(`.map-pin[aria-label="${name}"]`)!.getBoundingClientRect(),
      );
      return Math.hypot(p!.x - q!.x, p!.y - q!.y);
    },
    [a, b],
  );

test("a place's pin chooses it and zooms to it; again clears it", async ({ page, isMobile }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await openMap(page);
  const pin = page.getByRole('button', { name: 'Kohlmaisbahn', exact: true });
  const line = places(page).nth(1).getByRole('button');
  const before = await spread(page, 'Kohlmaisbahn', 'Schattberg X-press');
  await (isMobile ? pin.tap() : pin.click());
  await expect(pin).toHaveAttribute('aria-pressed', 'true');
  await expect(line).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('.map-label').filter({ hasText: 'Kohlmaisbahn' })).toBeVisible();
  await expect
    .poll(() => spread(page, 'Kohlmaisbahn', 'Schattberg X-press'))
    .toBeGreaterThan(before * 1.5);
  await (isMobile ? pin.tap() : pin.click());
  await expect(pin).toHaveAttribute('aria-pressed', 'false');
  await expect(line).toHaveAttribute('aria-pressed', 'false');
  await expect
    .poll(() => spread(page, 'Kohlmaisbahn', 'Schattberg X-press'))
    .toBeCloseTo(before, 0);
});

test("a place's line chooses it by keyboard, and with an apartment its route stands out", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await openMap(page);
  await panel(page).getByText('Ahorn').click();
  await expect.poll(() => accentPixels(page)).toBeGreaterThan(500);
  const line = places(page).first().getByRole('button');
  await expect(line).toHaveAccessibleName(new RegExp(`Schattberg X-press.*${walk('ahorn')}`));
  await line.focus();
  await page.keyboard.press('Enter');
  await expect(line).toHaveAttribute('aria-pressed', 'true');
  await expect(
    page.getByRole('button', { name: 'Schattberg X-press', exact: true }),
  ).toHaveAttribute('aria-pressed', 'true');
  // The chosen route keeps the accent. That the others fade is not measured: the view moves with
  // the choice, and their faded colour is close to the map's water in WebKit.
  await expect.poll(() => accentPixels(page)).toBeGreaterThan(500);
  // Counting the pixels hides the panel for a moment, which takes the focus away.
  await line.focus();
  await page.keyboard.press('Space');
  await expect(line).toHaveAttribute('aria-pressed', 'false');
});

test("a place's pin chosen by keyboard can be cleared from the same pin", async ({ page }) => {
  await openMap(page);
  const pin = page.getByRole('button', { name: 'Kohlmaisbahn', exact: true });
  await pin.focus();
  await page.keyboard.press('Enter');
  await expect(pin).toHaveAttribute('aria-pressed', 'true');
  await expect(pin).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(pin).toHaveAttribute('aria-pressed', 'false');
});

test('choosing a place keeps a closer zoom the visitor has chosen', async ({ page }) => {
  // Without motion every view is reached at once: the zoom button cannot cut one short.
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.setViewportSize({ width: 1280, height: 900 });
  await openMap(page);
  const gondolas = () => spread(page, 'Kohlmaisbahn', 'Schattberg X-press');
  const far = await gondolas();
  await places(page).nth(1).getByRole('button').click();
  await expect.poll(gondolas).toBeGreaterThan(far * 1.5);
  // A step of the zoom doubles the distance on the screen.
  const near = await gondolas();
  await page.getByRole('button', { name: 'Zoom in' }).click();
  await expect.poll(gondolas).toBeGreaterThan(near * 1.9);
  const nearer = await gondolas();
  await places(page).first().getByRole('button').click();
  await expect(places(page).first().getByRole('button')).toHaveAttribute('aria-pressed', 'true');
  // A view that zoomed out would have moved by then.
  await page.waitForTimeout(1500);
  expect(Math.abs((await gondolas()) / nearer - 1)).toBeLessThan(0.05);
});

test("the reset button returns to the view of the choices, a chosen place's too", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.setViewportSize({ width: 1280, height: 900 });
  await openMap(page);
  const pin = page.getByRole('button', { name: 'Ahorn' });
  const reset = page.getByRole('button', { name: 'Show the whole view' });
  const gondolas = () => spread(page, 'Kohlmaisbahn', 'Schattberg X-press');
  const first = (await pin.boundingBox())!;
  const far = await gondolas();
  await page.getByRole('button', { name: 'Zoom in' }).click();
  await expect.poll(gondolas).toBeGreaterThan(far * 1.9);
  await reset.focus();
  await page.keyboard.press('Enter');
  await expect.poll(gondolas).toBeCloseTo(far, 0);
  await expect.poll(async () => (await pin.boundingBox())!.x).toBeCloseTo(first.x, 0);
  const line = places(page).nth(1).getByRole('button');
  await line.click();
  await expect.poll(gondolas).toBeGreaterThan(far * 1.5);
  const near = await gondolas();
  const gondola = page.getByRole('button', { name: 'Kohlmaisbahn', exact: true });
  const at = (await gondola.boundingBox())!;
  await page.getByRole('button', { name: 'Zoom in' }).click();
  await expect.poll(gondolas).toBeGreaterThan(near * 1.9);
  // Dragged away from the place, too.
  const dragged = (await gondola.boundingBox())!;
  const frame = (await page.locator('.map-canvas').boundingBox())!;
  await page.mouse.move(frame.x + frame.width / 2, frame.y + frame.height / 2);
  await page.mouse.down();
  await page.mouse.move(frame.x + frame.width / 2 + 150, frame.y + frame.height / 2 + 100, {
    steps: 5,
  });
  await page.mouse.up();
  await expect.poll(async () => (await gondola.boundingBox())!.x - dragged.x).toBeCloseTo(150, -1);
  await reset.click();
  await expect.poll(gondolas).toBeCloseTo(near, 0);
  await expect
    .poll(async () => {
      const box = (await gondola.boundingBox())!;
      return Math.hypot(box.x - at.x, box.y - at.y);
    })
    .toBeLessThan(1);
  await expect(line).toHaveAttribute('aria-pressed', 'true');
});

test('a chosen place among the other places is cleared when they fold', async ({ page }) => {
  await openMap(page);
  await panel(page).locator('.map-unfold').click();
  const line = places(page).filter({ hasText: 'Supermarket' }).getByRole('button');
  await line.click();
  await expect(line).toHaveAttribute('aria-pressed', 'true');
  await panel(page).locator('.map-unfold').click();
  await panel(page).locator('.map-unfold').click();
  await expect(line).toHaveAttribute('aria-pressed', 'false');
});

test('the lifts are drawn in ink, and every point of interest finds its icon', async ({ page }) => {
  const missing: string[] = [];
  page.on('console', (message) => {
    if (message.text().includes('could not be loaded')) missing.push(message.text());
  });
  await page.setViewportSize({ width: 1280, height: 900 });
  await openMap(page);
  // Without the lifts about 30 pixels are ink, with them over 700.
  await expect.poll(() => accentPixels(page, 'ink')).toBeGreaterThan(300);
  // Close enough for the points of interest, which show from zoom 16 or later.
  for (let i = 0; i < 2; i++) await page.getByRole('button', { name: 'Zoom in' }).click();
  await places(page).first().getByRole('button').click();
  await expect(page.getByRole('button', { name: 'Zoom out' })).toBeEnabled();
  // The restaurants beside the gondola draw their icons' rust: the places' icons are drawn.
  await expect.poll(() => accentPixels(page, 'poi-food')).toBeGreaterThan(20);
  expect(missing).toEqual([]);
});

test('a change of season keeps the choice and shows the places in that season', async ({
  page,
}) => {
  await openMap(page);
  await panel(page).getByText('Lärche').click();
  const season = await page.locator('html').getAttribute('data-season');
  const other = season === 'winter' ? 'summer' : 'winter';
  const texts = { winter: 'Gondola to the slopes', summer: 'Gondola to hiking and bike trails' };
  const note = places(page).first().locator('[data-for]:visible');
  await expect(note).toHaveText(new RegExp(texts[season as 'winter']));
  await page.locator(`.season-switch label[data-for=${other}]`).click();
  await expect(note).toHaveText(new RegExp(texts[other]));
  await expect(panel(page).getByRole('radio', { name: 'Lärche' })).toBeChecked();
});

for (const path of ['/en', '/en/apartments/zirbe']) {
  test(`on ${path} the places' texts are the page's season in the first paint`, async ({
    page,
  }) => {
    // Hold the application's scripts back: only the inline script in the head runs.
    await page.route(/\/(main|chunk)-[\w-]+\.js$/, () => undefined);
    for (const season of ['winter', 'summer']) {
      await page.goto(`${path}?season=${season}`, { waitUntil: 'commit' });
      await expect(page.locator('html')).toHaveAttribute('data-script', '');
      await expect(places(page).first().locator('[data-for]:visible')).toHaveAttribute(
        'data-for',
        season,
      );
    }
  });
}

// Counts the maps let go: MapLibre's remove() loses its WebGL context.
const countLost = (page: Page) =>
  page.addInitScript(() => {
    const counted = new WeakSet<HTMLCanvasElement>();
    const get = HTMLCanvasElement.prototype.getContext;
    Object.assign(window, { lost: 0 });
    HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement, ...args: never[]) {
      if (String(args[0]).startsWith('webgl') && !counted.has(this)) {
        counted.add(this);
        this.addEventListener(
          'webglcontextlost',
          () => (window as unknown as { lost: number }).lost++,
        );
      }
      return get.apply(this, args);
    } as typeof get;
  });
const lost = (page: Page) => page.evaluate(() => (window as unknown as { lost: number }).lost);

test('a change of language keeps the map, its view and the choices; a load starts afresh', async ({
  page,
}) => {
  // Without motion the view stands still once reached.
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.setViewportSize({ width: 1280, height: 900 });
  await countLost(page);
  await openMap(page);
  const pins = () =>
    page.locator('.map-frame').evaluate((frame) => {
      const { x, y } = frame.getBoundingClientRect();
      return ['Ahorn', 'Lärche'].map((name) => {
        const box = frame.querySelector(`.map-pin[aria-label="${name}"]`)!.getBoundingClientRect();
        return [Math.round(box.x - x), Math.round(box.y - y)];
      });
    });
  const first = await pins();
  await panel(page).getByText('Lärche').click();
  await panel(page).locator('.map-unfold').click();
  const line = places(page).filter({ hasText: 'Supermarket' }).getByRole('button');
  await line.click();
  await expect(line).toHaveAttribute('aria-pressed', 'true');
  const chosen = await pins();
  await page.getByRole('button', { name: 'Zoom out' }).click();
  await expect.poll(pins).not.toEqual(chosen);
  const left = await pins();
  await toLanguage(page, 'Language: English', 'Deutsch');
  await expect(page).toHaveURL(/\/de$/);
  await expect(page.locator('.location-map[data-drawn]')).toBeVisible({ timeout: 20000 });
  await expect(panel(page).getByRole('radio', { name: 'Lärche' })).toBeChecked();
  await expect(panel(page).locator('.map-unfold')).toHaveAttribute('aria-expanded', 'true');
  await expect(places(page).filter({ hasText: 'Supermarkt' }).getByRole('button')).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await expect.poll(pins).toEqual(left);
  expect(await lost(page)).toBe(0);
  // The map taken over speaks the page's language.
  await expect(page.getByRole('region', { name: 'Karte von Saalbach' })).toBeVisible();
  await expect(page.locator('.maplibregl-ctrl-attrib-button')).toHaveAttribute(
    'aria-label',
    'Quellen der Karte',
  );
  await expect(
    page.locator('.maplibregl-ctrl-attrib a[href="https://www.openstreetmap.org/fixthemap"]'),
  ).toHaveText('Kartenfehler melden');
  await expect(page.locator('.maplibregl-mobile-message')).toHaveText(
    'Die Karte mit zwei Fingern bewegen',
  );
  await page.reload();
  await scrollToMap(page);
  await expect(page.locator('.location-map[data-drawn]')).toBeVisible({ timeout: 20000 });
  await expect(panel(page).getByRole('radio', { checked: true })).toHaveCount(0);
  await expect(panel(page).locator('.map-unfold')).toHaveAttribute('aria-expanded', 'false');
  await expect.poll(pins).toEqual(first);
});

test("a change of language keeps the pins' size", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await openMap(page);
  const width = await page
    .locator('.map-pin')
    .first()
    .evaluate((pin) => pin.offsetWidth);
  // A pin's width in every frame, until 30 frames after the other language's page is shown.
  const widths = page.evaluate(
    () =>
      new Promise<number[]>((resolve) => {
        const widths: number[] = [];
        let after = 0;
        const step = () => {
          const pin = document.querySelector<HTMLElement>('.map-pin');
          if (pin?.checkVisibility()) widths.push(pin.getBoundingClientRect().width);
          if (document.documentElement.lang === 'de-AT') after++;
          if (after < 30) requestAnimationFrame(step);
          else resolve(widths);
        };
        requestAnimationFrame(step);
      }),
  );
  await toLanguage(page, 'Language: English', 'Deutsch');
  expect(new Set(await widths)).toEqual(new Set([width]));
});

test('a page without the map lets it go with its choices: Back opens the first view', async ({
  page,
}) => {
  await countLost(page);
  await openMap(page);
  await panel(page).getByText('Lärche').click();
  await expect(panel(page).getByRole('radio', { name: 'Lärche' })).toBeChecked();
  await page.locator('footer a[href^="/en/imprint"]').click();
  await expect(page).toHaveURL(/\/en\/imprint/);
  await expect.poll(() => lost(page)).toBe(1);
  await page.goBack();
  await scrollToMap(page);
  await expect(page.locator('.location-map[data-drawn]')).toBeVisible({ timeout: 20000 });
  await expect(panel(page).getByRole('radio', { checked: true })).toHaveCount(0);
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
  await expect(places(page).first()).toContainText(walk('ahorn'));
  await expect(page.locator('.location-map')).not.toHaveAttribute('data-drawn');
  await expect(page.locator('.map-pin').first()).toBeHidden();
  await expect(page.getByRole('button', { name: 'Zoom in' })).toBeHidden();
  // A change of language keeps the panel's choices.
  await panel(page).locator('.map-unfold').click();
  await places(page).filter({ hasText: 'Supermarket' }).getByRole('button').click();
  await toLanguage(page, 'Language: English', 'Deutsch');
  await expect(panel(page).getByRole('radio', { name: 'Ahorn' })).toBeChecked();
  await expect(panel(page).locator('.map-unfold')).toHaveAttribute('aria-expanded', 'true');
  await expect(places(page).filter({ hasText: 'Supermarkt' }).getByRole('button')).toHaveAttribute(
    'aria-pressed',
    'true',
  );
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
      // A pin draws its ring round its head, which is its ::before.
      const ring = parts.some((part) =>
        [undefined, '::before'].some((pseudo) => {
          const style = getComputedStyle(part, pseudo);
          return style.outlineStyle !== 'none' && parseFloat(style.outlineWidth) >= 2;
        }),
      );
      const name = `${element.tagName.toLowerCase()} ${element.getAttribute('aria-label') || element.textContent?.trim().slice(0, 30)}`;
      return { name, ring };
    });
    if (!stop) break;
    seen.push(stop.name);
    expect(stop.ring, stop.name).toBe(true);
    await page.keyboard.press('Tab');
  }
  expect(seen).toEqual(
    expect.arrayContaining([
      'button More places',
      'button Zoom in',
      'button Zoom out',
      'button Show the whole view',
      'button Ahorn',
      'button Schattberg X-press',
    ]),
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

test("an apartment's page shows its map with it alone, chosen for good", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await openMap(page, '/en/apartments/ahorn');
  await expect.poll(() => accentPixels(page)).toBeGreaterThan(500);
  await expect(panel(page).getByRole('radio')).toHaveCount(0);
  await expect(panel(page)).not.toContainText('Routes from');
  await expect(places(page).first()).toContainText(walk('ahorn'));
  // Its pin is no button, and the other apartments have none.
  await expect(page.locator('.location-map').getByRole('img', { name: 'Ahorn' })).toBeVisible();
  await expect(page.locator('.map-pin:not(.map-place)')).toHaveCount(1);
  await page
    .locator('.map-label')
    .filter({ hasText: /^Ahorn$/ })
    .click();
  await expect(places(page).first()).toContainText(walk('ahorn'));
  await expect.poll(() => accentPixels(page)).toBeGreaterThan(500);
  const results = await new AxeBuilder({ page }).include('app-location-map').analyze();
  expect(results.violations.map((v) => v.id)).toEqual([]);
});

for (const [width, path] of [
  [320, '/en/apartments/ahorn'],
  [390, '/en/apartments/ahorn'],
  [320, '/en/parking'],
] as const)
  test(`at ${width} px the map on ${path} shows its pins and labels clear of the controls`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 844 });
    await openMap(page, path, path.includes('parking') ? scrollToPageMap : scrollToMap);
    const hidden = await page.evaluate(() => {
      const box = (element: Element) => element.getBoundingClientRect();
      const frame = box(document.querySelector('.map-frame')!);
      const controls = [...document.querySelectorAll('.map-zoom .map-pill')].map(box);
      return [...document.querySelectorAll('.map-label, .map-pin')]
        .filter((element) => {
          const b = box(element);
          const out =
            b.left < frame.left ||
            b.right > frame.right ||
            b.top < frame.top ||
            b.bottom > frame.bottom;
          return (
            out ||
            controls.some(
              (c) => b.left < c.right && b.right > c.left && b.top < c.bottom && b.bottom > c.top,
            )
          );
        })
        .map((element) => element.textContent!.trim() || element.getAttribute('aria-label'));
    });
    expect(hidden).toEqual([]);
  });

for (const width of [320, 768])
  test(`at ${width} px a chosen place's long name takes two lines, clear of the controls`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 844 });
    // The map moves to the place at once.
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await openMap(page, '/de/parken', scrollToPageMap);
    await places(page).first().getByRole('button').click();
    const label = page.locator('.map-label', { hasText: 'Parkhaus Zentrum' });
    await expect(label).toBeVisible();
    const [one, two, right, controls] = await label.evaluate((element) => {
      const height = () => element.getBoundingClientRect().height;
      const short = height();
      element.textContent = 'Télécabine du Schattberg-Ost';
      return [
        short,
        height(),
        element.getBoundingClientRect().right,
        document.querySelector('.map-zoom')!.getBoundingClientRect().left,
      ];
    });
    expect(two).toBeGreaterThan(one * 1.5);
    expect(right).toBeLessThanOrEqual(controls);
  });

test("at 320 px a wrapped place name's label fits its lines, with more room at its ends", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 844 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await openMap(page, '/de/parken', scrollToPageMap);
  await places(page).nth(1).getByRole('button').click();
  const label = page.locator('.map-label', { hasText: 'Parkplatz Schattberg' });
  await expect(label).toHaveAttribute('data-wrapped', '');
  const [width, text, padding] = await label.evaluate((element) => {
    const range = document.createRange();
    range.selectNodeContents(element);
    const lines = [...range.getClientRects()];
    return [
      element.getBoundingClientRect().width,
      Math.max(...lines.map((line) => line.right)) - Math.min(...lines.map((line) => line.left)),
      parseFloat(getComputedStyle(element).paddingLeft),
    ];
  });
  expect(padding).toBe(12);
  expect(width - text - 2 * padding).toBeLessThan(1);
  // A short name stays on one line with the narrower padding.
  await places(page).first().getByRole('button').click();
  await expect(page.locator('.map-label', { hasText: 'Parkhaus Zentrum' })).not.toHaveAttribute(
    'data-wrapped',
  );
});

test("an apartment's address leads to its map, which then loads", async ({ page }) => {
  const asked: string[] = [];
  page.on('request', (request) => asked.push(request.url()));
  await page.goto('/en/apartments/zirbe');
  await expect(page.locator('html')).toHaveAttribute('data-started', '');
  expect(asked.filter((url) => url.includes('/map/'))).toEqual([]);
  await page.getByRole('link', { name: 'Musterweg' }).click();
  await expect(page).toHaveURL(/\/en\/apartments\/zirbe#location$/);
  await expect(page.getByRole('heading', { name: 'Location', exact: true })).toBeInViewport();
  await expect(page.locator('link[href^="/map/maplibre-gl.css"]')).toHaveCount(1);
});

test("an apartment's map goes with a change of language, not to another page", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await countLost(page);
  await openMap(page, '/en/apartments/laerche');
  await page
    .locator('.maplibregl-canvas')
    .evaluate((canvas) => canvas.setAttribute('data-old', ''));
  await toLanguage(page, 'Language: English', 'Deutsch');
  await expect(page).toHaveURL(/\/de\/wohnungen\/laerche$/);
  await expect(page.locator('.location-map[data-drawn] canvas[data-old]')).toBeVisible();
  await expect(page.locator('.location-map').getByRole('img', { name: 'Lärche' })).toBeVisible();
  expect(await lost(page)).toBe(0);
  // Links to a home or an apartment's page load it in full: only another page and Back stay.
  await page.locator('footer a[href^="/de/impressum"]').click();
  await expect(page).toHaveURL(/\/de\/impressum/);
  await expect.poll(() => lost(page)).toBe(1);
  await page.goBack();
  await scrollToMap(page);
  await expect(page.locator('.location-map[data-drawn]')).toBeVisible({ timeout: 20000 });
  await expect(page.locator('canvas[data-old]')).toHaveCount(0);
  await expect(page.locator('.location-map').getByRole('img', { name: 'Lärche' })).toBeVisible();
});

test("an apartment's panel lists its distances in every engine, without the map too", async ({
  page,
}) => {
  await page.goto('/en/apartments/ahorn');
  await scrollToMap(page);
  await expect(places(page)).toHaveText([
    new RegExp(`Schattberg X-press.*${RegExp.escape(walk('ahorn'))}`),
    new RegExp(`Kohlmaisbahn.*${RegExp.escape(walk('ahorn', 'kohlmais'))}`),
  ]);
  await expect(panel(page).getByRole('radio')).toHaveCount(0);
});

test("a site page's map follows its text, loads once in view and marks the page's places", async ({
  page,
}) => {
  // Low enough that the map starts below the window.
  await page.setViewportSize({ width: 1280, height: 400 });
  const asked: string[] = [];
  page.on('request', (request) => asked.push(request.url()));
  await page.goto('/en/parking');
  await expect(page.locator('html')).toHaveAttribute('data-started', '');
  await expect(page.locator('.map-size')).not.toBeInViewport();
  // The map's own chunk, the one file with its template.
  const browser = 'dist/beds24-direct-booking/browser';
  const chunks = readdirSync(browser).filter(
    (file) =>
      file.endsWith('.js') && readFileSync(`${browser}/${file}`, 'utf8').includes('map-places'),
  );
  expect(chunks).toHaveLength(1);
  const loaded = () => asked.some((url) => url.endsWith(`/${chunks[0]}`));
  expect(loaded()).toBe(false);
  expect(asked.filter((url) => url.includes('/map/'))).toEqual([]);
  await drawMap(page, scrollToPageMap);
  expect(loaded()).toBe(true);
  await page.setViewportSize({ width: 1280, height: 900 });
  // Its title heads it in the column, as the apartment page's location heads its map.
  const title = page.locator('.map-section > h2');
  await expect(title).toHaveText('The way from the car');
  await expect(title).toHaveClass('column');
  expect(await title.evaluate((h2) => getComputedStyle(h2).fontWeight)).toBe(
    await page.locator('h1').evaluate((h1) => getComputedStyle(h1).fontWeight),
  );
  // The page's places alone, not the home map's.
  await expect(places(page)).toHaveText(['Parkhaus Zentrum', 'Schattberg car park']);
  await expect(page.locator('.map-place')).toHaveCount(2);
  await expect(panel(page).getByRole('button', { name: 'More places' })).toHaveCount(0);
  await expect.poll(() => accentPixels(page)).toBeLessThan(50);
  await panel(page).getByText('Lärche').click();
  await expect.poll(() => accentPixels(page)).toBeGreaterThan(500);
  const line = places(page).first().getByRole('button');
  await expect(line).toHaveAccessibleName(
    new RegExp(`Parkhaus Zentrum.*${walk('laerche', 'zentrum', 'parking')}`),
  );
  await line.focus();
  await page.keyboard.press('Enter');
  await expect(line).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('button', { name: 'Parkhaus Zentrum', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  const results = await new AxeBuilder({ page }).include('app-location-map').analyze();
  expect(results.violations.map((v) => v.id)).toEqual([]);
});

test("an apartment's page's map shows that apartment alone, its one place chosen for good, and goes with a change of language", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await countLost(page);
  await openMap(page, '/de/wohnungen/zirbe/anfahrt', scrollToPageMap);
  await expect(page.getByRole('heading', { level: 2, name: 'Von der Haltestelle' })).toBeVisible();
  await expect(panel(page).getByRole('radio')).toHaveCount(0);
  await expect(page.locator('.location-map').getByRole('img', { name: 'Zirbe' })).toBeVisible();
  await expect(page.locator('.map-pin:not(.map-place)')).toHaveCount(1);
  await expect(places(page)).toHaveText([
    new RegExp(
      `^Haltestelle Ronachgrund${RegExp.escape(walk('zirbe', 'bus-stop', 'zirbe/arrival', 'de-AT'))}$`,
    ),
  ]);
  // The one place is chosen and stays so: neither its line, its pin nor its label is a button.
  const stop = page.locator('.location-map').getByRole('img', { name: 'Haltestelle Ronachgrund' });
  await expect(stop).toBeVisible();
  await expect(page.locator('.location-map').getByRole('button', { pressed: true })).toHaveCount(0);
  await expect(page.locator('.location-map .map-place')).toHaveCount(1);
  await expect(panel(page).locator('.map-places').getByRole('button')).toHaveCount(0);
  await expect.poll(() => accentPixels(page)).toBeGreaterThan(500);
  await page.locator('.map-label').filter({ hasNotText: 'Zirbe' }).click();
  await expect(stop).toBeVisible();
  await page
    .locator('.maplibregl-canvas')
    .evaluate((canvas) => canvas.setAttribute('data-old', ''));
  await toLanguage(page, 'Sprache: Deutsch', 'English');
  await expect(page).toHaveURL(/\/en\/apartments\/zirbe\/getting-here$/);
  await expect(page.locator('.location-map[data-drawn] canvas[data-old]')).toBeVisible();
  await expect(page.getByRole('heading', { level: 2, name: 'From the bus stop' })).toBeVisible();
  await expect(places(page)).toHaveText([
    new RegExp(
      `^Ronachgrund bus stop${RegExp.escape(walk('zirbe', 'bus-stop', 'zirbe/arrival'))}$`,
    ),
  ]);
  await expect(
    page.locator('.location-map').getByRole('img', { name: 'Ronachgrund bus stop' }),
  ).toBeVisible();
  expect(await lost(page)).toBe(0);
});

test('a page without a map shows none', { tag: '@any-engine' }, async ({ page }) => {
  await page.goto('/en/apartments/zirbe/guide');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await expect(page.locator('app-location-map, .map-size')).toHaveCount(0);
});
