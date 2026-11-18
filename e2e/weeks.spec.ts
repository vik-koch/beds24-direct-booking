import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

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
  expect(dates.replace(/\s+/g, ' ').trim()).toMatch(/^Sat \d\d\/\d\d – Sat \d\d\/\d\d$/);
  // The headers say the week and the apartment, so a cell says only its own price or "booked".
  await expect(panel(page).getByRole('rowheader').first()).toHaveAccessibleName(
    /^Saturday \d+ \w+ – Saturday \d+ \w+$/,
  );
  await expect(panel(page).locator('.stay').first()).toHaveAccessibleName(/^€[\d,.]+$/);
  await expect(panel(page).locator('.booked').first()).toHaveAccessibleName('booked');
  await expect(panel(page).getByText('booked').first()).toBeVisible();
  await expect(page.locator('.weeks-note')).toHaveText(
    'Price per week including the final cleaning. Plus a local tax of €3.50 per adult and night.',
  );
});

test('a chosen week leads to its apartment with the stay', async ({ page }) => {
  await page.goto('/de');
  await toOtherSeason(page);
  const first = panel(page).locator('.stay:visible').first();
  const column = await first.getAttribute('aria-colindex');
  const apartment = await page
    .locator(`[role=columnheader][aria-colindex="${column}"] .weeks-name`)
    .innerText();
  const dates = await first.locator('..').getByRole('rowheader').innerText();
  const price = await first.innerText();
  await first.click();
  await expect(first).toHaveAttribute('aria-selected', 'true');
  await expect(page.locator('.pick output')).toHaveText(
    `${apartment} · ${dates.replace(/\s+/g, ' ').trim()} · ${price}`,
  );
  await page.getByRole('link', { name: 'Weiter zur Buchung' }).click();
  await expect(page).toHaveURL(
    /\/de\/wohnungen\/(zirbe|laerche|ahorn)\?arrival=\d{4}-\d\d-\d\d&departure=\d{4}-\d\d-\d\d$/,
  );
  const url = new URL(page.url());
  const days =
    (Date.parse(url.searchParams.get('departure')!) -
      Date.parse(url.searchParams.get('arrival')!)) /
    864e5;
  expect(days).toBe(7);
});

test('a chosen week is cleared by a second click, Enter, Space or the bar, and waits for its season', async ({
  page,
}) => {
  await page.goto('/en');
  await toOtherSeason(page);
  const stay = panel(page).locator('.stay:visible').first();
  const selected = () => expect(stay).toHaveAttribute('aria-selected', 'true');
  const unselected = () => expect(stay).toHaveAttribute('aria-selected', 'false');
  await stay.click();
  await expect(page.locator('.pick')).toBeVisible();
  await stay.click();
  await unselected();
  await expect(page.locator('.pick')).toHaveCount(0);
  await stay.focus();
  for (const key of ['Enter', ' ']) {
    await page.keyboard.press(key);
    await selected();
    await page.keyboard.press(key);
    await unselected();
  }

  await stay.click();
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
  await panel(page).locator('.stay:visible').first().click();
  await expect(page.locator('.pick')).toBeVisible();
  await page.locator('.room-tabs').getByText('Ahorn').click();
  await expect(header).toContainText('Ahorn');
  await expect(page.locator('.pick')).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(320);
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
