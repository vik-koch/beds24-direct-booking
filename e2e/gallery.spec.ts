import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Locator, type Page } from '@playwright/test';
import { phoneWidth } from './phone';

const box = async (locator: Locator) => (await locator.boundingBox())!;
const viewer = (page: Page) => page.locator('dialog.viewer');
// The viewer scales in as it opens: measured before that ends, it is a little smaller.
const settled = async (page: Page) =>
  viewer(page).evaluate((dialog) =>
    Promise.all(dialog.getAnimations().map(({ finished }) => finished)),
  );

// A picture's cell, not the plan's.
const tile = (page: Page) => page.locator('.tile:not(.plan-tile)');

test('the mosaic shows the first picture at 4:3 and the others square, eight at most', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  // A plan takes a cell: Lärche's five pictures and its plan fill five, Zirbe's three and its plan
  // three.
  for (const [path, cells, more] of [
    ['/de/wohnungen/ahorn', 8, '+1 Bild'],
    ['/de/wohnungen/laerche', 5, '+1 Bild'],
    ['/de/wohnungen/zirbe', 3, '+1 Bild'],
    ['http://localhost:4002/it/appartamenti/zonneterras', 8, '+13 immagini'],
    ['http://localhost:4002/it/appartamenti/vista', 1, '+1 immagine'],
    ['http://localhost:4002/it/appartamenti/castagno', 1, null],
  ] as const) {
    await page.goto(path);
    const shown = page.locator('.tile:visible');
    await expect(shown, path).toHaveCount(cells);
    // To within a pixel, gaps and all.
    const first = await box(shown.first());
    expect(Math.abs(first.height * (4 / 3) - first.width), path).toBeLessThan(1);
    for (const cell of (await shown.all()).slice(1)) {
      const { width, height } = await box(cell);
      expect(Math.abs(width - height), path).toBeLessThan(1);
    }
    if (more) await expect(shown.last().locator('.more'), path).toHaveText(more);
    else await expect(page.locator('.more:visible'), path).toHaveCount(0);
  }
  // The +N label stands low, so that its picture shows; a focused cell's ring stands outside it,
  // in a gap wide enough not to touch the next.
  await page.goto('/de/wohnungen/ahorn');
  const last = page.locator('.tile').nth(7);
  const label = await box(last.locator('.more'));
  const cell = await box(last);
  expect(label.y).toBeGreaterThan(cell.y + cell.height / 2);
  await last.focus();
  await expect(last).toHaveCSS('outline-offset', '3px');
  await expect(page.locator('.tiles')).toHaveCSS('column-gap', '8px');
});

// The first visible picture's text in a cell or on a card.
const shownAlt = (place: Locator) =>
  place.evaluate((element) =>
    [...element.querySelectorAll('img')]
      .filter((img) => img.checkVisibility())
      .map((img) => img.alt),
  );

