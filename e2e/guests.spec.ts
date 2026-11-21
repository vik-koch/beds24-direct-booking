import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

// The demo's apartments by their totals, any of them adults: Zirbe 2 and asks for no children,
// Lärche 4 and Ahorn 6. The server dates the seasons by today;
// the simulator prices every season ahead of today, so the next season always has free weeks.
const weeks = (page: Page) => page.locator('.weeks-body:visible');
const column = (page: Page, index: number, kind = '[role=gridcell]') =>
  weeks(page).locator(`${kind}[aria-colindex="${index + 2}"]`);
const settled = (page: Page) =>
  expect.poll(() => page.evaluate(() => document.getAnimations().length)).toBe(0);

// Controls used before the application has started are outside what the site supports, and
// data-smooth cannot tell: the head's script sets it before Angular runs.
async function open(page: Page, path: string) {
  await page.goto(path);
  await expect(page.locator('html')).toHaveAttribute('data-started', '');
}

async function toOtherSeason(page: Page) {
  const before = await page.locator('html').getAttribute('data-season');
  await expect(page.locator('html')).toHaveAttribute('data-started', '');
  await page.locator('.other-season').first().click();
  await expect(page.locator('html')).not.toHaveAttribute('data-season', before!);
  await settled(page);
}

// By keyboard: Enter opens the list at the current count, the arrows move, Enter takes it.
async function pickCount(page: Page, id: 'adults' | 'children', value: number) {
  const select = page.locator(`#${id}`);
  const from = Number(await select.innerText());
  await select.focus();
  await page.keyboard.press('Enter');
  // The list shows at once and marks its current option a render later.
  await expect(select).toHaveAttribute('aria-activedescendant', /./);
  for (let i = 0; i < Math.abs(value - from); i++)
    await page.keyboard.press(value > from ? 'ArrowDown' : 'ArrowUp');
  await page.keyboard.press('Enter');
  await expect(select).toHaveText(String(value));
}

for (const width of [1280, 320]) {
  test(`without a choice nothing is marked and the address stays bare, at ${width} px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    await open(page, '/de');
    await expect(page.locator('#adults')).toHaveText('2');
    await expect(page.locator('#children')).toHaveText('0');
    await expect(page.getByText('zu klein', { exact: true })).toHaveCount(0);
    await expect(page.locator('.teaser-price', { hasText: 'Zu klein' })).toHaveCount(0);
    await expect(page.locator('.teaser h3 a').first()).toHaveAttribute(
      'href',
      '/de/wohnungen/zirbe',
    );
    // A choice back at two adults leaves the address as it was.
    await pickCount(page, 'adults', 3);
    await expect(page).toHaveURL(/\/de\?adults=3$/);
    await pickCount(page, 'adults', 2);
    await expect(page).toHaveURL(/\/de$/);
  });

  test(`a group too big for some apartments marks their columns and cards, at ${width} px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    await open(page, '/en?adults=3&children=2');
    for (const season of ['shown', 'other']) {
      if (season === 'other') await toOtherSeason(page);
      // In its last week the shown season may have no week left to offer.
      if (await weeks(page).locator('.weeks-empty').count()) continue;
      // On a phone each apartment's tab shows its own column.
      for (const [index, small] of [true, true, false].entries()) {
        if (width < 768) await page.locator('.room-tabs label').nth(index).click();
        const cells = column(page, index);
        if (small) {
          await expect(cells.first()).toHaveText('too small');
          await expect(cells.locator('.price')).toHaveCount(0);
        } else await expect(cells.getByText('too small')).toHaveCount(0);
      }
    }
    const cards = page.locator('.teaser-price');
    await expect(cards.nth(0)).toHaveText('Too small for 5 guests');
    await expect(cards.nth(1)).toHaveText('Too small for 5 guests');
    await expect(cards.nth(2).locator(':scope > :visible')).toHaveText(
      /^ ?from €[\d,.]+ a week ?$/,
    );
    // Such a cell is reached by keyboard and announced like a booked one, and neither Enter,
    // Space nor a click chooses it or clears a chosen week. The next season, shown now, always
    // has weeks. A phone shows one apartment at a time, and a change of tab clears the week.
    const wide = width >= 768;
    const chosen = column(page, 2, '.stay').first();
    if (wide) {
      await chosen.locator('.price').click();
      await expect(page.locator('.pick output')).toContainText('Ahorn');
      await page.locator('#children').focus();
      await page.keyboard.press('Tab');
      await expect(chosen).toBeFocused();
      await page.keyboard.press('Home');
    } else {
      await page.locator('.room-tabs label').first().click();
      await page.locator('.room-tabs input').first().focus();
      await page.keyboard.press('Tab');
    }
    const cell = page.locator(':focus');
    await expect(cell).toHaveAttribute('aria-colindex', '2');
    await expect(cell).toHaveAccessibleName('too small');
    for (const key of ['Enter', ' ']) await page.keyboard.press(key);
    await cell.click();
    await expect(cell).not.toHaveAttribute('aria-selected', 'true');
    if (wide) {
      await expect(chosen).toHaveAttribute('aria-selected', 'true');
      await expect(page.locator('.pick output')).toContainText('Ahorn');
    } else await expect(page.locator('.pick')).toHaveCount(0);
    const axe = await new AxeBuilder({ page }).include('.weeks').analyze();
    expect(axe.violations).toEqual([]);
  });
}

