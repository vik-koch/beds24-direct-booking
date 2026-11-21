import type { Page } from '@playwright/test';

// Lays the loaded page out at a phone's width: Chromium here keeps a scrollbar's room from
// 320 px, which a phone has not.
export async function phoneWidth(page: Page, width: number, height: number) {
  await page.setViewportSize({ width, height });
  const gutter = await page.evaluate(() => innerWidth - document.documentElement.offsetWidth);
  await page.setViewportSize({ width: width + gutter, height });
}