test('each season shows its own pictures, and a change fades to them in place', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  const fetched: string[] = [];
  page.on('request', (request) => fetched.push(new URL(request.url()).pathname));
  await page.goto('/de/wohnungen/ahorn?season=summer');
  await expect(page.locator('html')).toHaveAttribute('data-started', '');
  const first = page.locator('.tile').first();
  expect(await shownAlt(first)).toEqual([
    expect.stringMatching(/^Wohn- und Essraum mit Ahorntisch/),
  ]);
  // The winter pictures are not fetched in summer, the first cell's neither; the summer one is.
  await expect(first.locator('img[data-for=summer]')).toHaveJSProperty('complete', true);
  const files = (season: string) =>
    page
      .locator(`.tile img[data-for=${season}]`)
      .evaluateAll((images: HTMLImageElement[]) =>
        images.flatMap((image) => image.srcset.split(', ').map((part) => part.split(' ')[0])),
      );
  expect(fetched.filter((path) => path.includes('/pictures/apartments/'))).not.toEqual([]);
  for (const file of await files('winter')) expect(fetched).not.toContain(file);
  // Each cell's label is its shown picture's.
  for (const tile of await page.locator('.tile:visible').all()) {
    await expect(tile.locator('.ai-label:visible')).toHaveCount(1);
    expect(await tile.locator('.ai-label:visible').getAttribute('data-for')).toBe(
      await tile.locator('img:visible').getAttribute('data-for'),
    );
  }
  const boxes = () =>
    page
      .locator('.tile')
      .evaluateAll((tiles) => tiles.map((tile) => tile.getBoundingClientRect().toJSON()));
  const before = await boxes();
  await page.locator('.season-switch label[data-for=winter]').click();
  await expect(page.locator('html')).toHaveAttribute('data-season', 'winter');
  // The winter picture fades in over the summer one, which fades out.
  for (const season of ['winter', 'summer'])
    await expect(first.locator(`img[data-for=${season}]`)).toHaveCSS(
      'transition-property',
      'opacity, display, scale',
    );
  await expect.poll(() => shownAlt(first)).toEqual([expect.stringMatching(/brennendem Ofen/)]);
  expect(await boxes()).toEqual(before);
  await expect(first.locator('.ai-label:visible')).toHaveAttribute('data-for', 'winter');
  await page.locator('.tile').nth(2).click();
  await expect(viewer(page).locator('.viewer-count')).toHaveText('Bild 3 von 9');
  await expect(viewer(page).locator('.caption-in')).toContainText('sandfarbener Decke');
  await page.keyboard.press('Escape');

  // Closed, the viewer fetches nothing on a change of season: the slides near the current one
  // (which the closed track resets to the first) wait for it to open again.
  await expect(viewer(page)).not.toHaveAttribute('open');
  await page.locator('.season-switch label[data-for=summer]').click();
  await expect(page.locator('html')).toHaveAttribute('data-season', 'summer');
  await expect(viewer(page).locator('img[loading=eager]')).toHaveCount(0);

  // A bathroom without a view serves both seasons: its place has one picture.
  await page.goto('/de/wohnungen/zirbe?season=winter');
  await expect(tile(page).nth(2).locator('img')).toHaveCount(1);
  expect(await shownAlt(page.locator('.tile').first())).toEqual([
    expect.stringMatching(/^Zirbenstube im Winter/),
  ]);
  // And so does the card's first picture.
  await page.goto('/de?season=winter');
  expect(await shownAlt(page.locator('.teaser-picture').first())).toEqual([
    expect.stringMatching(/^Zirbenstube im Winter/),
  ]);
});

test('a picture opens full screen, and the buttons, the keys and the thumbnails move', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto('/de/wohnungen/ahorn');
  // The viewer's pictures wait for it to open.
  await expect(viewer(page).locator('img[loading="eager"]')).toHaveCount(0);
  const cell = page.locator('.tile').nth(2);
  await cell.click();
  const count = viewer(page).locator('.viewer-count');
  await expect(count).toHaveText('Bild 3 von 9');
  await expect(viewer(page).locator('img[loading="eager"]')).toHaveCount(3);
  // The dialog itself takes the focus: on the close button, the first key would ring it.
  await expect(viewer(page)).toBeFocused();
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
  // The count and the close button stand in the screen's top corners, inside its padding.
  const counter = await box(count);
  const close = await box(viewer(page).locator('.viewer-close'));
  const room = await box(viewer(page));
  expect([counter.x, counter.y]).toEqual([16, 12]);
  expect([room.width - close.x - close.width, close.y]).toEqual([16, 12]);

  await viewer(page).getByRole('button', { name: 'Nächstes Bild' }).click();
  await expect(count).toHaveText('Bild 4 von 9');
  await page.keyboard.press('ArrowLeft');
  await expect(count).toHaveText('Bild 3 von 9');
  const thumb = viewer(page).getByRole('button', { name: 'Bild 9 von 9' });
  await thumb.click();
  await expect(count).toHaveText('Bild 9 von 9');
  await expect(thumb).toHaveAttribute('aria-current', 'true');
  // Shown by its full colour alone: a line around it would look like the focus ring. Only the
  // picture dims, so that a ring around another button keeps its contrast.
  const other = viewer(page).getByRole('button', { name: 'Bild 8 von 9' });
  await expect(thumb.locator('img:visible')).toHaveCSS('opacity', '1');
  await expect(thumb).toHaveCSS('box-shadow', 'none');
  await expect(other.locator('img:visible')).toHaveCSS('opacity', '0.4');
  await expect(other).toHaveCSS('opacity', '1');
  // Past the last picture the first follows.
  await page.keyboard.press('ArrowRight');
  await expect(count).toHaveText('Bild 1 von 9');
  // With a modifier an arrow is the browser's, such as Alt+Left for back.
  await page.keyboard.press('Alt+ArrowRight');
  await expect(count).toHaveText('Bild 1 von 9');
  // It fades out as it faded in, then gives the focus back. A second request while it fades
  // starts no second fade; Chromium may close at once, as it lets one Escape wait, not two.
  // The fades, the dialog's and its backdrop's, are counted and held as they start, so the second
  // key comes during them however slow the runner is; then they end, with animate as it was.
  await settled(page);
  await viewer(page).evaluate((dialog) => {
    const animate = dialog.animate;
    const held: Animation[] = [];
    dialog.dataset['fades'] = '0';
    dialog.animate = (...args) => {
      dialog.dataset['fades'] = String(held.push(animate.apply(dialog, args)));
      held.at(-1)!.pause();
      return held.at(-1)!;
    };
    dialog.addEventListener('release', () => {
      dialog.animate = animate;
      for (const fade of held) fade.finish();
    });
  });
  await page.keyboard.press('Escape');
  await expect(viewer(page)).toHaveAttribute('data-fades', '2');
  await page.keyboard.press('Escape');
  await expect(viewer(page)).toHaveAttribute('data-fades', '2');
  await viewer(page).dispatchEvent('release');
  await expect(viewer(page)).toBeHidden();
  await expect(cell).toBeFocused();
  // A fade the browser cuts short, as when it will not let Escape wait, does not close the viewer
  // opened again.
  await cell.click();
  await settled(page);
  await viewer(page).locator('.viewer-close').click();
  await viewer(page).evaluate((dialog: HTMLDialogElement) => dialog.close());
  await cell.click();
  await page.waitForTimeout(400);
  await expect(viewer(page)).toBeVisible();
});

