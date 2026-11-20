import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Locator, type Page } from '@playwright/test';

// The server dates the seasons by today, so these tests take the seasons from the page. The
// simulator prices every season ahead of today, so the next season always has free weeks.
const panel = (page: Page) => page.locator('.weeks-body:visible');
const button = (page: Page) => page.locator('.other-season');
const season = (page: Page) => page.locator('html').getAttribute('data-season');
const settled = (page: Page) =>
  expect.poll(() => page.evaluate(() => document.getAnimations().length)).toBe(0);

// The list's button, repeated until the page follows: a click during hydration can be lost.
async function toOtherSeason(page: Page) {
  const before = await season(page);
  await expect(async () => {
    await button(page).click();
    await expect(page.locator('html')).not.toHaveAttribute('data-season', before!, {
      timeout: 500,
    });
  }).toPass();
  await settled(page);
}

test('the next season lists its weeks with a price or "booked" per apartment', async ({ page }) => {
  // Every apartment's column, as from 48rem up.
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto('/en');
  await expect(button(page)).toHaveAccessibleName(
    /^Next season: (Winter \d{4}\/\d\d|Summer \d{4})$/,
  );
  await toOtherSeason(page);
  const grid = page.getByRole('grid', { name: 'Free weeks' });
  for (const name of ['Zirbe', 'Lärche', 'Ahorn'])
    await expect(grid.getByRole('columnheader', { name })).toContainText(/\d guests · \d+\sm²/);
  await expect(grid.getByRole('columnheader', { name: 'Zirbe' })).toHaveAccessibleName(
    /^Zirbe · \d guests · \d+ square metres$/,
  );
  const dates = await panel(page).getByRole('rowheader').first().innerText();
  // Older locale data puts a comma after the weekday, as WebKit on Ubuntu 24.04 does.
  expect(dates.replace(/\s+/g, ' ').trim()).toMatch(/^Sat,? \d\d\/\d\d – Sat,? \d\d\/\d\d$/);
  // The headers say the week and the apartment, so a cell says only its own price or "booked".
  await expect(panel(page).getByRole('rowheader').first()).toHaveAccessibleName(
    /^Saturday,? \d+ \w+ – Saturday,? \d+ \w+$/,
  );
  await expect(panel(page).locator('.stay').first()).toHaveAccessibleName(/^€[\d,.]+$/);
  await expect(panel(page).locator('.booked').first()).toHaveAccessibleName('booked');
  await expect(panel(page).getByText('booked').first()).toBeVisible();
  await expect(page.locator('.weeks-note')).toHaveText(
    'Price per week including the final cleaning. Plus a local tax of €3.50 per adult and night.',
  );
});

test('only the price chooses its week, and only the price reacts to the mouse', async ({
  page,
}) => {
  // The columns share the card's width here, so the cell is wider than its price.
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto('/en');
  await toOtherSeason(page);
  const stay = panel(page).locator('.stay').first();
  const price = stay.locator('.price');
  const unlit = 'rgba(0, 0, 0, 0)';
  await stay.scrollIntoViewIfNeeded();
  const cell = (await stay.boundingBox())!;
  const beside = { x: cell.x + 4, y: cell.y + cell.height / 2 };
  await expect(stay).toHaveCSS('cursor', 'auto');
  await expect(price).toHaveCSS('cursor', 'pointer');
  await expect(panel(page).locator('.booked').first()).toHaveCSS('cursor', 'auto');
  // Lit first, so that unlit beside it is not the start of the pill's transition.
  await price.hover();
  await expect(price).not.toHaveCSS('background-color', unlit);
  await page.mouse.move(beside.x, beside.y);
  await expect(price).toHaveCSS('background-color', unlit);
  await page.mouse.click(beside.x, beside.y);
  await expect(stay).toHaveAttribute('aria-selected', 'false');
  await expect(page.locator('.pick')).toHaveCount(0);
  await price.click();
  await expect(stay).toHaveAttribute('aria-selected', 'true');
});

test('a click without a pointer chooses a free cell from anywhere, and never a booked one', async ({
  page,
}) => {
  // Every apartment's column: on a phone the one shown may be booked out all season.
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto('/en');
  await toOtherSeason(page);
  const stay = panel(page).locator('.stay:visible').first();
  await stay.dispatchEvent('click');
  await expect(stay).toHaveAttribute('aria-selected', 'true');
  const booked = panel(page).locator('.booked:visible').first();
  // A booked cell's click would clear the chosen week.
  await booked.dispatchEvent('click');
  await expect(stay).toHaveAttribute('aria-selected', 'true');
});

