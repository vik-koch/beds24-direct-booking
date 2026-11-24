import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { toLanguage } from './header';

const other = 'http://localhost:4002';

test('a content page shows its file, and the language switch leads to the same page', async ({
  page,
}) => {
  await page.goto(`${other}/it/condizioni`);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Condizioni');
  await expect(page.getByRole('main').getByRole('heading', { level: 2 })).toHaveText(
    'Cancellazione',
  );
  await expect(page.getByRole('columnheader', { name: 'Disdetta' })).toBeVisible();
  await expect(page).toHaveTitle('Condizioni · Casa Prova Alta');
  await toLanguage(page, 'Lingua: Italiano', 'Nederlands');
  await expect(page).toHaveURL(`${other}/nl/voorwaarden`);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Voorwaarden');
  await expect(page.getByRole('columnheader', { name: 'Opzegging' })).toBeVisible();
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
});

test('a table wider than the column scrolls in its frame, reached by keyboard', async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 640 });
  await page.goto(`${other}/it/condizioni`);
  const frame = page.locator('.table-frame');
  await expect(frame).toHaveAttribute('tabindex', '0');
  const sizes = await frame.evaluate((box) => {
    const root = document.documentElement;
    return { box: [box.scrollWidth, box.clientWidth], page: [root.scrollWidth, root.clientWidth] };
  });
  expect(sizes.box[0]).toBeGreaterThan(sizes.box[1]);
  expect(sizes.page[0]).toBeLessThanOrEqual(sizes.page[1]);
  await frame.focus();
  await page.keyboard.press('ArrowRight');
  await expect.poll(() => frame.evaluate((box) => box.scrollLeft)).toBeGreaterThan(0);
  // Where it fits, it is no tab stop.
  await page.setViewportSize({ width: 1280, height: 800 });
  await expect(frame).not.toHaveAttribute('tabindex');
});

test(
  "a link to the site's own page carries the chosen guests",
  { tag: '@any-engine' },
  async ({ page }) => {
    await page.goto(`${other}/it/domande?adults=3`);
    const link = page.getByRole('link', { name: 'gli appartamenti' });
    await expect(link).toHaveAttribute('href', '/it?adults=3#appartamenti');
    await link.click();
    await expect(page).toHaveURL(`${other}/it?adults=3#appartamenti`);
  },
);

test('a question the address names is open, below the header, also when the address changes', async ({
  page,
}) => {
  await page.goto(`${other}/it/domande#chiavi`);
  const keys = page.locator('details#chiavi');
  const arrival = page.locator('details#arrivo');
  await expect(keys).toHaveAttribute('open');
  await expect(keys.getByText('In una cassetta')).toBeVisible();
  await expect(arrival).not.toHaveAttribute('open');
  await expect(page.locator('html')).toHaveAttribute('data-started', '');
  const header = await page.locator('app-header').evaluate((h) => h.getBoundingClientRect().bottom);
  expect(await keys.evaluate((d) => d.getBoundingClientRect().top)).toBeGreaterThanOrEqual(header);
  await page.evaluate(() => (location.hash = 'arrivo'));
  await expect(arrival).toHaveAttribute('open');
  // A link to the question the address already names opens it, though the address stays.
  const link = arrival.getByRole('link', { name: 'dove trovarle' });
  await link.click();
  await expect(page).toHaveURL(/#chiavi$/);
  await keys.locator('summary').click();
  await expect(keys).not.toHaveAttribute('open');
  await link.click();
  await expect(keys).toHaveAttribute('open');
  // A question opens and closes by keyboard.
  await arrival.locator('summary').focus();
  await page.keyboard.press('Enter');
  await expect(arrival).not.toHaveAttribute('open');
});

test("the company page's picture is converted, fits a phone, and is credited", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 640 });
  await page.goto('/en/about');
  const picture = page.getByRole('img', { name: /^Saalbach in summer/ });
  await picture.scrollIntoViewIfNeeded();
  await expect
    .poll(() => picture.evaluate((img: HTMLImageElement) => img.naturalWidth))
    .toBeGreaterThan(0);
  expect(await picture.evaluate((img: HTMLImageElement) => img.currentSrc)).toMatch(
    /\/pictures\/pages\/saalbach-summer-\d+\.[0-9a-f]{8}\.webp$/,
  );
  const sizes = await page.evaluate(() => [
    document.documentElement.scrollWidth,
    document.documentElement.clientWidth,
  ]);
  expect(sizes[0]).toBeLessThanOrEqual(sizes[1]);
  await page.goto('/en/picture-credits');
  await expect(page.getByRole('link', { name: 'Saalbach from above.jpg' })).toHaveAttribute(
    'href',
    'https://commons.wikimedia.org/wiki/File:Saalbach_from_above.jpg',
  );
});

test("the FAQ's list leads to its groups and a question's address opens it, below the header", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 640 });
  const below = (target: ReturnType<typeof page.locator>) =>
    expect
      .poll(async () => {
        const header = await page
          .locator('app-header')
          .evaluate((h) => h.getBoundingClientRect().bottom);
        const top = await target.evaluate((t) => t.getBoundingClientRect().top);
        return top >= header && top < header + 48;
      })
      .toBe(true);
  await page.goto('/en/faq?adults=3');
  await expect(page.locator('html')).toHaveAttribute('data-started', '');
  const link = page.getByRole('link', { name: 'Getting here' });
  await expect(link).toHaveAttribute('href', '/en/faq?adults=3#getting-here');
  await link.click();
  await expect(page).toHaveURL(/\/en\/faq\?adults=3#getting-here$/);
  await below(page.getByRole('heading', { level: 2, name: 'Getting here' }));
  // By keyboard too.
  await page.getByRole('link', { name: 'Arrival' }).focus();
  await page.keyboard.press('Enter');
  await below(page.getByRole('heading', { level: 2, name: 'Arrival' }));
  await page.goto('/de/haeufige-fragen#parking');
  const parking = page.locator('details#parking');
  await expect(parking).toHaveAttribute('open');
  await below(parking);
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
});