test('a picture slides in, over the ends too, and its text fades; at once with reduced motion', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto('/de/wohnungen/laerche');
  await page.locator('.tile').first().click();
  const track = viewer(page).locator('.viewer-track');
  const moving = (index: number) =>
    track.evaluate(
      (element, index) =>
        [...element.querySelectorAll('.viewer-shot')]
          .filter((shot) => shot.checkVisibility())
          .at(index)!
          .getAnimations().length,
      index,
    );
  expect(await track.evaluate((element) => getComputedStyle(element).scrollBehavior)).toBe(
    'smooth',
  );
  // From the first picture back to the last: a jump, and the last arrives from the left.
  await page.keyboard.press('ArrowLeft');
  expect(await moving(4)).toBe(1);
  await expect(viewer(page).locator('.viewer-count')).toHaveText('Bild 5 von 5');
  await expect(viewer(page).locator('.caption-out')).toHaveCSS('animation-name', 'caption-out');
  await expect(viewer(page).locator('.caption-in')).toHaveCSS('animation-name', 'fade-in');

  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.keyboard.press('ArrowRight');
  expect(await moving(0)).toBe(0);
  await page.keyboard.press('ArrowRight');
  expect(await track.evaluate((element) => element.scrollLeft / element.clientWidth)).toBeCloseTo(
    1,
  );
  await expect(viewer(page).locator('.caption-out')).toHaveCSS('opacity', '0');
  await expect(viewer(page).locator('.caption-in')).toHaveCSS('animation-name', 'none');
  await expect(viewer(page).locator('.viewer-thumbs img').first()).toHaveCSS(
    'transition-duration',
    '0s',
  );
  await page.keyboard.press('Escape');
  expect(await viewer(page).evaluate((dialog) => dialog.open)).toBe(false);
  // Nor does a cell zoom under the pointer.
  await page.locator('.tile').nth(1).hover();
  await expect(page.locator('.tile').nth(1).locator('img:visible')).toHaveCSS('scale', 'none');
});

test('each picture is shown whole, at its own ratio, inside the 4:3 frame', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto('/de/wohnungen/ahorn');
  // The living room is 3:2 and the kitchen square.
  for (const index of [0, 1]) {
    await page.locator('.tile').nth(index).click();
    await settled(page);
    const picture = viewer(page).locator('.viewer-slide').nth(index).locator('img:visible');
    await expect(picture).toHaveJSProperty('complete', true);
    const natural = await picture.evaluate(
      (image: HTMLImageElement) => image.naturalWidth / image.naturalHeight,
    );
    const shown = await box(picture);
    const frame = await box(viewer(page).locator('.viewer-track'));
    expect(shown.width / shown.height).toBeCloseTo(natural, 1);
    expect(shown.x).toBeGreaterThanOrEqual(frame.x);
    expect(shown.y).toBeGreaterThanOrEqual(frame.y);
    expect(shown.x + shown.width).toBeLessThanOrEqual(frame.x + frame.width);
    expect(shown.y + shown.height).toBeLessThanOrEqual(frame.y + frame.height);
    await page.keyboard.press('Escape');
  }
});