test('a chosen week leads to its apartment with the stay, also in a fresh browser', async ({
  page,
  browser,
}) => {
  await page.goto('/de');
  await toOtherSeason(page);
  const first = panel(page).locator('.stay:visible').first();
  const column = await first.getAttribute('aria-colindex');
  const apartment = await page
    .locator(`[role=columnheader][aria-colindex="${column}"] .weeks-name`)
    .innerText();
  const dates = await first.locator('..').getByRole('rowheader').innerText();
  const price = await first.innerText();
  await first.locator('.price').click();
  await expect(first).toHaveAttribute('aria-selected', 'true');
  await expect(page.locator('.pick output')).toHaveText(
    `${apartment} · ${dates.replace(/\s+/g, ' ').trim()} · ${price}`,
  );
  await page.getByRole('link', { name: 'Weiter zur Buchung' }).click();
  await expect(page).toHaveURL(
    /\/de\/wohnungen\/(zirbe|laerche|ahorn)\?arrival=\d{4}-\d\d-\d\d&departure=\d{4}-\d\d-\d\d&season=(winter|summer)$/,
  );
  const url = new URL(page.url());
  const days =
    (Date.parse(url.searchParams.get('departure')!) -
      Date.parse(url.searchParams.get('arrival')!)) /
    864e5;
  expect(days).toBe(7);
  // Sent on: whoever opens it sees the week's season and the week chosen.
  const fresh = await browser.newPage();
  await fresh.goto(page.url());
  await expect(fresh.locator('html')).toHaveAttribute(
    'data-season',
    url.searchParams.get('season')!,
  );
  await expect(
    fresh.locator('.panel-season:visible .month[data-current] [aria-selected=true]'),
  ).toHaveCount(1);
  await fresh.close();
});

test('a chosen week is cleared by a second click, Enter, Space or the bar, and waits for its season', async ({
  page,
}) => {
  await page.goto('/en');
  await toOtherSeason(page);
  const stay = panel(page).locator('.stay:visible').first();
  const selected = () => expect(stay).toHaveAttribute('aria-selected', 'true');
  const unselected = () => expect(stay).toHaveAttribute('aria-selected', 'false');
  await stay.locator('.price').click();
  await expect(page.locator('.pick')).toBeVisible();
  await stay.locator('.price').click();
  await unselected();
  await expect(page.locator('.pick')).toHaveCount(0);
  await stay.focus();
  for (const key of ['Enter', ' ']) {
    await page.keyboard.press(key);
    await selected();
    await page.keyboard.press(key);
    await unselected();
  }

  await stay.locator('.price').click();
  const chosen = await page.locator('.pick output').textContent();
  // The bar belongs to its season: hidden while the other one is shown, back with its own.
  await button(page).click();
  await settled(page);
  await expect(page.locator('.pick')).toBeHidden();
  await button(page).click();
  await settled(page);
  await expect(page.locator('.pick output')).toHaveText(chosen!);
  await page.getByRole('button', { name: 'Clear the chosen week' }).click();
  await expect(page.locator('.pick')).toHaveCount(0);
  await unselected();
  await expect(stay).toBeFocused();
});

