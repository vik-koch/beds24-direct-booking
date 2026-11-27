import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

// The demo's guests pay on the simulator's page, so it is held to the site's accessibility.
for (const locale of ['de', 'en'])
  test(`the simulated checkout page is accessible and works by keyboard (${locale})`, async ({
    page,
    request,
  }) => {
    const created = await request.post('http://localhost:4300/v1/checkout/sessions', {
      headers: { Authorization: 'Bearer simulator' },
      form: {
        mode: 'payment',
        locale,
        'line_items[0][price_data][currency]': 'eur',
        'line_items[0][price_data][unit_amount]': 98_315,
        success_url: 'http://localhost:4300/paid',
        cancel_url: 'http://localhost:4300/back',
      },
    });
    const { url } = await created.json();
    await page.goto(url);
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
    await page.getByRole('button').last().focus();
    await page.keyboard.press('Enter');
    await expect(page.getByRole('button')).toHaveCount(0);
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  });