test('twenty pictures: two rows of thumbnails in view, and the current one and its focus follow', async ({
  page,
}) => {
  await page.setViewportSize({ width: 768, height: 900 });
  await page.goto('http://localhost:4002/it/appartamenti/zonneterras');
  await page.locator('.tile').first().click();
  const thumbs = viewer(page).locator('.viewer-thumbs');
  const height = (await box(thumbs.getByRole('button').first())).height;
  expect((await box(thumbs)).height).toBeLessThan(3 * height);
  await thumbs.getByRole('button').first().focus();
  await page.keyboard.press('ArrowLeft');
  await expect(viewer(page).locator('.viewer-count')).toHaveText('Immagine 20 di 20');
  const last = thumbs.getByRole('button', { name: 'Immagine 20 di 20' });
  await expect(last).toBeFocused();
  // Whole, its ring with it: the padding keeps the ring's room inside the scroll.
  await expect(last).toBeInViewport({ ratio: 1 });
  const rows = await box(thumbs);
  const shown = await box(last);
  expect(shown.y + shown.height + 8).toBeLessThanOrEqual(rows.y + rows.height + 0.5);
  // Next brings the first back into view, by the rows' scroll alone.
  const before = await page.evaluate(() => scrollY);
  await viewer(page).getByRole('button', { name: 'Immagine successiva' }).click();
  await expect(thumbs.getByRole('button', { name: 'Immagine 1 di 20' })).toBeInViewport({
    ratio: 1,
  });
  expect(await page.evaluate(() => scrollY)).toBe(before);
  // Chosen on a phone, where there are no thumbnails, it is in view once they appear.
  await page.setViewportSize({ width: 320, height: 640 });
  await page.keyboard.press('ArrowLeft');
  await expect(viewer(page).locator('.viewer-count')).toHaveText('Immagine 20 di 20');
  await page.setViewportSize({ width: 768, height: 900 });
  await expect(last).toBeInViewport({ ratio: 1 });
  // On a short screen, a landscape phone or a zoomed window, they would leave the picture no room.
  await page.setViewportSize({ width: 768, height: 360 });
  await expect(thumbs).toBeHidden();
  await settled(page);
  expect((await box(viewer(page).locator('.viewer-track'))).height).toBeGreaterThan(150);
});

test('two pictures: past either end the other picture arrives from the side asked for', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto('http://localhost:4002/it/appartamenti/vista');
  await page.locator('.tile').first().click();
  const arrival = (index: number) =>
    viewer(page)
      .locator('.viewer-shot')
      .nth(index)
      .evaluate((shot) => String(shot.getAnimations()[0]?.effect?.getKeyframes()[0].transform));
  await page.keyboard.press('ArrowRight');
  expect(await arrival(1)).toBe('undefined');
  await settled(page);
  await page.keyboard.press('ArrowRight');
  expect(await arrival(0)).toBe('translateX(8%)');
  await page.keyboard.press('ArrowLeft');
  expect(await arrival(1)).toBe('translateX(-8%)');
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
  // Without buttons the frame takes their room too.
  await page.setViewportSize({ width: 768, height: 1024 });
  await settled(page);
  const frame = await box(viewer(page).locator('.viewer-track'));
  const stage = await box(viewer(page).locator('.viewer-stage'));
  expect(frame.width).toBeCloseTo(stage.width, 0);
});

test('on a phone the pictures are a strip, and the viewer’s buttons sit under the frame', async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 640 });
  await page.goto('/de/wohnungen/ahorn');
  await expect(page.locator('.strip-count')).toHaveText('1 / 9');
  // A swipe before the application has started is outside what the site supports.
  await expect(page.locator('html')).toHaveAttribute('data-started', '');
  await page
    .locator('.tiles')
    .evaluate((element) =>
      element.scrollTo({ left: element.clientWidth * 3, behavior: 'instant' }),
    );
  await expect(page.locator('.strip-count')).toHaveText('4 / 9');
  // A tap on the count reaches the picture under it; mid-screen, clear of the booking bar.
  await page
    .locator('.tiles')
    .evaluate((element) => element.scrollIntoView({ block: 'center', behavior: 'instant' }));
  const counter = await box(page.locator('.strip-count'));
  await page.mouse.click(counter.x + counter.width / 2, counter.y + counter.height / 2);
  await expect(viewer(page).locator('.viewer-count')).toHaveText('Bild 4 von 9');
  await settled(page);
  const frame = await box(viewer(page).locator('.viewer-track'));
  // The dialog's width: a desktop keeps its scrollbar's room beside it; a phone has none.
  const room = (await box(viewer(page))).width;
  expect(frame.width).toBe(room);
  for (const button of ['.viewer-previous', '.viewer-next'])
    expect((await box(viewer(page).locator(button))).y).toBeGreaterThan(frame.y + frame.height);
  await expect(viewer(page).locator('.viewer-thumbs')).toBeHidden();
  // The room beside the scrollbar, not the root's own width, which a too-wide floor would set.
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth)).toBe(room);
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
  // The scrollbar's room stays, so the page seen through the fades does not shift.
  await expect(page.locator('html')).toHaveCSS('scrollbar-gutter', 'stable');
  await page.mouse.move(640, 400);
  await page.mouse.wheel(0, 600);
  await page.keyboard.press('Escape');
  await expect(viewer(page)).toBeHidden();
  expect(await page.evaluate(() => scrollY)).toBe(300);
});