// The cross returns the focus to the price. A pointer has no use for the price's place, so the
// page stays; a keyboard follows the focus. Pressed by coordinates: a locator's click would
// scroll the cross into view itself.
test('the bar’s cross keeps the page in place for a pointer and shows the price for a keyboard', async ({
  page,
}, { project }) => {
  // Where the page rests once a smooth scroll, if any, has ended.
  const rest = () =>
    page.evaluate(
      () =>
        new Promise<number>((done) => {
          addEventListener('scrollend', () => done(scrollY), { once: true });
          setTimeout(() => done(scrollY), 1000);
        }),
    );
  await page.goto('/en');
  await toOtherSeason(page);
  for (const width of [1280, 375]) {
    await page.setViewportSize({ width, height: 800 });
    const press = project.use.hasTouch
      ? (x: number, y: number) => page.touchscreen.tap(x, y)
      : (x: number, y: number) => page.mouse.click(x, y);
    for (const by of [press, null]) {
      const stays = panel(page).locator('.stay:visible');
      const stay = stays.nth(Math.floor((await stays.count()) / 2));
      await stay.locator('.price').click();
      await expect(page.locator('.pick')).toBeVisible();
      // The price 100 px below the window.
      await stay.evaluate((cell) =>
        scrollBy({
          top: cell.getBoundingClientRect().top - innerHeight - 100,
          behavior: 'instant',
        }),
      );
      await expect(stay).not.toBeInViewport();
      const before = await page.evaluate(() => scrollY);
      const cross = page.getByRole('button', { name: 'Clear the chosen week' });
      if (by) {
        const box = (await cross.boundingBox())!;
        await by(box.x + box.width / 2, box.y + box.height / 2);
      } else {
        await cross.focus();
        await page.keyboard.press('Enter');
      }
      await expect(page.locator('.pick')).toHaveCount(0);
      await expect(stay).toBeFocused();
      if (by) expect(await rest(), `${width}`).toBe(before);
      else await expect(stay).toBeInViewport();
    }
  }
});

// The grid pattern of the WAI-ARIA Authoring Practices: one tab stop, arrows that move without
// choosing, Home and End in a row, Page Up and Page Down by a month.
test('the list is one tab stop that the keys move through as a grid', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto('/en');
  await toOtherSeason(page);
  const cells = panel(page).locator('[data-pick]');
  const at = () => page.evaluate(() => document.activeElement?.getAttribute('data-pick'));
  const press = async (key: string, pick: string) => {
    await page.keyboard.press(key);
    await expect.poll(at, key).toBe(pick);
  };
  await expect(page.locator('.weeks-grid [tabindex="0"]')).toHaveCount(1);

  await button(page).focus();
  await page.keyboard.press('Tab');
  await expect.poll(at).toBe('0-0');
  await press('ArrowRight', '1-0');
  await press('ArrowDown', '1-1');
  await press('End', '2-1');
  await press('Home', '0-1');
  await press('ArrowUp', '0-0');
  await expect(panel(page).locator('[aria-selected=true]')).toHaveCount(0);

  // Page Down goes to the next month's week at the same place in it.
  const months = await panel(page)
    .locator('.weeks-month')
    .evaluateAll((groups) =>
      groups.map((group) =>
        [...group.querySelectorAll('[data-pick^="0-"]')].map(
          (cell) => (cell as HTMLElement).dataset['pick'],
        ),
      ),
    );
  await press('PageDown', months[1][0]!);
  await press('PageUp', months[0][0]!);
  await press('Control+End', (await cells.last().getAttribute('data-pick'))!);
  await press('Control+Home', '0-0');

  // A booked week can be reached, but Enter on it leaves the chosen week alone.
  const free = panel(page).locator('.stay').first();
  const booked = panel(page).locator('.booked').first();
  await free.focus();
  await page.keyboard.press('Enter');
  await expect(free).toHaveAttribute('aria-selected', 'true');
  await booked.focus();
  await page.keyboard.press('Enter');
  await page.keyboard.press(' ');
  await expect(free).toHaveAttribute('aria-selected', 'true');

  // Tab leaves the list for the bar; Shift+Tab, and Tab after a change of season and back,
  // enter at the chosen week.
  await page.keyboard.press('Tab');
  await expect(page.getByRole('button', { name: 'Clear the chosen week' })).toBeFocused();
  await page.keyboard.press('Shift+Tab');
  await expect(free).toBeFocused();
  await toOtherSeason(page);
  await toOtherSeason(page);
  await button(page).focus();
  await page.keyboard.press('Tab');
  await expect(free).toBeFocused();
  await expect(page.locator('.weeks-grid [tabindex="0"]')).toHaveCount(1);
});

// A busy phone can take the next key before the grid has rendered the last one. Angular renders
// from a timeout or an animation frame, so without them it does not render at all.
test('Tab right after Page Up leaves the list, also before the grid renders', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto('/en');
  // The next season has two months of weeks also when the current one is in its last.
  await toOtherSeason(page);
  const months = panel(page).locator('.weeks-month');
  const later = months.nth(1).locator('[data-pick]').first();
  await later.focus();
  await expect(later).toHaveAttribute('tabindex', '0');
  await page.evaluate(() => {
    window.setTimeout = (() => 0) as never;
    window.requestAnimationFrame = () => 0;
  });
  await page.keyboard.press('PageUp');
  await expect(months.first().locator('[data-pick]').first()).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(page.locator('.weeks-grid :focus')).toHaveCount(0);
});

