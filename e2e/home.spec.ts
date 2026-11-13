import { readdirSync, readFileSync } from 'node:fs';
import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

test('the home page comes from the server with the apartments and passes axe', async ({
  page,
  request,
}) => {
  const html = await (await request.get('/')).text();
  for (const name of ['Zirbe', 'Lärche', 'Ahorn']) expect(html).toContain(`<li>${name}</li>`);

  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await expect(page.getByRole('listitem')).toHaveText(['Zirbe', 'Lärche', 'Ahorn']);
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
});

test('a refused token answers 503 without apartments', async ({ request }) => {
  const response = await request.get('http://localhost:4001/');
  expect(response.status()).toBe(503);
  expect(await response.text()).not.toContain('<li>');
});

test('the browser bundle does not know the token', () => {
  const browser = 'dist/beds24-direct-booking/browser';
  const scripts = readdirSync(browser).filter((file) => file.endsWith('.js'));
  expect(scripts.length).toBeGreaterThan(0);
  for (const file of scripts)
    expect(readFileSync(`${browser}/${file}`, 'utf8')).not.toContain('BEDS24_TOKEN');
});