test('a picture the mosaic leaves out gives the focus back to its +N cell', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 640 });
  await page.goto('/de/wohnungen/ahorn');
  await page.locator('.tiles').evaluate((strip) => strip.scrollTo({ left: strip.clientWidth * 8 }));
  await page.locator('.tile').nth(8).click();
  await expect(viewer(page).locator('.viewer-count')).toHaveText('Bild 9 von 9');
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.keyboard.press('Escape');
  await expect(page.locator('.tile').nth(7)).toBeFocused();
});

test('after a swipe the keys go on from the picture swiped to', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto('/de/wohnungen/ahorn');
  await page.locator('.tile').first().click();
  // Before the viewer has measured its frame, it would scroll back to the picture it opened with.
  await settled(page);
  const count = viewer(page).locator('.viewer-count');
  const track = viewer(page).locator('.viewer-track');
  // A frame a fraction of a pixel wide, which clientWidth would round.
  expect(
    await track.evaluate((element) => parseFloat(getComputedStyle(element).width) % 1),
  ).not.toBe(0);
  for (const [to, shown] of [
    [5, 'Bild 6 von 9'],
    [2, 'Bild 3 von 9'],
  ] as const) {
    // Where a swipe ends: lined up with a picture, without the slide.
    await track.evaluate(
      (element, to) =>
        element.scrollTo({
          left: parseFloat(getComputedStyle(element).width) * to,
          behavior: 'instant',
        }),
      to,
    );
    await expect(count).toHaveText(shown);
    await expect
      .poll(() =>
        track.evaluate(
          (element) => element.scrollLeft / parseFloat(getComputedStyle(element).width),
        ),
      )
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
  test(
    `${path} passes axe with the viewer open, in both seasons and widths`,
    { tag: '@any-engine' },
    async ({ page }) => {
      for (const width of [320, 1280])
        for (const season of ['winter', 'summer']) {
          await page.setViewportSize({ width, height: 800 });
          await page.goto(`${path}?season=${season}`);
          await page.locator('.tile:visible').first().click();
          await settled(page);
          const { violations } = await new AxeBuilder({ page }).include('dialog').analyze();
          expect(violations, `at ${width} in ${season}`).toEqual([]);
        }
    },
  );

test('every tab stop in the viewer shows a focus ring, in both views', async ({
  page,
  browserName,
}) => {
  test.skip(browserName === 'webkit', 'Safari tabs only to fields unless told otherwise');
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto('/de/wohnungen/zirbe');
  // The tab stops from the dialog on, until Tab leaves for the browser's own controls.
  const walk = async () => {
    await viewer(page).focus();
    const seen: string[] = [];
    for (let i = 0; i < 12; i++) {
      await page.keyboard.press('Tab');
      const stop = await page.evaluate(() => {
        const element = document.activeElement as HTMLElement;
        // The pictures' row rings its picture, so that the ring fits it; a switch's radio its
        // label. A room on the plan has a ring drawn along its edges, on the next render.
        const ringed = element.matches('.viewer-track')
          ? element.querySelectorAll('img')[0]
          : element.matches('input')
            ? element.nextElementSibling?.matches('span')
              ? element.nextElementSibling
              : element.closest('label')!
            : element;
        const style = getComputedStyle(ringed);
        return {
          name:
            element.getAttribute('aria-label') ??
            (element.matches('input')
              ? element.closest('label')!.textContent!.trim()
              : element.tagName),
          body: element === document.body,
          room: element.matches('.plan-room') ? element.getAttribute('points') : null,
          ring: style.outlineStyle !== 'none' && parseFloat(style.outlineWidth) >= 2,
        };
      });
      if (stop.body) break;
      seen.push(stop.name);
      if (stop.room)
        await expect(viewer(page).locator('.plan-ring'), stop.name).toHaveAttribute(
          'points',
          stop.room,
        );
      else expect(stop.ring, stop.name).toBe(true);
    }
    return seen;
  };
  await tile(page).first().click();
  expect(await walk()).toEqual([
    'Fotos',
    'Schließen',
    'Voriges Bild',
    'Bilder',
    'Nächstes Bild',
    'Bild 1 von 3',
    'Bild 2 von 3',
    'Bild 3 von 3',
  ]);
  // A radio group is one stop, at its chosen radio; the plan adds its rooms.
  await viewer(page).getByTitle('Grundriss').click();
  expect(await walk()).toEqual([
    'Grundriss',
    'Schließen',
    'Wohnraum',
    'Duschbad',
    'Voriges Bild',
    'Bilder',
    'Nächstes Bild',
    'Bild 1 von 3',
    'Bild 2 von 3',
    'Bild 3 von 3',
  ]);
});

// The plan's view: the room framed on the plan, and the name on the shown picture.
const framed = (page: Page) => viewer(page).locator('.plan-box polygon[data-chosen]');
// The names on the picture in the frame; each slide has its own.
const named = (page: Page) =>
  expect.poll(() =>
    viewer(page)
      .locator('.viewer-track')
      .evaluate((track) => {
        const frame = track.getBoundingClientRect();
        return [...track.querySelectorAll('.viewer-room')]
          .filter((room) => {
            const { left } = room.getBoundingClientRect();
            return room.checkVisibility() && left >= frame.left && left < frame.right;
          })
          .map((room) => room.textContent!.trim());
      }),
  );

test('a floor plan takes the mosaic’s top right square; the strip and a lone picture have its pill', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  for (const path of [
    '/de/wohnungen/laerche',
    '/de/wohnungen/zirbe',
    'http://localhost:4002/it/appartamenti/zonneterras',
  ]) {
    await page.goto(path);
    const cells = await Promise.all((await page.locator('.tile:visible').all()).map(box));
    const square = await box(page.locator('.plan-tile'));
    expect(Math.abs(square.y - cells[0].y), path).toBeLessThan(1);
    expect(
      Math.abs(square.x + square.width - Math.max(...cells.map((c) => c.x + c.width))),
      path,
    ).toBeLessThan(1);
  }
  await page.goto('/de/wohnungen/laerche');
  // On oak, so that the square shows on the page's ground.
  await expect(page.locator('.plan-tile')).toHaveText('Grundriss');
  await expect(page.locator('.plan-tile')).toHaveCSS('background-color', 'rgb(234, 223, 206)');
  await expect(page.locator('.plan-pill')).toBeHidden();
  await page.goto('/de/wohnungen/ahorn');
  await expect(page.locator('.plan-tile, .plan-pill')).toHaveCount(0);
  // A mosaic of one picture has no square: the pill stands on the picture.
  await page.goto('http://localhost:4002/it/appartamenti/castagno');
  await expect(page.locator('.plan-tile')).toHaveCount(0);
  const pill = await box(page.locator('.plan-pill'));
  const only = await box(tile(page).first());
  expect(pill.y + pill.height).toBeLessThan(only.y + only.height);
  // In the strip the pill stands opposite the count.
  await phoneWidth(page, 320, 640);
  await page.goto('/de/wohnungen/laerche');
  await expect(page.locator('.plan-tile')).toBeHidden();
  const [left, right] = [
    await box(page.locator('.plan-pill')),
    await box(page.locator('.strip-count')),
  ];
  expect(left.x + left.width).toBeLessThan(right.x);
  expect(Math.abs(left.y + left.height - (right.y + right.height))).toBeLessThan(6);
  // Opened from the pill and closed on a wide screen, the focus goes to the square.
  await page.locator('.plan-pill').click();
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.keyboard.press('Escape');
  await expect(page.locator('.plan-tile')).toBeFocused();
});

test('the plan’s view frames the shown picture’s room, and a room on the plan shows its picture', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto('/de/wohnungen/laerche?season=summer');
  await page.locator('.plan-tile').click();
  await expect(viewer(page)).toHaveAttribute('data-view', 'plan');
  // Drawn in its view before it shows: the switch's knob does not glide there.
  expect(
    await viewer(page)
      .locator('.views-knob')
      .evaluate((knob) => knob.getAnimations().length),
  ).toBe(0);
  await expect(viewer(page).locator('.plan-box img')).toHaveAttribute(
    'alt',
    /^Grundriss der Lärche/,
  );
  await expect(viewer(page).locator('.viewer-count')).toHaveText('Bild 1 von 5');
  await expect(framed(page)).toHaveCount(1);
  await expect(viewer(page).locator('.plan-box polygon').first()).toHaveCSS('stroke-opacity', '1');
  await named(page).toEqual(['Wohnküche']);
  // The steps and the keys go through all the pictures, the room framed along.
  await page.keyboard.press('ArrowRight');
  await expect(viewer(page).locator('.viewer-count')).toHaveText('Bild 2 von 5');
  await named(page).toEqual(['Schlafzimmer']);
  await expect(viewer(page).locator('.plan-box polygon').nth(1)).toHaveAttribute('data-chosen', '');
  // A room on the plan: its first picture.
  await viewer(page).locator('.plan-box polygon').nth(3).click();
  await expect(viewer(page).locator('.viewer-count')).toHaveText('Bild 4 von 5');
  await expect(viewer(page).locator('.caption-in')).toHaveText(/Bad mit weißer Badewanne/);
  await named(page).toEqual(['Bad']);
  // A click rings nothing: neither the browser's own outline on a shape nor the room's ring.
  await expect(viewer(page).locator('.plan-room').nth(3)).toBeFocused();
  await expect(viewer(page).locator('.plan-room').nth(3)).toHaveCSS('outline-style', 'none');
  await expect(viewer(page).locator('.plan-ring')).toHaveCount(0);
  // By keys too: each room is a button by its name, the shown picture's current.
  const bedroom = viewer(page).getByRole('button', { name: 'Schlafzimmer', exact: true });
  await bedroom.focus();
  await page.keyboard.press('Enter');
  await expect(viewer(page).locator('.viewer-count')).toHaveText('Bild 2 von 5');
  await expect(bedroom).toHaveAttribute('aria-current', 'true');
  await viewer(page).getByRole('button', { name: 'Bad' }).focus();
  await page.keyboard.press(' ');
  await expect(viewer(page).locator('.viewer-count')).toHaveText('Bild 4 von 5');
  // A picture of no room: nothing framed, nothing named.
  await viewer(page).getByRole('button', { name: 'Nächstes Bild' }).click();
  await expect(viewer(page).locator('.viewer-count')).toHaveText('Bild 5 von 5');
  await expect(framed(page)).toHaveCount(0);
  await named(page).toEqual([]);
  // A name shows on the plan only where it fits inside its room on both sides of its point.
  const fits = viewer(page).locator('.plan-label[data-fits]');
  await expect(fits).not.toHaveCount(0);
  for (const label of await fits.all()) {
    const index = await label.evaluate((element) =>
      [...element.parentElement!.querySelectorAll('.plan-label')].indexOf(element as HTMLElement),
    );
    const zone = await box(viewer(page).locator('.plan-box polygon').nth(index));
    const name = await box(label);
    expect(name.x).toBeGreaterThanOrEqual(zone.x);
    expect(name.x + name.width).toBeLessThanOrEqual(zone.x + zone.width + 0.5);
  }
  const { violations } = await new AxeBuilder({ page }).include('dialog.viewer').analyze();
  expect(violations).toEqual([]);
  await page.keyboard.press('Escape');
  await expect(page.locator('.plan-tile')).toBeFocused();
  // A picture of two rooms is the first of the plan's, or the one chosen on the plan; a room of two
  // pictures frames both.
  await page.goto('http://localhost:4002/it/appartamenti/zonneterras');
  await tile(page).nth(1).click();
  await viewer(page).getByTitle('Planimetria').click();
  await named(page).toEqual(['Soggiorno']);
  await viewer(page).locator('.plan-box polygon').nth(1).click();
  await expect(viewer(page).locator('.viewer-count')).toHaveText('Immagine 2 di 20');
  await named(page).toEqual(['Giardino']);
  await expect(viewer(page).locator('.plan-box polygon').nth(1)).toHaveAttribute('data-chosen', '');
  // A room's ring follows its own edges, an L here, not its bounding box.
  await page.keyboard.press('Shift+Tab');
  await page.keyboard.press('Tab');
  await expect(viewer(page).locator('.plan-ring')).toHaveAttribute(
    'points',
    '255,10 390,10 390,290 320,290 320,150 255,150',
  );
  await page.goto('/de/wohnungen/zirbe');
  await page.locator('.plan-tile').click();
  for (const count of ['Bild 1 von 3', 'Bild 2 von 3']) {
    await expect(viewer(page).locator('.viewer-count')).toHaveText(count);
    await named(page).toEqual(['Wohnraum']);
    await expect(viewer(page).locator('.plan-box polygon').first()).toHaveAttribute(
      'data-chosen',
      '',
    );
    await page.keyboard.press('ArrowRight');
  }
});

