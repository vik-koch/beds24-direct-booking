import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

// The server dates the seasons by today, so these tests take the seasons from the page. The
// simulator prices every season ahead of today, so the next season always has free weeks.
const cards = (page: Page) => page.locator('.teaser');
const prices = (page: Page) => page.locator('.teaser-price > :visible');
const settled = (page: Page) =>
  expect.poll(() => page.evaluate(() => document.getAnimations().length)).toBe(0);

// The free-weeks list's button, once the application has started.
async function toOtherSeason(page: Page) {
  const before = await page.locator('html').getAttribute('data-season');
  await expect(page.locator('html')).toHaveAttribute('data-started', '');
  await page.locator('.other-season').click();
  await expect(page.locator('html')).not.toHaveAttribute('data-season', before!);
  await settled(page);
}

// Each card's picture and name, as boxes.
const boxes = (page: Page) =>
  cards(page).evaluateAll((all) =>
    all.map((card) => ({
      picture: card.querySelector('.teaser-picture')!.getBoundingClientRect().toJSON(),
      name: card.querySelector('h3')!.getBoundingClientRect().toJSON(),
    })),
  );

test(
  'each apartment shows its picture, headline, facts and the price of the shown season',
  { tag: '@any-engine' },
  async ({ page }) => {
    await page.goto('/de');
    await expect(cards(page).locator('h3')).toHaveText(['Zirbe', 'Lärche', 'Ahorn']);
    await expect(cards(page).first()).toContainText('Für zwei, mit Regendusche');
    await expect(cards(page).first().locator('.teaser-facts li')).toHaveText([
      'Bis 2 Gäste',
      '1 Schlafzimmer',
      '34 m²',
    ]);
    await expect(cards(page).locator('.ai-label').first()).toHaveText('KI-Bild');
    // The shown season's picture: Zirbe's first has a winter twin.
    const shown = await page.locator('html').getAttribute('data-season');
    await expect(cards(page).locator('img:visible').first()).toHaveAttribute(
      'alt',
      shown === 'winter' ? /^Zirbenstube im Winter/ : /^Zirbenstube mit Doppelbett/,
    );

    const line = /^\s*(ab €\s[\d.,]+ pro Woche|Im (Winter|Sommer) ist keine Woche mehr frei\.)\s*$/;
    for (let i = 0; i < 2; i++) {
      const season = await page.locator('html').getAttribute('data-season');
      await expect(prices(page)).toHaveCount(3);
      for (const price of await prices(page).all()) {
        await expect(price).toHaveText(line);
        await expect(price).toHaveAttribute('data-for', season!);
      }
      if (i === 0) await toOtherSeason(page);
    }
    // The next season is always priced.
    await expect(prices(page).first()).toHaveText(/^\s*ab €\s[\d.,]+ pro Woche\s*$/);
  },
);

test('a card is one link and one tab stop, ringed as a whole', async ({ page }) => {
  await page.goto('/en');
  const links = page.locator('.teasers').getByRole('link');
  await expect(links).toHaveText(['Zirbe', 'Lärche', 'Ahorn']);
  await expect(links.nth(1)).toHaveAttribute('href', '/en/apartments/laerche');

  await links.first().focus();
  await page.keyboard.press('Tab');
  await expect(links.nth(1)).toBeFocused();
  await expect(cards(page).nth(1)).toHaveCSS('outline-style', 'solid');
  await expect(cards(page).first()).toHaveCSS('outline-style', 'none');

  // The name's link lies over the whole card, the picture too.
  await cards(page)
    .nth(2)
    .click({ position: { x: 40, y: 40 } });
  await expect(page).toHaveURL('/en/apartments/ahorn');
});

test(
  "each card's price is the cheapest free week of its apartment in the shown season",
  { tag: '@any-engine' },
  async ({ page }) => {
    await page.goto('/en');
    const amount = (text: string) => Number(text.replace(/[^\d.]/g, ''));
    for (let i = 0; i < 2; i++) {
      for (const [index, card] of (await cards(page).all()).entries()) {
        const list = await page
          .locator(`.weeks-body:visible [data-pick^='${index}-'] .price`)
          .allTextContents();
        const price = card.locator('.teaser-price > :visible strong');
        if (!list.length) await expect(price).toHaveCount(0);
        else expect(amount(await price.innerText())).toBe(Math.min(...list.map(amount)));
      }
      if (i === 0) await toOtherSeason(page);
    }
  },
);

