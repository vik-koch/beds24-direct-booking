import { expect, test, type Locator } from '@playwright/test';

// How far an icon's centre lies below the middle of the capitals on the first line of the text
// beside it, and how many lines that text has.
const offset = (icon: Locator) =>
  icon.evaluate((icon) => {
    const walker = document.createTreeWalker(icon.parentElement!, NodeFilter.SHOW_TEXT);
    let text: Node | null;
    while ((text = walker.nextNode()))
      if (text.textContent!.trim() && !text.parentElement!.closest('ng-icon, svg')) break;
    const range = document.createRange();
    range.selectNodeContents(text!);
    const lines = range.getClientRects();
    // The font's ascent and cap height, measured on a line of the same font.
    const { fontWeight, fontSize, fontFamily } = getComputedStyle(text!.parentElement!);
    const probe = document.createElement('div');
    probe.style.cssText = `position: absolute; font: ${fontWeight} ${fontSize} ${fontFamily}`;
    probe.innerHTML = 'H<i style="display: inline-block"></i><i style="display: inline-block"></i>';
    (probe.children[1] as HTMLElement).style.height = '1cap';
    document.body.append(probe);
    const letter = document.createRange();
    letter.selectNodeContents(probe.firstChild!);
    const ascent =
      probe.children[0].getBoundingClientRect().bottom - letter.getBoundingClientRect().top;
    const cap = probe.children[1].getBoundingClientRect().height;
    probe.remove();
    const box = icon.getBoundingClientRect();
    return {
      offset: (box.top + box.bottom) / 2 - (lines[0].top + ascent - cap / 2),
      lines: lines.length,
    };
  });

// Each of the icons, which are there, once the layout has settled.
const centred = async (icons: Locator, count: number) => {
  await expect(icons).toHaveCount(count);
  for (const icon of await icons.all())
    await expect
      .poll(async () => Math.abs((await offset(icon)).offset), { message: `${icon}` })
      .toBeLessThanOrEqual(0.5);
};

for (const width of [320, 1280])
  test(`an icon beside text is at the capitals' middle of its first line at ${width} px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 800 });
    await page.goto('/en');
    await centred(page.locator('.features ng-icon'), 3);
    await page.goto('/en/apartments/zirbe');
    await centred(page.locator('.apartment-main .facts ng-icon'), 4);
    await centred(page.locator('.entries h3 > ng-icon'), 8);
    // A row of "Good to know" and its chevron, also when its text wraps.
    const row = page.locator('.spartan-accordion-trigger').first();
    const lines = async () => (await offset(row.locator('ng-icon').first())).lines;
    if (width === 1280) await expect.poll(lines).toBe(1);
    await centred(row.locator('ng-icon:visible'), 2);
    await row.evaluate(
      (button) => (button.closest<HTMLElement>('.spartan-accordion')!.style.width = '15rem'),
    );
    await expect.poll(lines).toBe(2);
    await centred(row.locator('ng-icon:visible'), 2);
    await page.goto('/en/faq');
    await centred(page.locator('.prose :is(h2, .note) > .icon'), 6);
  });