test('the switch keeps the picture, and leaves itself and the close button where they are', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto('/de/wohnungen/laerche');
  await tile(page).nth(2).click();
  await expect(viewer(page).locator('.viewer-count')).toHaveText('Bild 3 von 5');
  const places = async () =>
    Promise.all(['.viewer-views', '.viewer-close'].map((part) => box(viewer(page).locator(part))));
  // Also at the end of its scale: fixed, they would stand inside the frame until it ends.
  await viewer(page).evaluate((dialog) =>
    dialog.getAnimations().forEach((animation) => {
      animation.pause();
      animation.currentTime = 299.99;
    }),
  );
  const scaling = await places();
  await viewer(page).evaluate((dialog) => dialog.getAnimations().forEach((one) => one.finish()));
  await settled(page);
  const before = await places();
  for (const [index, { x, y }] of scaling.entries()) {
    expect(Math.abs(x - before[index].x)).toBeLessThan(0.5);
    expect(Math.abs(y - before[index].y)).toBeLessThan(0.5);
  }
  await viewer(page).getByTitle('Grundriss').click();
  await expect(viewer(page).locator('.viewer-count')).toHaveText('Bild 3 von 5');
  await named(page).toEqual(['Stockbettzimmer']);
  expect(await places()).toEqual(before);
  // On the switch the arrows choose a view, as in any radio group: the button steps.
  await viewer(page).getByRole('button', { name: 'Nächstes Bild' }).click();
  await viewer(page).getByTitle('Fotos').click();
  await expect(viewer(page)).toHaveAttribute('data-view', 'photos');
  await expect(viewer(page).locator('.viewer-count')).toHaveText('Bild 4 von 5');
  await expect(viewer(page).locator('.caption-in')).toHaveText(/Bad mit weißer Badewanne/);
  await named(page).toEqual([]);
  expect(await places()).toEqual(before);
  // Without a plan the close button is where it is with one, and the count in the switch's corner.
  await page.keyboard.press('Escape');
  await page.goto('/de/wohnungen/ahorn');
  await tile(page).first().click();
  await settled(page);
  expect(await box(viewer(page).locator('.viewer-close'))).toEqual(before[1]);
  const count = await box(viewer(page).locator('.viewer-count'));
  expect([count.x, count.y, count.height]).toEqual([before[0].x, before[0].y, before[0].height]);
});

