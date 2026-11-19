import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

const section = (page: Page, name: string) =>
  page.locator('section').filter({ has: page.getByRole('heading', { level: 2, name }) });

test('each apartment shows its facts, picture, description, rooms, amenities and terms', async ({
  page,
}) => {
  for (const [path, name, facts, rooms] of [
    [
      '/de/wohnungen/zirbe',
      'Zirbe',
      ['Bis 2 Gäste', '1 Schlafzimmer', '34 m²', 'Musterweg 1, Saalbach'],
      ['Schlafzimmer', 'Bad'],
    ],
    [
      '/de/wohnungen/laerche',
      'Lärche',
      ['Bis 4 Gäste', '2 Schlafzimmer', '61 m²'],
      ['Schlafzimmer 1', 'Schlafzimmer 2', 'Bad'],
    ],
    [
      '/en/apartments/ahorn',
      'Ahorn',
      ['Up to 6 guests', '3 bedrooms', '96 m²', 'Musterweg 7, Saalbach'],
      ['Bedroom 1', 'Bedroom 2', 'Bedroom 3', 'Bathroom 1', 'Bathroom 2'],
    ],
  ] as const) {
    const response = await page.goto(path);
    expect(response!.status()).toBe(200);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(name);
    for (const fact of facts) await expect(page.locator('.facts')).toContainText(fact);
    const picture = page.locator('.apartment-picture img');
    await expect(picture).toHaveAttribute('alt', /.{20}/);
    expect(await picture.evaluate((img: HTMLImageElement) => img.naturalWidth)).toBeGreaterThan(0);
    await expect(page.locator('.apartment-picture .ai-label')).toHaveText(
      path.startsWith('/de') ? 'KI-Bild' : 'AI image',
    );
    await expect(page.locator('.prose')).not.toBeEmpty();
    await expect(page.locator('.rooms h3')).toHaveText([...rooms]);
    await expect(page.locator('.amenities')).toBeVisible();
    await expect(page.locator('hlm-accordion-trigger')).toHaveCount(2);
  }
});

test('the description keeps its structure and none of the editor’s styling', async ({ page }) => {
  await page.goto('/de/wohnungen/ahorn');
  const prose = page.locator('.prose');
  await expect(prose.locator('h3')).toHaveText('Zwei Etagen');
  await expect(prose.locator('p')).toHaveText([
    'Unten – Wohnküche, Bad, Sauna',
    'Oben – Drei Schlafzimmer, Duschbad',
  ]);
  expect(await prose.locator('[style], [class], table, font, span').count()).toBe(0);
  await page.goto('/de/wohnungen/zirbe');
  await expect(prose.getByRole('link')).toHaveAttribute('href', /^http/);
  await expect(prose.getByRole('link')).not.toHaveAttribute('target');
});

test('a room and a bed are named in Beds24’s order, a sofa bed included', async ({ page }) => {
  await page.goto('/de/wohnungen/ahorn');
  await expect(page.locator('.rooms li')).toHaveText([
    /Schlafzimmer 1\s*Doppelbett/,
    /Schlafzimmer 2\s*Doppelbett/,
    /Schlafzimmer 3\s*Stockbett/,
    /Bad 1\s*Badewanne, WC/,
    /Bad 2\s*Dusche, WC/,
  ]);
});

test('the amenities show their first rows until the button opens all of them', async ({ page }) => {
  await page.goto('/de/wohnungen/ahorn');
  const amenities = section(page, 'Ausstattung');
  const fold = amenities.locator('.amenities-fold');
  const height = () => fold.evaluate((element) => element.clientHeight);
  const full = await amenities.locator('.amenities').evaluate((element) => element.offsetHeight);
  const cut = await height();
  expect(cut).toBeLessThan(full);
  // The property's codes and the room's: the boot dryer is the room's own.
  await expect(amenities.getByText('Skischuhtrockner')).toBeAttached();
  await expect(amenities.locator('.amenities > li:not(:has(ul))')).toHaveText([
    'Nichtraucherwohnung',
    'Keine Haustiere',
  ]);
  const more = amenities.getByRole('button', { name: 'Alle 16 Merkmale' });
  await expect(more).toHaveAttribute('aria-expanded', 'false');
  await more.focus();
  await page.keyboard.press('Enter');
  await expect(more).toHaveAttribute('aria-expanded', 'true');
  await expect(more).toBeFocused();
  await expect.poll(height).toBe(full);
  await page.keyboard.press('Space');
  await expect.poll(height).toBe(cut);
  // A list that fits needs no button.
  await page.goto('http://localhost:4002/it/appartamenti/castagno');
  await expect(page.locator('.amenities')).toBeVisible();
  await expect(page.locator('.amenities-fold + .text-button')).toBeHidden();
});

test('arrival, departure and the house rules open one at a time, by keyboard too', async ({
  page,
}) => {
  await page.goto('/de/wohnungen/laerche');
  const terms = section(page, 'Gut zu wissen');
  const times = terms.getByRole('button', { name: 'Anreise und Abreise' });
  const rules = terms.getByRole('button', { name: 'Hausordnung' });
  const [timesText, rulesText] = [0, 1].map((i) => terms.locator('hlm-accordion-content').nth(i));
  // Closed, a row's content takes no height and is out of reach.
  const closed = async (content: typeof timesText) => {
    await expect(content).toHaveAttribute('inert');
    await expect.poll(() => content.evaluate((element) => element.clientHeight)).toBe(0);
  };
  await closed(timesText);
  await times.focus();
  await page.keyboard.press('Enter');
  await expect(times).toHaveAttribute('aria-expanded', 'true');
  await expect(terms.getByRole('region', { name: 'Anreise und Abreise' })).toHaveText(
    'Anreise von 16:00 bis 20:00 Uhr. Abreise bis 10:00 Uhr.',
  );
  await rules.click();
  await expect(terms.getByRole('region', { name: 'Hausordnung' })).toHaveText(
    'Nichtraucherhaus. Haustiere sind nicht erlaubt.\nNachtruhe von 22 bis 7 Uhr.',
    { useInnerText: true },
  );
  await expect(times).toHaveAttribute('aria-expanded', 'false');
  await closed(timesText);
  await rules.click();
  await expect(rules).toHaveAttribute('aria-expanded', 'false');
  await closed(rulesText);
});