test('a week chosen in a wide window stays shown when it narrows', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto('/en');
  await toOtherSeason(page);
  const week = panel(page).locator('.stay[data-pick^="1-"]').first();
  await week.focus();
  await page.keyboard.press('Enter');
  await expect(week).toHaveAttribute('aria-selected', 'true');
  await page.setViewportSize({ width: 375, height: 800 });
  await expect(page.locator('.room-tabs input').nth(1)).toBeChecked();
  await expect(week).toBeVisible();
  await page.getByRole('button', { name: 'Clear the chosen week' }).click();
  await expect(week).toBeFocused();
  await expect(week).toHaveAttribute('aria-selected', 'false');
});

// The tabs per row, top to bottom, and whether any two lie over each other. Every tab must be
// seen: hidden ones would all stand in one row.
const tabRows = (page: Page) =>
  page.locator('.room-tabs').evaluate((tabs) => {
    const boxes = [...tabs.querySelectorAll('label span')].map((tab) =>
      tab.getBoundingClientRect(),
    );
    const tops = [...new Set(boxes.map((box) => Math.round(box.top)))];
    return {
      rows: tops.map((top) => boxes.filter((box) => Math.round(box.top) === top).length),
      seen: boxes.every((box) => box.width > 0 && box.height > 0),
      overlap: boxes.some((a, i) =>
        boxes.some(
          (b, j) =>
            i < j && a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom,
        ),
      ),
    };
  });
const fine = (rows: number[]) => ({ rows, seen: true, overlap: false });

test('four apartments with long names stand two by two on a phone and fit the card on a desktop', async ({
  page,
}) => {
  for (const path of ['/it', '/nl']) {
    await page.goto(`http://localhost:4002${path}`);
    // At 700 px three of these tabs would fit in a row.
    for (const width of [320, 375, 414, 600, 700]) {
      await page.setViewportSize({ width, height: 800 });
      const place = `${path} at ${width}`;
      expect(await tabRows(page), place).toEqual(fine([2, 2]));
      expect(await page.evaluate(() => document.documentElement.scrollWidth), place).toBe(width);
    }
    // Three of these names stand two and one, the third as wide as the others.
    await page.setViewportSize({ width: 375, height: 800 });
    await page
      .locator('.room-tabs label')
      .last()
      .evaluate((tab) => tab.remove());
    expect(await tabRows(page), path).toEqual(fine([2, 1]));
    const widths = await page
      .locator('.room-tabs span')
      .evaluateAll((tabs) => tabs.map((tab) => Math.round(tab.getBoundingClientRect().width)));
    expect(new Set(widths).size, path).toBe(1);
    // From 48rem every apartment has its column, all of it in the card, and the names wrap
    // with room between them.
    for (const width of [768, 895, 896, 1280]) {
      await page.setViewportSize({ width, height: 800 });
      const place = `${path} at ${width}`;
      expect(await page.evaluate(() => document.documentElement.scrollWidth), place).toBe(width);
      const sheet = page.locator('.sheet').first();
      expect(await sheet.evaluate((card) => card.scrollWidth - card.clientWidth), place).toBe(0);
      const names = await page.locator('.weeks-name').evaluateAll((spans) =>
        spans.map((span) => {
          const text = document.createRange();
          text.selectNodeContents(span);
          return text.getBoundingClientRect();
        }),
      );
      for (let i = 1; i < names.length; i++)
        expect(names[i].left - names[i - 1].right, place).toBeGreaterThanOrEqual(16);
    }
  }
});

test('three short names share one row on the narrowest phone, four stand in one where they fit', async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 800 });
  for (const path of ['/de', '/en']) {
    await page.goto(path);
    expect(await tabRows(page), path).toEqual(fine([3]));
  }
  // A fourth short name, as a fourth apartment would add it.
  await page.locator('.room-tabs').evaluate((tabs) => {
    const tab = tabs.querySelector('label')!.cloneNode(true) as HTMLElement;
    tab.querySelector('span')!.textContent = 'Fichte';
    tabs.append(tab);
  });
  expect(await tabRows(page)).toEqual(fine([2, 2]));
  await page.setViewportSize({ width: 500, height: 800 });
  expect(await tabRows(page)).toEqual(fine([4]));
});

