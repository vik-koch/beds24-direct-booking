import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

const section = (page: Page, name: string) =>
  page.locator('section').filter({ has: page.getByRole('heading', { level: 2, name }) });

test('each apartment shows its facts, pictures, description, rooms, amenities and terms', async ({
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
    const picture = page.locator('.tile img').first();
    await expect(picture).toHaveAttribute('alt', /.{20}/);
    expect(await picture.evaluate((img: HTMLImageElement) => img.naturalWidth)).toBeGreaterThan(0);
    await expect(page.locator('.tile .ai-label').first()).toHaveText(
      path.startsWith('/de') ? 'KI-Bild' : 'AI image',
    );
    await expect(page.locator('.prose')).not.toBeEmpty();
    await expect(page.locator('.rooms h3')).toHaveText([...rooms]);
    await expect(page.locator('.amenities')).toBeVisible();
    await expect(page.locator('hlm-accordion-trigger')).toHaveCount(2);
  }
});

test(
  'the description keeps its structure and none of the editor’s styling',
  { tag: '@any-engine' },
  async ({ page }) => {
    await page.goto('/de/wohnungen/ahorn');
    const prose = page.locator('.prose');
    await expect(prose.locator('h2')).toHaveText('Zwei Etagen');
    await expect(prose.locator('p')).toHaveText([
      'Unten – Wohnküche, Bad, Sauna',
      'Oben – Drei Schlafzimmer, Duschbad',
    ]);
    expect(await prose.locator('[style], [class], table, font, span').count()).toBe(0);
    await page.goto('/de/wohnungen/zirbe');
    await expect(prose.getByRole('link')).toHaveAttribute('href', /^http/);
    await expect(prose.getByRole('link')).not.toHaveAttribute('target');
  },
);

test(
  'a room and a bed are named in Beds24’s order, a sofa bed included',
  { tag: '@any-engine' },
  async ({ page }) => {
    await page.goto('/de/wohnungen/ahorn');
    await expect(page.locator('.rooms li')).toHaveText([
      /Schlafzimmer 1\s*Doppelbett/,
      /Schlafzimmer 2\s*Doppelbett/,
      /Schlafzimmer 3\s*Stockbett/,
      /Bad 1\s*Badewanne, WC/,
      /Bad 2\s*Dusche, WC/,
    ]);
  },
);

