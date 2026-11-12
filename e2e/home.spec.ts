import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

test('the home page comes rendered from the server and passes axe', async ({ page, request }) => {
  expect(await (await request.get('/')).text()).toContain('<h1');

  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
});