test('a week chosen in an apartment that becomes too small is no longer chosen', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await open(page, '/de');
  await toOtherSeason(page);
  const stay = column(page, 1).locator('.price').first();
  await stay.click();
  await expect(page.locator('.pick output')).toContainText('Lärche');
  await pickCount(page, 'children', 3);
  await expect(page.locator('.pick')).toHaveCount(0);
  await expect(column(page, 1, '[role=gridcell][aria-selected=true]')).toHaveCount(0);
});

test('the chosen week’s bar counts the tourist tax of the chosen adults', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await open(page, '/de?adults=4&children=2');
  await toOtherSeason(page);
  const stay = column(page, 2, '.stay').first();
  const price = Number((await stay.innerText()).replace(/[^\d,]/g, '').replace(',', '.'));
  await stay.locator('.price').click();
  // Four adults, seven nights at € 3.50; the children pay none.
  const total = new Intl.NumberFormat('de-AT', { style: 'currency', currency: 'EUR' })
    .format(price + 98)
    .replace(',00', '');
  await expect(page.locator('.pick .bar-parts > span')).toHaveText([
    'Ahorn',
    total,
    /Sa\./,
    'mit Ortstaxe',
  ]);
  await expect(page.locator('.pick a')).toHaveAttribute('href', /&adults=4&children=2$/);
});

test('the choice follows the visitor to another page, a reload and the other language', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await open(page, '/de?adults=3');
  await page.locator('.teaser h3 a', { hasText: 'Lärche' }).click();
  await expect(page).toHaveURL(/\/de\/wohnungen\/laerche\?adults=3$/);
  await expect(page.locator('#adults')).toHaveText('3');
  await expect(page.locator('.back')).toHaveAttribute('href', '/de?adults=3#wohnungen');
  await page.reload();
  await expect(page.locator('#adults')).toHaveText('3');
  // Through the header's language menu, or the sheet where the header is folded; the sheet's
  // button by its coordinates, as a locator's click scrolls the sticky header.
  const sheet = page.locator('.header-narrow .icon-button');
  if (await sheet.isVisible()) {
    const box = (await sheet.boundingBox())!;
    await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  } else {
    const menu = page.getByRole('button', { name: 'Sprache: Deutsch' });
    await menu.focus();
    await page.keyboard.press('Enter');
    await expect(menu).toHaveAttribute('aria-expanded', 'true');
  }
  await page.getByRole('link', { name: 'English' }).click();
  await expect(page).toHaveURL(/\/en\/apartments\/laerche\?adults=3$/);
  await expect(page.locator('#adults')).toHaveText('3');
  await expect(page.locator('app-header a').first()).toHaveAttribute('href', '/en?adults=3');
  await expect(page.locator('app-footer a[href*="/en/"]').first()).toHaveAttribute(
    'href',
    /\?adults=3$/,
  );
});

test('an address beyond what any apartment takes is held to it, in the page and the address', async ({
  page,
}) => {
  for (const [query, adults, children, kept] of [
    ['adults=100', '6', '0', '?adults=6'],
    ['adults=0', '1', '0', '?adults=1'],
    ['adults=-1&children=9', '1', '5', '?adults=1&children=5'],
    ['adults=abc', '1', '0', '?adults=1'],
    ['adults=2&children=0', '2', '0', ''],
  ]) {
    await open(page, `/de?${query}#freie-wochen`);
    await expect(page.locator('#adults')).toHaveText(adults);
    await expect(page.locator('#children')).toHaveText(children);
    await expect.poll(() => new URL(page.url()).search).toBe(kept);
    expect(new URL(page.url()).hash).toBe('#freie-wochen');
  }
});