test('with reduced motion the folds and the rows open at once', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/de/wohnungen/ahorn');
  for (const selector of ['.amenities-fold', 'hlm-accordion-content'])
    expect(
      await page
        .locator(selector)
        .first()
        .evaluate((element) => getComputedStyle(element).transitionDuration),
      selector,
    ).toBe('0s');
});

test('on a phone a long description opens with its button, a short one has none', async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 700 });
  await page.goto('/en/apartments/zirbe');
  const prose = page.locator('.prose-fold');
  const more = page.getByRole('button', { name: 'Read more' });
  await expect(more).toBeVisible();
  const closed = await prose.evaluate((element) => element.clientHeight);
  await more.click();
  await expect(more).toHaveAttribute('aria-expanded', 'true');
  await expect
    .poll(() => prose.evaluate((element) => element.clientHeight))
    .toBeGreaterThan(closed);
  await more.click();
  await expect(more).toHaveAttribute('aria-expanded', 'false');
  await page.goto('/en/apartments/laerche');
  await expect(page.locator('.prose')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Read more' })).toBeHidden();
  // Wide enough, the whole description shows and no button.
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto('/en/apartments/zirbe');
  await expect(page.getByRole('button', { name: 'Read more' })).toBeHidden();
});

test('a language Beds24 has no texts in leaves the description and the house rules out', async ({
  page,
}) => {
  await page.goto('http://localhost:4002/it/appartamenti/castagno');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Sotto i Castagni Due');
  await expect(page.locator('.facts')).toContainText('Fino a 4 ospiti');
  await expect(page.locator('.prose')).toHaveCount(0);
  await expect(page.locator('.rooms h3')).toHaveText(['Camera 1', 'Camera 2', 'Bagno']);
  await expect(page.locator('.amenities')).toContainText('Wi-Fi');
  await expect(page.locator('hlm-accordion-trigger')).toHaveText(['Arrivo e partenza']);
  // A picture not marked as generated carries no label.
  await expect(page.locator('.ai-label')).toHaveCount(0);
});

test('without Beds24 the page answers 503 with the name, the picture and a sentence', async ({
  page,
}) => {
  const response = await page.goto('http://localhost:4001/en/apartments/zirbe');
  expect(response!.status()).toBe(503);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Zirbe');
  await expect(page.locator('.apartment-picture img')).toBeVisible();
  await expect(page.getByText('cannot be loaded just now')).toBeVisible();
  await expect(page.locator('.facts, .prose, .rooms, .amenities, .spartan-accordion')).toHaveCount(
    0,
  );
});

test('at 320 px nothing scrolls sideways, in both seasons and languages', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 700 });
  for (const path of ['/de/wohnungen/ahorn', '/en/apartments/laerche'])
    for (const season of ['winter', 'summer']) {
      await page.goto(`${path}?season=${season}`);
      expect(await page.evaluate(() => document.documentElement.scrollWidth), path).toBe(320);
    }
});

test('from 64rem the content keeps the left column and leaves the right one free', async ({
  page,
}) => {
  for (const [width, columns] of [
    [1280, 2],
    [1000, 1],
  ] as const) {
    await page.setViewportSize({ width, height: 800 });
    await page.goto('/de/wohnungen/ahorn');
    const tracks = await page
      .locator('.apartment-columns')
      .evaluate((grid) => getComputedStyle(grid).gridTemplateColumns.split(' ').length);
    expect(tracks, `at ${width}`).toBe(columns);
  }
});

test('every tab stop on an apartment page shows a focus ring', async ({ page, browserName }) => {
  test.skip(browserName === 'webkit', 'Safari tabs only to fields unless told otherwise');
  await page.goto('/de/wohnungen/ahorn');
  await page.locator('.back').focus();
  const seen: string[] = [];
  for (let i = 0; i < 20; i++) {
    const stop = await page.evaluate(() => {
      const element = document.activeElement as HTMLElement;
      const style = getComputedStyle(element);
      return {
        name: `${element.tagName.toLowerCase()} ${element.textContent?.trim().slice(0, 30)}`,
        ring: style.outlineStyle !== 'none' && parseFloat(style.outlineWidth) >= 2,
        inside: !!element.closest('main'),
      };
    });
    if (!stop.inside || seen.includes(stop.name)) break;
    seen.push(stop.name);
    expect(stop.ring, stop.name).toBe(true);
    await page.keyboard.press('Tab');
  }
  expect(seen).toEqual([
    'a Alle Wohnungen',
    'button Alle 16 Merkmale',
    'button Anreise und Abreise',
    'button Hausordnung',
  ]);
});

test('the page passes axe with everything open', async ({ page }) => {
  for (const path of ['/de/wohnungen/ahorn', '/en/apartments/zirbe']) {
    await page.goto(path);
    const { violations } = await new AxeBuilder({ page }).include('main').analyze();
    expect(violations).toEqual([]);
    await page.locator('.amenities-fold + .text-button').click();
    await page.locator('hlm-accordion-trigger button').last().click();
    const open = await new AxeBuilder({ page }).include('main').analyze();
    expect(open.violations).toEqual([]);
  }
});
