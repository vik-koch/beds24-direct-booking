import { expect, type Page } from '@playwright/test';

// Opens a menu of the wide header by keyboard, once the application has started, with the
// pointer resting where its pane is attached before it is placed (#212).
export async function open(page: Page, name: string) {
  const menu = page.getByRole('button', { name });
  await expect(page.locator('html')).toHaveAttribute('data-started', '');
  await page.mouse.move(0, 0);
  await menu.focus();
  await page.keyboard.press('Enter');
  await expect(menu).toHaveAttribute('aria-expanded', 'true');
  return menu;
}

// Through the header's language menu, or the sheet where the header is folded. The menu
// button is pressed by its coordinates: a locator's click scrolls the sticky header's button
// "into view" and moves the page.
export async function toLanguage(page: Page, current: string, other: string) {
  const menu = page.locator('.header-narrow .icon-button');
  if (await menu.isVisible()) {
    const box = (await menu.boundingBox())!;
    await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  } else await open(page, current);
  const from = page.url();
  await page.getByRole('link', { name: other }).click();
  // With a map in view the change takes seconds in headless WebKit, whose WebGL is drawn in
  // software, and longer under CI's load (#165).
  await page.waitForURL((url) => url.href !== from, { timeout: 15000 });
}