test('one to four cards stand stacked, as rows, in columns or two by two', async ({ page }) => {
  // Picture beside the name, or above it.
  const beside = (box: Awaited<ReturnType<typeof boxes>>[number]) =>
    box.picture.right <= box.name.left;
  const columns = async () => new Set((await boxes(page)).map((box) => box.picture.left)).size;

  await page.setViewportSize({ width: 320, height: 800 });
  await page.goto('/de');
  expect(await columns()).toBe(1);
  expect((await boxes(page)).some(beside)).toBe(false);

  await page.setViewportSize({ width: 768, height: 800 });
  expect(await columns()).toBe(1);
  expect((await boxes(page)).every(beside)).toBe(true);

  await page.setViewportSize({ width: 1280, height: 800 });
  expect(await columns()).toBe(3);
  expect((await boxes(page)).some(beside)).toBe(false);

  // The layout follows the count alone, so fewer cards are the demo's with some taken out.
  await expect(page.locator('.teasers')).toHaveAttribute('data-count', '3');
  const keep = (count: number) =>
    page.evaluate((count) => {
      const list = document.querySelector<HTMLElement>('.teasers')!;
      [...list.children].slice(count).forEach((card) => card.remove());
      list.dataset['count'] = String(count);
    }, count);
  await keep(2);
  expect(await columns()).toBe(2);
  await page.setViewportSize({ width: 768, height: 800 });
  expect(await columns()).toBe(2);
  await keep(1);
  expect((await boxes(page)).every(beside)).toBe(true);

  await page.goto('http://localhost:4002/it');
  await expect(page.locator('.teasers')).toHaveAttribute('data-count', '4');
  // Its rooms have no headline, which leaves no empty line.
  await expect(page.locator('.teaser-headline')).toHaveCount(0);
  for (const width of [768, 1280]) {
    await page.setViewportSize({ width, height: 800 });
    expect(await columns()).toBe(2);
    expect(new Set((await boxes(page)).map((box) => box.picture.top)).size).toBe(2);
  }
  await expect(prices(page)).toHaveCount(4);
});

test(
  'without Beds24 the cards keep their picture and name',
  { tag: '@any-engine' },
  async ({ page }) => {
    await page.goto('http://localhost:4001/en');
    await expect(page.locator('.teasers').getByRole('link')).toHaveText([
      'Zirbe',
      'Lärche',
      'Ahorn',
    ]);
    await expect(cards(page).locator('img:visible')).toHaveCount(3);
    await expect(page.locator('.teaser-facts, .teaser-price')).toHaveCount(0);
  },
);

interface Probe {
  gaps: { season: string; gap: number }[] | null;
}

test('the price keeps its space after “from” while the seasons cross-fade', async ({ page }) => {
  for (const path of ['/en', '/de']) {
    await page.goto(path);
    await settled(page);
    // The glitch is in the leaving line, so the fade starts from a priced season: the next one
    // always is.
    const season = () => page.locator('html').getAttribute('data-season');
    if (!(await page.locator(`.teaser-price > [data-for=${await season()}] strong`).count()))
      await toOtherSeason(page);
    const leaving = await season();
    // Each frame, the gap between the word and the price on every line that is fading.
    await page.evaluate(() => {
      const probe = window as unknown as Probe;
      const gaps = (probe.gaps = []) as Probe['gaps'];
      const measure = () => {
        for (const line of document.querySelectorAll<HTMLElement>('.teaser-price > span')) {
          const price = line.querySelector('strong');
          const word = price?.previousSibling;
          const opacity = Number(getComputedStyle(line).opacity);
          if (!price || !word || opacity === 0 || opacity === 1) continue;
          const range = document.createRange();
          range.selectNodeContents(word);
          range.setEnd(word, word.textContent!.trimEnd().length);
          const gap = price.getBoundingClientRect().left - range.getBoundingClientRect().right;
          gaps.push({ season: line.dataset['for']!, gap });
        }
        if (probe.gaps) requestAnimationFrame(measure);
      };
      requestAnimationFrame(measure);
    });
    await toOtherSeason(page);
    const gaps = await page.evaluate(() => {
      const probe = window as unknown as Probe;
      const gaps = probe.gaps!;
      probe.gaps = null;
      return gaps;
    });
    expect(gaps.filter((one) => one.season === leaving).length, path).toBeGreaterThan(0);
    expect(Math.min(...gaps.map((one) => one.gap)), path).toBeGreaterThan(2);
  }
});

test('a season not open yet says so on each card', async ({ page }) => {
  // Its prices end today: the current season is full, the next one not open.
  await page.goto('http://localhost:4003/en');
  await expect(prices(page).first()).toHaveText(
    /^\s*No week of (Winter|Summer) is free any more\.\s*$/,
  );
  await toOtherSeason(page);
  const season = await page.locator('html').getAttribute('data-season');
  await expect(page.locator(`.teaser-price > [data-for='${season}']`)).toHaveText(
    Array(3).fill(/^\s*The weeks of (Winter|Summer) are not open yet\.\s*$/),
  );
});

test('the cards pass axe in both seasons', async ({ page }) => {
  await page.goto('/en');
  for (let i = 0; i < 2; i++) {
    await settled(page);
    const { violations } = await new AxeBuilder({ page }).include('.teasers').analyze();
    expect(violations).toEqual([]);
    if (i === 0) await toOtherSeason(page);
  }
});