test('on a phone the amenities show their first rows until the button opens them all', async ({
  page,
}) => {
  await page.setViewportSize({ width: 375, height: 800 });
  await page.goto('/de/wohnungen/ahorn');
  const amenities = section(page, 'Ausstattung');
  const fold = amenities.locator('.amenities-fold');
  const height = () => fold.evaluate((element) => parseFloat(getComputedStyle(element).height));
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
  // A list that fits needs no button, and on a desktop no list is cut.
  await page.goto('http://localhost:4002/it/appartamenti/castagno');
  await expect(page.locator('.amenities')).toBeVisible();
  await expect(page.locator('.amenities-fold + .text-button')).toBeHidden();
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto('/de/wohnungen/ahorn');
  await expect(amenities.locator('.amenities')).toBeVisible();
  expect(await fold.evaluate((element) => element.scrollHeight - element.clientHeight)).toBe(0);
  await expect(more).toBeHidden();
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

test('with reduced motion the folds, the rows and their arrows move at once', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/de/wohnungen/ahorn');
  for (const selector of [
    '.amenities-fold',
    '.amenities-fold + .text-button ng-icon',
    'hlm-accordion-content',
    '.spartan-accordion-trigger-icon',
  ])
    expect(
      await page
        .locator(selector)
        .first()
        .evaluate((element) => getComputedStyle(element).transitionDuration),
      selector,
    ).toBe('0s');
});

test('an open row keeps one arrow, turned', async ({ page }) => {
  await page.goto('/de/wohnungen/laerche');
  const trigger = page.getByRole('button', { name: 'Hausordnung' });
  const arrows = trigger.locator('.spartan-accordion-trigger-icon:visible');
  await expect(arrows).toHaveCount(1);
  await trigger.click();
  await expect(trigger).toHaveAttribute('aria-expanded', 'true');
  await expect(arrows).toHaveCount(1);
  await expect(arrows).toHaveCSS('rotate', '180deg');
});

test('without JavaScript every text can be read in full', async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  await page.setViewportSize({ width: 320, height: 700 });
  await page.goto('/de/wohnungen/ahorn');
  for (const fold of ['.prose-fold', '.amenities-fold'])
    expect(
      await page.locator(fold).evaluate((element) => element.scrollHeight - element.clientHeight),
      fold,
    ).toBe(0);
  for (const content of await page.locator('hlm-accordion-content').all())
    expect(await content.evaluate((element) => element.clientHeight)).toBeGreaterThan(0);
  await expect(page.getByText('Nachtruhe von 22 bis 7 Uhr.')).toBeVisible();
  await context.close();
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
  // A link below the cut opens the description when it takes the focus. From the top at once:
  // a smooth scroll still running would carry the page away from the link.
  await page.evaluate(() => scrollTo({ top: 0, behavior: 'instant' }));
  await page.locator('.back').focus();
  const link = page.locator('.prose').getByRole('link');
  for (let i = 0; i < 10 && !(await link.evaluate((a) => a === document.activeElement)); i++)
    await page.keyboard.press('Tab');
  await expect(link).toBeFocused();
  await expect(more).toHaveAttribute('aria-expanded', 'true');
  await expect(link).toBeInViewport();
  await page.goto('/en/apartments/laerche');
  await expect(page.locator('.prose')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Read more' })).toBeHidden();
  // Wide enough, the whole description shows and no button, also after it was opened on a
  // phone; narrowed again, the button is back and still open.
  await page.goto('/en/apartments/zirbe');
  await more.click();
  await expect(more).toHaveAttribute('aria-expanded', 'true');
  await page.setViewportSize({ width: 1280, height: 800 });
  await expect(more).toBeHidden();
  await expect
    .poll(() => prose.evaluate((element) => element.scrollHeight - element.clientHeight))
    .toBe(0);
  await page.setViewportSize({ width: 320, height: 700 });
  await expect(more).toBeVisible();
  await expect(more).toHaveAttribute('aria-expanded', 'true');
});

test('the apartment page is styled from its first frame, on a full load and in the app', async ({
  page,
}) => {
  // Before every frame, for the page and the gallery each, whether its own rules apply.
  await page.addInitScript(() => {
    const rules = (element: Element) =>
      element.matches('.apartment')
        ? getComputedStyle(element).paddingTop === '16px'
        : getComputedStyle(element).containerType === 'inline-size';
    const frames: Record<string, boolean[]> = { '.apartment': [], '.gallery': [] };
    Object.assign(window, { frames_: frames, rules_: rules });
    const sample = () => {
      for (const [selector, seen] of Object.entries(frames)) {
        const element = document.querySelector(selector);
        if (element) seen.push(rules(element));
      }
      requestAnimationFrame(sample);
    };
    requestAnimationFrame(sample);
  });
  interface Probe {
    frames_: Record<string, boolean[]>;
    rules_: (element: Element) => boolean;
  }
  const styled = () =>
    expect(async () => {
      const frames = await page.evaluate(() => (window as unknown as Probe).frames_);
      for (const seen of Object.values(frames)) {
        expect(seen.length).toBeGreaterThan(2);
        expect(seen).not.toContain(false);
      }
    }).toPass();
  await page.goto('/en/apartments/zirbe');
  await styled();
  await page.getByRole('link', { name: 'Frequently asked questions' }).click();
  await expect(page).toHaveURL('/en/faq');
  // Off the page its rules are gone, so the way back adds them again.
  expect(
    await page.evaluate(() =>
      ['apartment', 'gallery'].map((name) => {
        const element = document.body.appendChild(document.createElement('div'));
        element.className = name;
        const applied = (window as unknown as Probe).rules_(element);
        element.remove();
        return applied;
      }),
    ),
  ).toEqual([false, false]);
  await page.evaluate(() => {
    for (const seen of Object.values((window as unknown as Probe).frames_)) seen.length = 0;
    Object.assign(window, { kept: true });
  });
  await page.goBack();
  await styled();
  // Still the same document, so the app drew the page.
  expect(await page.evaluate(() => 'kept' in window)).toBe(true);
});

test('on a phone a description that fits above the cut but for its last margin is not cut', async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 700 });
  await page.goto('/en/apartments/zirbe');
  const more = page.getByRole('button', { name: 'Read more' });
  await expect(more).toBeVisible();
  // A paragraph 4 px shorter than the cut; its 10 px bottom margin passes it.
  await page.locator('.prose').evaluate((prose) => {
    const cut = parseFloat(getComputedStyle(prose.parentElement!).getPropertyValue('--cut'));
    prose.innerHTML = `<p style="height: calc(${cut}rem - 4px)">Short.</p>`;
  });
  await expect(more).toBeHidden();
  await expect(page.locator('.prose-fold')).not.toHaveAttribute('data-long');
  // Text after a rule is cut by less than the rule's margin: the button stays.
  await page.locator('.prose').evaluate((prose) => {
    const cut = parseFloat(getComputedStyle(prose.parentElement!).getPropertyValue('--cut'));
    prose.innerHTML = '<p>Short.</p><hr>Last words.';
    const first = prose.firstElementChild as HTMLElement;
    first.style.height = `calc(${cut}rem + 8px - ${prose.offsetHeight - first.offsetHeight}px)`;
  });
  await expect(more).toBeVisible();
});

