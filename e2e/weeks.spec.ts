import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

// The server dates the seasons by today, so these tests take the seasons from the page. The
// simulator prices every season ahead of today, so the next season always has free weeks.
const panel = (page: Page) => page.locator('.weeks-panel:visible');
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
  await page.goto('/en');
  await expect(button(page)).toHaveAccessibleName(
    /^Next season: (Winter \d{4}\/\d\d|Summer \d{4})$/,
  );
  await toOtherSeason(page);
  const table = panel(page).locator('table');
  for (const name of ['Zirbe', 'Lärche', 'Ahorn'])
    await expect(table.getByRole('columnheader', { name })).toContainText(/\d guests · \d+\sm²/);
  await expect(table.getByRole('rowheader').first()).toHaveText(
    /^Sat \d\d\/\d\d – Sat \d\d\/\d\d$/,
  );
  await expect(table.getByRole('radio').first()).toHaveAccessibleName(
    /^(Zirbe|Lärche|Ahorn) · Sat .+ · €[\d,.]+$/,
  );
  await expect(table.getByText('booked').first()).toBeVisible();
  await expect(panel(page).locator('.weeks-note')).toHaveText(
    'Price per week including the final cleaning. Plus a local tax of €3.50 per adult and night.',
  );
});

test('a chosen week leads to its apartment with the stay', async ({ page }) => {
  await page.goto('/de');
  await toOtherSeason(page);
  const first = panel(page).getByRole('radio').first();
  const name = await first.getAttribute('aria-label');
  await panel(page).locator('.stay').first().click();
  await expect(first).toBeChecked();
  await expect(panel(page).locator('.pick output')).toHaveText(name!);
  await panel(page).getByRole('link', { name: 'Weiter zur Buchung' }).click();
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

test('the season button goes both ways, shares the season with the header and keeps the focus', async ({
  page,
}) => {
  await page.goto('/en');
  const start = await season(page);
  // innerText leaves out the other season's hidden name.
  const heading = () => page.locator('.weeks h2').innerText();
  const first = await heading();
  await toOtherSeason(page);
  await expect(button(page)).toBeFocused();
  await expect(button(page)).toHaveAccessibleName(/^Current season: /);
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
  expect(await moves()).toEqual([expect.stringMatching(/^0/), expect.stringMatching(/^-100%/)]);
  await settled(page);
  await button(page).click();
  expect(await moves()).toEqual([expect.stringMatching(/^0/), expect.stringMatching(/^100%/)]);
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
  const headers = panel(page).locator('thead th:visible');
  await expect(headers).toHaveCount(2);
  await expect(headers.nth(1)).toContainText('Zirbe');
  await panel(page).locator('.stay:visible').first().click();
  await expect(panel(page).locator('.pick')).toBeVisible();
  await page.locator('.room-tabs').getByText('Ahorn').click();
  await expect(headers.nth(1)).toContainText('Ahorn');
  await expect(panel(page).locator('.pick')).toHaveCount(0);
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
  await expect(page.locator('.room-tabs')).toBeHidden();
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