test('on a phone the arrows stay in the shown apartment', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 800 });
  await page.goto('/en');
  await toOtherSeason(page);
  const at = () => page.evaluate(() => document.activeElement?.getAttribute('data-pick'));
  await panel(page).locator('[data-pick="0-0"]').focus();
  await page.keyboard.press('ArrowRight');
  await expect.poll(at).toBe('0-0');
  await page.keyboard.press('ArrowDown');
  await expect.poll(at).toBe('0-1');
  await page.locator('.room-tabs').getByText('Ahorn').click();
  await expect(page.locator('.weeks-grid [tabindex="0"]')).toHaveAttribute('data-pick', /^2-/);
});

test('the season button goes both ways, shares the season with the header and keeps the focus', async ({
  page,
}) => {
  await page.goto('/en');
  const start = await season(page);
  const card = () =>
    page.locator('.sheet').evaluate((element) => element.getBoundingClientRect().top + scrollY);
  const top = await card();
  // innerText leaves out the other season's hidden name.
  const heading = () => page.locator('.weeks h2').innerText();
  const first = await heading();
  await toOtherSeason(page);
  await expect(button(page)).toBeFocused();
  await expect(button(page)).toHaveAccessibleName(/^Current season: /);
  // The heading and the button keep their size, so the card does not move.
  expect(await card()).toBe(top);
  await expect.poll(heading).not.toBe(first);
  await expect(
    page.getByRole('radio', { name: start === 'winter' ? 'Summer' : 'Winter' }),
  ).toBeChecked();
  await button(page).click();
  await expect(page.locator('html')).toHaveAttribute('data-season', start!);
  await expect(button(page)).toBeFocused();
  await expect.poll(heading).toBe(first);

  // The header's switch changes the list too.
  await page
    .locator(`.season-switch label[data-for=${start === 'winter' ? 'summer' : 'winter'}]`)
    .click();
  await expect(button(page)).toHaveAccessibleName(/^Current season: /);
});

test('the next season slides in from the right, and back from the left', async ({ page }) => {
  await page.goto('/en');
  await toOtherSeason(page);
  // The first frames of each move, read from the running animations.
  const moves = () =>
    page.evaluate(() =>
      document
        .getAnimations()
        .map((one) => (one.effect as KeyframeEffect).getKeyframes()[0]['translate'])
        .filter(Boolean),
    );
  // The application runs by now, so a click is not lost.
  await button(page).click();
  await expect
    .poll(moves)
    .toEqual([expect.stringMatching(/^0/), expect.stringMatching(/^-[\d.]+px/)]);
  await settled(page);
  await button(page).click();
  await expect
    .poll(moves)
    .toEqual([expect.stringMatching(/^0/), expect.stringMatching(/^[1-9][\d.]*px/)]);
});

test('the card moves to the new rows’ own height, so nothing jumps at the end', async ({
  page,
}) => {
  await page.goto('/en');
  await toOtherSeason(page);
  const bodies = page.locator('.weeks-bodies');
  // Both ways, so that one of them shrinks; the application runs by now.
  const size = () => bodies.evaluate((box) => box.getBoundingClientRect().height);
  for (let i = 0; i < 2; i++) {
    const before = await size();
    await button(page).click();
    const end = await bodies.evaluate((box) => {
      const resize = box.getAnimations().at(-1);
      return resize ? (resize.effect as KeyframeEffect).getKeyframes().at(-1)?.['height'] : null;
    });
    await settled(page);
    const after = await size();
    if (Math.abs(after - before) > 1) expect(parseFloat(String(end))).toBeCloseTo(after, 0);
  }
});

test('with reduced motion the season changes at once', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/en');
  await toOtherSeason(page);
  // Transitions such as the header's ground on scroll are not part of the change.
  const moves = () =>
    page.evaluate(() => document.getAnimations().filter((one) => !(one instanceof CSSTransition)));
  expect(await moves()).toHaveLength(0);
  await expect(page.locator('[data-leaving]')).toHaveCount(0);
});