test('on a phone the plan stands above the picture, its buttons and its text', async ({ page }) => {
  await phoneWidth(page, 320, 640);
  await page.goto('/de/wohnungen/laerche?season=winter');
  await page.locator('.plan-pill').click();
  await expect(viewer(page)).toHaveAttribute('data-view', 'plan');
  await named(page).toEqual(['Wohnküche']);
  // Measured at once, after the viewer has scrolled its text into view.
  await viewer(page).locator('.viewer-caption').scrollIntoViewIfNeeded();
  const [plan, frame, button, caption, previous, count, overflow] = (await viewer(page).evaluate(
    (dialog) => [
      ...[
        '.plan-box',
        '.viewer-track',
        '.viewer-next',
        '.viewer-caption',
        '.viewer-previous',
        '.viewer-count',
      ].map((part) => {
        const { left, right, top, bottom } = dialog.querySelector(part)!.getBoundingClientRect();
        return { left, right, top, bottom };
      }),
      dialog.scrollWidth - dialog.clientWidth,
    ],
  )) as [DOMRect, DOMRect, DOMRect, DOMRect, DOMRect, DOMRect, number];
  // Centred between the buttons, though the switch above widens the first column.
  expect(Math.abs(count.left + count.right - previous.left - button.right)).toBeLessThan(1);
  expect(Math.abs(count.top + count.bottom - previous.top - previous.bottom)).toBeLessThan(1);
  expect(plan.left).toBeGreaterThanOrEqual(0);
  expect(plan.right).toBeLessThanOrEqual(320);
  expect(frame.top).toBeGreaterThan(plan.bottom);
  expect(button.top).toBeGreaterThan(frame.bottom);
  expect(caption.top).toBeGreaterThan(button.bottom);
  expect(overflow).toBe(0);
  await expect(viewer(page).locator('.caption-in')).toHaveText(
    /Wohnküche aus Lärche mit anthrazit/,
  );
});
