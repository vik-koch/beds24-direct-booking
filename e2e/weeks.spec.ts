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
  const table = page.getByRole('table');
  for (const name of ['Zirbe', 'Lärche', 'Ahorn'])
    await expect(table.getByRole('columnheader', { name })).toContainText(/\d guests · \d+\sm²/);
  const dates = await panel(page).getByRole('rowheader').first().innerText();
  expect(dates.replace(/\s+/g, ' ').trim()).toMatch(/^Sat \d\d\/\d\d – Sat \d\d\/\d\d$/);
  await expect(panel(page).getByRole('radio').first()).toHaveAccessibleName(
    /^(Zirbe|Lärche|Ahorn) · Sat .+ · €[\d,.]+$/,
  );
  await expect(panel(page).getByText('booked').first()).toBeVisible();
  await expect(page.locator('.weeks-note')).toHaveText(
    'Price per week including the final cleaning. Plus a local tax of €3.50 per adult and night.',
  );
});

test('a chosen week leads to its apartment with the stay', async ({ page }) => {
  await page.goto('/de');
  await toOtherSeason(page);
  const first = panel(page).locator('.stay:visible').first().getByRole('radio');
  const name = await first.getAttribute('aria-label');
  await panel(page).locator('.stay:visible').first().click();
  await expect(first).toBeChecked();
  await expect(page.locator('.pick output')).toHaveText(name!);
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

test('a chosen week is cleared by a second click, Enter or the bar, and waits for its season', async ({
  page,
}) => {
  await page.goto('/en');
  await toOtherSeason(page);
  const stay = panel(page).locator('.stay:visible').first();
  const radio = stay.getByRole('radio');
  await stay.click();
  await expect(page.locator('.pick')).toBeVisible();
  await stay.click();
  await expect(radio).not.toBeChecked();
  await expect(page.locator('.pick')).toHaveCount(0);
  await radio.focus();
  await page.keyboard.press('Enter');
  await expect(radio).toBeChecked();
  await page.keyboard.press('Enter');
  await expect(radio).not.toBeChecked();

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
  await expect(radio).not.toBeChecked();
  await expect(radio).toBeFocused();
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
  await expect(panel(page).getByRole('radio').first()).toBeAttached();
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
