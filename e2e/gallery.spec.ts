import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Locator, type Page } from '@playwright/test';

const box = async (locator: Locator) => (await locator.boundingBox())!;
const ratio = async (locator: Locator) => {
  const { width, height } = await box(locator);
  return width / height;
};
const viewer = (page: Page) => page.locator('dialog.viewer');
// The viewer scales in as it opens: measured before that ends, it is a little smaller.
const settled = async (page: Page) =>
  viewer(page).evaluate((dialog) =>
    Promise.all(dialog.getAnimations().map(({ finished }) => finished)),
  );

test('the mosaic shows the first picture at 4:3 and the others square, eight at most', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  for (const [path, cells, more] of [
    ['/de/wohnungen/ahorn', 8, '+1 Bild'],
    ['/de/wohnungen/laerche', 5, null],
    ['/de/wohnungen/zirbe', 3, null],
    ['http://localhost:4002/it/appartamenti/zonneterras', 8, '+12 immagini'],
    ['http://localhost:4002/it/appartamenti/vista', 1, '+1 immagine'],
    ['http://localhost:4002/it/appartamenti/castagno', 1, null],
  ] as const) {
    await page.goto(path);
    const shown = page.locator('.tile:visible');
    await expect(shown, path).toHaveCount(cells);
    expect(await ratio(shown.first()), path).toBeCloseTo(4 / 3, 1);
    for (const cell of (await shown.all()).slice(1))
      expect(Math.abs((await ratio(cell)) - 1), path).toBeLessThan(0.05);
    if (more) await expect(shown.last().locator('.more'), path).toHaveText(more);
    else await expect(page.locator('.more:visible'), path).toHaveCount(0);
  }
});

test('a picture opens full screen, and the buttons, the keys and the thumbnails move', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto('/de/wohnungen/ahorn');
  const cell = page.locator('.tile').nth(2);
  await cell.click();
  const count = viewer(page).locator('.viewer-count');
  await expect(count).toHaveText('Bild 3 von 9');
  await expect(viewer(page).locator('.caption-in')).toHaveText(
    /^Doppelzimmer im Obergeschoss.*KI-Bild$/,
  );
  // The frame is 4:3, and the buttons sit right beside it.
  await settled(page);
  const frame = await box(viewer(page).locator('.viewer-track'));
  expect(frame.width / frame.height).toBeCloseTo(4 / 3, 1);
  const previous = await box(viewer(page).locator('.viewer-previous'));
  const next = await box(viewer(page).locator('.viewer-next'));
  expect(frame.x - previous.x - previous.width).toBeCloseTo(16, -1);
  expect(next.x - frame.x - frame.width).toBeCloseTo(16, -1);

  await viewer(page).getByRole('button', { name: 'Nächstes Bild' }).click();
  await expect(count).toHaveText('Bild 4 von 9');
  await page.keyboard.press('ArrowLeft');
  await expect(count).toHaveText('Bild 3 von 9');
  const thumb = viewer(page).getByRole('button', { name: 'Bild 9 von 9' });
  await thumb.click();
  await expect(count).toHaveText('Bild 9 von 9');
  await expect(thumb).toHaveAttribute('aria-current', 'true');
  // Past the last picture the first follows.
  await page.keyboard.press('ArrowRight');
  await expect(count).toHaveText('Bild 1 von 9');
  await page.keyboard.press('Escape');
  await expect(viewer(page)).toBeHidden();
  await expect(cell).toBeFocused();
});

test('a picture slides in and its text fades, at once with reduced motion', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto('/de/wohnungen/laerche');
  await page.locator('.tile').first().click();
  const track = viewer(page).locator('.viewer-track');
  expect(await track.evaluate((element) => getComputedStyle(element).scrollBehavior)).toBe(
    'smooth',
  );
  await page.keyboard.press('ArrowRight');
  await expect(viewer(page).locator('.caption-out')).toHaveCSS('animation-name', 'caption-out');
  await expect(viewer(page).locator('.caption-in')).toHaveCSS('animation-name', 'caption-in');

  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.keyboard.press('ArrowRight');
  expect(await track.evaluate((element) => element.scrollLeft / element.clientWidth)).toBeCloseTo(
    2,
  );
  await expect(viewer(page).locator('.caption-out')).toHaveCSS('opacity', '0');
  await expect(viewer(page).locator('.caption-in')).toHaveCSS('animation-name', 'none');
});

test('the current thumbnail shows its whole ring', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto('/de/wohnungen/ahorn');
  await page.locator('.tile').first().click();
  const row = await box(viewer(page).locator('.viewer-thumbs'));
  const current = await box(viewer(page).locator('.viewer-thumbs [aria-current]'));
  // The ring reaches 4 px beyond the thumbnail; the row cuts what lies beyond its own box.
  expect(current.y - 4).toBeGreaterThanOrEqual(row.y);
  expect(current.y + current.height + 4).toBeLessThanOrEqual(row.y + row.height);
});

test('twenty pictures: the thumbnails keep the current one in view', async ({ page }) => {
  await page.setViewportSize({ width: 768, height: 900 });
  await page.goto('http://localhost:4002/it/appartamenti/zonneterras');
  await page.locator('.tile').first().click();
  await page.keyboard.press('ArrowLeft');
  await expect(viewer(page).locator('.viewer-count')).toHaveText('Immagine 20 di 20');
  await expect(viewer(page).locator('.viewer-thumbs [aria-current]')).toBeInViewport({ ratio: 1 });
});