test('a link in the description’s last line shows its whole focus ring', async ({ page }) => {
  // Also below a leading rule, whose top margin would fall outside the measured height.
  for (const [width, rule] of [
    [320, false],
    [320, true],
    [1280, false],
  ] as const) {
    await page.setViewportSize({ width, height: 800 });
    await page.goto('/en/apartments/zirbe');
    if (rule)
      await page.locator('.prose').evaluate((prose) => prose.prepend(document.createElement('hr')));
    await page.evaluate(() => scrollTo({ top: 0, behavior: 'instant' }));
    await page.locator('.back').focus();
    const link = page.locator('.prose').getByRole('link');
    for (let i = 0; i < 10 && !(await link.evaluate((a) => a === document.activeElement)); i++)
      await page.keyboard.press('Tab');
    await expect(link).toHaveCSS('outline-style', 'solid');
    // Each line of the link, grown by its ring, against the fold's clip: its padding box.
    const outside = () =>
      link.evaluate((a) => {
        const fold = a.closest('.fold')!.getBoundingClientRect();
        const ring =
          parseFloat(getComputedStyle(a).outlineWidth) +
          parseFloat(getComputedStyle(a).outlineOffset);
        return Math.max(
          ...[...a.getClientRects()].flatMap((line) => [
            fold.top - (line.top - ring),
            line.bottom + ring - fold.bottom,
            fold.left - (line.left - ring),
            line.right + ring - fold.right,
          ]),
        );
      });
    await expect
      .poll(outside, `at ${width} px${rule ? ' below a rule' : ''}`)
      .toBeLessThanOrEqual(0);
  }
});

test(
  'a language Beds24 has no texts in leaves the description and the house rules out',
  { tag: '@any-engine' },
  async ({ page }) => {
    await page.goto('http://localhost:4002/it/appartamenti/castagno');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Sotto i Castagni Due');
    await expect(page.locator('.facts')).toContainText('Fino a 4 ospiti');
    await expect(page.locator('.prose')).toHaveCount(0);
    await expect(page.locator('.rooms h3')).toHaveText(['Camera 1', 'Camera 2', 'Bagno']);
    await expect(page.locator('.amenities')).toContainText('Wi-Fi');
    await expect(page.locator('hlm-accordion-trigger')).toHaveText(['Arrivo e partenza']);
    // A picture not marked as generated carries no label.
    await expect(page.locator('.ai-label')).toHaveCount(0);
  },
);

test(
  'without Beds24 the page answers 503 with the name, the picture and a sentence',
  { tag: '@any-engine' },
  async ({ page }) => {
    const response = await page.goto('http://localhost:4001/en/apartments/zirbe');
    expect(response!.status()).toBe(503);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Zirbe');
    await expect(page.locator('.tile img').first()).toBeVisible();
    await expect(page.getByText('cannot be loaded just now')).toBeVisible();
    await expect(
      page.locator('.facts, .prose, .rooms, .amenities, .spartan-accordion'),
    ).toHaveCount(0);
    await expect(page.locator('.panel')).toContainText('The free weeks cannot be shown just now.');
  },
);