test('on a phone the tabs choose one apartment and clear the chosen week', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 700 });
  await page.goto('/en');
  await toOtherSeason(page);
  // The chosen apartment's name and facts take the header row.
  const header = page.locator('.weeks-columns > :not(:first-child):visible');
  await expect(header).toHaveCount(1);
  await expect(header).toContainText('Zirbe');
  await panel(page).locator('.stay:visible .price').first().click();
  await expect(page.locator('.pick')).toBeVisible();
  await page.locator('.room-tabs').getByText('Ahorn').click();
  await expect(header).toContainText('Ahorn');
  await expect(page.locator('.pick')).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(320);
});

// The grid focuses its active cell again when a tab hides it, which scrolled to the new
// apartment's week. Pressed by coordinates: a locator's click would scroll by itself. Lärche has
// free weeks in both seasons; Zirbe is booked out in winter.
test('a tab keeps the page in place and the focus on itself, also after a chosen week', async ({
  page,
}, { project }) => {
  await page.setViewportSize({ width: 375, height: 800 });
  await page.goto('/en');
  await toOtherSeason(page);
  const press = async (target: Locator) => {
    const box = (await target.boundingBox())!;
    const [x, y] = [box.x + box.width / 2, box.y + box.height / 2];
    await (project.use.hasTouch ? page.touchscreen.tap(x, y) : page.mouse.click(x, y));
  };
  const tabs = page.locator('.room-tabs');
  const header = page.locator('.weeks-columns > :not(:first-child):visible');
  // The list's last free week chosen and cleared, the tabs in view, then the switch.
  const switches = async (to: string, by: () => Promise<void>) => {
    const price = panel(page).locator('.stay:visible .price').last();
    await price.scrollIntoViewIfNeeded();
    await press(price);
    await expect(page.locator('.pick')).toBeVisible();
    await press(price);
    await expect(page.locator('.pick')).toHaveCount(0);
    await tabs.evaluate((element) =>
      scrollBy({ top: element.getBoundingClientRect().top - 200, behavior: 'instant' }),
    );
    const before = await page.evaluate(() => scrollY);
    await by();
    await expect(header).toContainText(to);
    await expect(tabs.getByRole('radio', { name: to })).toBeFocused();
    expect(await page.evaluate(() => scrollY)).toBe(before);
  };
  await press(tabs.getByText('Lärche'));
  await expect(header).toContainText('Lärche');
  await switches('Ahorn', () => press(tabs.getByText('Ahorn')));
  await switches('Lärche', async () => {
    await tabs.getByRole('radio', { name: 'Ahorn' }).focus();
    await page.keyboard.press('ArrowLeft');
  });
});

test('a season without prices is not open yet, and a season that has begun is full', async ({
  page,
}) => {
  await page.goto('http://localhost:4003/en');
  await expect(panel(page)).toHaveText(/No week of (Winter|Summer) [\d/]+ is free any more\./);
  await toOtherSeason(page);
  await expect(panel(page)).toHaveText(
    /The weeks of (Winter|Summer) [\d/]+ are not open yet\. They appear here as soon as their prices are set\./,
  );

  // The sentence's line sits where the first week's dates would.
  const line = (cell: Locator) =>
    cell.evaluate(
      (cell) =>
        cell.getBoundingClientRect().top +
        parseFloat(getComputedStyle(cell).paddingTop) -
        cell.closest('.sheet')!.getBoundingClientRect().top,
    );
  const sentence = await line(panel(page).locator('.weeks-empty'));
  await page.goto('/en');
  await toOtherSeason(page);
  expect(await line(panel(page).getByRole('rowheader').first())).toBeCloseTo(sentence, 0);
});

test('without Beds24 the list says it cannot be shown', async ({ page }) => {
  await page.goto('http://localhost:4001/en');
  await expect(page.getByText('The free weeks cannot be shown just now.')).toBeVisible();
});

test('a site with one season lists a year of weeks without a season button', async ({ page }) => {
  await page.goto('http://localhost:4002/it');
  await expect(page.getByRole('heading', { name: 'Settimane libere', exact: true })).toBeVisible();
  await expect(button(page)).toHaveCount(0);
  await expect(panel(page).locator('.stay[aria-selected]').first()).toBeAttached();
});

test('the list passes axe in both seasons', async ({ page }) => {
  await page.goto('/en');
  for (let i = 0; i < 2; i++) {
    await settled(page);
    const { violations } = await new AxeBuilder({ page }).include('.weeks').analyze();
    expect(violations).toEqual([]);
    if (i === 0) await toOtherSeason(page);
  }
});