test('one picture: a single cell, and a viewer without buttons or thumbnails', async ({ page }) => {
  await page.goto('http://localhost:4002/it/appartamenti/castagno');
  await expect(page.locator('.tile')).toHaveCount(1);
  await expect(page.locator('.strip-count')).toHaveCount(0);
  await page.locator('.tile').click();
  await expect(viewer(page).locator('.viewer-count')).toHaveText('Immagine 1 di 1');
  await expect(viewer(page).locator('.viewer-previous, .viewer-next, .viewer-thumbs')).toHaveCount(
    0,
  );
});

test('on a phone the pictures are a strip, and the viewer’s buttons sit under the frame', async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 640 });
  await page.goto('/de/wohnungen/ahorn');
  await expect(page.locator('.strip-count')).toHaveText('1 / 9');
  await page.locator('.tiles').evaluate((strip) => strip.scrollTo({ left: strip.clientWidth * 3 }));
  await expect(page.locator('.strip-count')).toHaveText('4 / 9');
  await page.locator('.tile').nth(3).click();
  await expect(viewer(page).locator('.viewer-count')).toHaveText('Bild 4 von 9');
  await settled(page);
  const frame = await box(viewer(page).locator('.viewer-track'));
  expect(frame.width).toBe(320);
  for (const button of ['.viewer-previous', '.viewer-next'])
    expect((await box(viewer(page).locator(button))).y).toBeGreaterThan(frame.y + frame.height);
  await expect(viewer(page).locator('.viewer-thumbs')).toBeHidden();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(320);
});

test('the page behind the viewer holds still, and keeps its place when it closes', async ({
  page,
  browserName,
}) => {
  test.skip(browserName === 'webkit', 'the phone has no wheel');
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto('/de/wohnungen/ahorn');
  await page.evaluate(() => scrollTo({ top: 300, behavior: 'instant' }));
  // By coordinates: a locator's click would first scroll the page to its cell.
  const cell = await box(page.locator('.tile').nth(4));
  await page.mouse.click(cell.x + 20, cell.y + 20);
  await expect(viewer(page)).toBeVisible();
  await page.mouse.move(640, 400);
  await page.mouse.wheel(0, 600);
  await page.keyboard.press('Escape');
  expect(await page.evaluate(() => scrollY)).toBe(300);
});

test('after a swipe the keys go on from the picture swiped to', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto('/de/wohnungen/ahorn');
  await page.locator('.tile').first().click();
  const count = viewer(page).locator('.viewer-count');
  const track = viewer(page).locator('.viewer-track');
  for (const [to, shown] of [
    [5, 'Bild 6 von 9'],
    [2, 'Bild 3 von 9'],
  ] as const) {
    await track.evaluate((element, to) => element.scrollTo({ left: element.clientWidth * to }), to);
    await expect(count).toHaveText(shown);
    await expect
      .poll(() => track.evaluate((element) => element.scrollLeft / element.clientWidth))
      .toBeCloseTo(to, 2);
  }
  await page.keyboard.press('ArrowRight');
  await expect(count).toHaveText('Bild 4 von 9');
});

test('a resized window keeps the picture the viewer shows', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto('/de/wohnungen/ahorn');
  await page.locator('.tile').nth(4).click();
  const track = viewer(page).locator('.viewer-track');
  for (const [width, height] of [
    [700, 900],
    [320, 640],
    [1280, 900],
  ]) {
    await page.setViewportSize({ width, height });
    await expect(viewer(page).locator('.viewer-count')).toHaveText('Bild 5 von 9');
    await expect
      .poll(() => track.evaluate((element) => element.scrollLeft / element.clientWidth))
      .toBeCloseTo(4, 2);
  }
});

for (const path of ['/de/wohnungen/ahorn', '/en/apartments/ahorn'])
  test(`${path} passes axe with the viewer open, at both widths`, async ({ page }) => {
    for (const width of [320, 1280]) {
      await page.setViewportSize({ width, height: 800 });
      await page.goto(path);
      await page.locator('.tile:visible').first().click();
      await settled(page);
      const { violations } = await new AxeBuilder({ page }).include('dialog').analyze();
      expect(violations, `at ${width}`).toEqual([]);
    }
  });

test('every tab stop in the viewer shows a focus ring', async ({ page, browserName }) => {
  test.skip(browserName === 'webkit', 'Safari tabs only to fields unless told otherwise');
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto('/de/wohnungen/zirbe');
  await page.locator('.tile').first().focus();
  await page.keyboard.press('Enter');
  const seen: string[] = [];
  for (let i = 0; i < 10; i++) {
    const stop = await page.evaluate(() => {
      const element = document.activeElement as HTMLElement;
      const style = getComputedStyle(element);
      return {
        name: element.getAttribute('aria-label') ?? element.tagName,
        ring: style.outlineStyle !== 'none' && parseFloat(style.outlineWidth) >= 2,
      };
    });
    // After the last thumbnail Tab leaves for the browser's own controls.
    if (stop.name === 'BODY') break;
    seen.push(stop.name);
    expect(stop.ring, stop.name).toBe(true);
    await page.keyboard.press('Tab');
  }
  expect(seen).toEqual([
    'Schließen',
    'Voriges Bild',
    'Bilder',
    'Nächstes Bild',
    'Bild 1 von 3',
    'Bild 2 von 3',
    'Bild 3 von 3',
  ]);
});