test('at 320 px nothing scrolls sideways, in both seasons and languages', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 700 });
  // The rooms stand one below the other, where two would break a name, and two by two from 360.
  for (const [width, columns] of [
    [320, 1],
    [360, 2],
  ]) {
    await page.setViewportSize({ width, height: 700 });
    await page.goto('/de/wohnungen/ahorn');
    expect(
      await page
        .locator('.rooms')
        .evaluate((grid) => getComputedStyle(grid).gridTemplateColumns.split(' ').length),
      `at ${width}`,
    ).toBe(columns);
  }
  await page.setViewportSize({ width: 320, height: 700 });
  for (const path of ['/de/wohnungen/ahorn', '/en/apartments/laerche'])
    for (const season of ['winter', 'summer']) {
      await page.goto(`${path}?season=${season}`);
      expect(await page.evaluate(() => document.documentElement.scrollWidth), path).toBe(320);
    }
});

test('from 64rem the panel stands beside the content from the facts down, below it after the amenities', async ({
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
    const top = async (selector: string) => (await page.locator(selector).boundingBox())!.y;
    if (columns === 2) expect(await top('.panel')).toBeLessThan((await top('.facts')) + 1);
    else {
      expect(await top('.panel')).toBeGreaterThan(await top('.amenities'));
      expect(await top('.panel')).toBeLessThan(await top('.spartan-accordion'));
    }
  }
});

test('every tab stop on an apartment page shows a focus ring', async ({ page, browserName }) => {
  test.skip(browserName === 'webkit', 'Safari tabs only to fields unless told otherwise');
  // In the next season, which always has free weeks; the one shown by date may have none left.
  await page.goto('/de/wohnungen/ahorn');
  const later = await page.locator('.panel-season').last().getAttribute('data-for');
  await page.goto(`/de/wohnungen/ahorn?season=${later}`);
  await page.locator('.back').focus();
  const seen: string[] = [];
  const panel: string[] = [];
  for (let i = 0; i < 30; i++) {
    const stop = await page.evaluate(() => {
      const element = document.activeElement as HTMLElement;
      // A radio's ring is its label's, a week's its row's, the season button's its shown label's.
      const ringed = [
        element,
        element.closest('label, .week, .count'),
        ...element.querySelectorAll(':scope > *'),
      ];
      const ring = ringed.some((one) => {
        const style = one && getComputedStyle(one);
        return style && style.outlineStyle !== 'none' && parseFloat(style.outlineWidth) >= 2;
      });
      // A picture's cell by its picture: each says "KI-Bild".
      const text =
        element.querySelector('img')?.alt ??
        element.getAttribute('aria-label') ??
        element.textContent?.trim();
      return {
        name: `${element.tagName.toLowerCase()} ${text?.slice(0, 30)}`,
        ring,
        inside: !!element.closest('main'),
        panel: !!element.closest('.panel'),
      };
    });
    if (!stop.inside || seen.includes(stop.name)) break;
    (stop.panel ? panel : seen).push(stop.name);
    expect(stop.ring, stop.name).toBe(true);
    await page.keyboard.press('Tab');
  }
  const cells = await page
    .locator('.tile:visible img')
    .evaluateAll((images: HTMLImageElement[]) =>
      images.map(({ alt }) => `button ${alt.slice(0, 30)}`),
    );
  expect(cells).toHaveLength(8);
  expect(seen).toEqual([
    'a Alle Wohnungen',
    ...cells,
    'button Anreise und Abreise',
    'button Hausordnung',
  ]);
  // Between the pictures and the terms: the season, the view, the month, its weeks and the guests.
  expect(panel).toEqual(
    expect.arrayContaining([
      expect.stringMatching(/^button (Sommer|Winter)/),
      'input Liste',
      'button Nächster Monat',
      expect.stringMatching(/^span (€|belegt)/),
      'button 2',
      'button 0',
    ]),
  );
});

// One test per language and width: more scans in one come too close to the test's time limit.
for (const path of ['/de/wohnungen/zirbe', '/en/apartments/zirbe'])
  for (const width of [320, 1280])
    test(
      `${path} passes axe at ${width} px in both seasons, with everything open`,
      { tag: '@any-engine' },
      async ({ page }) => {
        for (const season of ['winter', 'summer']) {
          await page.setViewportSize({ width, height: 800 });
          await page.goto(`${path}?season=${season}`);
          const place = `in ${season}`;
          const { violations } = await new AxeBuilder({ page }).include('main').analyze();
          expect(violations, place).toEqual([]);
          // Every fold's button the width shows, in the page's language.
          for (const button of await page.locator('.apartment .text-button:visible').all())
            await button.click();
          await page.locator('hlm-accordion-trigger button').last().click();
          const open = await new AxeBuilder({ page }).include('main').analyze();
          expect(open.violations, place).toEqual([]);
        }
      },
    );
