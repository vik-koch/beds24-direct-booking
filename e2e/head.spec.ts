import { expect, test, type APIRequestContext, type Page } from '@playwright/test';

const site = 'https://beds24.vikkoch.com';

// Every indexed page's addresses in both languages, and its description in English.
const indexed = [
  ['/de', '/en', 'Three holiday apartments for 2 to 6 guests'],
  ['/de/wohnungen/zirbe', '/en/apartments/zirbe', 'For two, with a rain shower'],
  ['/de/wohnungen/laerche', '/en/apartments/laerche', 'For four, with a south-facing balcony'],
  ['/de/wohnungen/ahorn', '/en/apartments/ahorn', 'For six, with a terrace and a sauna'],
  ['/de/wohnungen/zirbe/anfahrt', '/en/apartments/zirbe/getting-here', 'How to get to Zirbe'],
  ['/de/haeufige-fragen', '/en/faq', 'Answers before and during your stay'],
  ['/de/ueber-uns', '/en/about', 'Who lets the apartments'],
  ['/de/parken', '/en/parking', 'Where to park in Saalbach'],
  ['/de/impressum', '/en/imprint', 'The legal details'],
  ['/de/datenschutz', '/en/privacy', 'Which data this website'],
  ['/de/agb', '/en/terms', 'The rental terms'],
  ['/de/bildnachweis', '/en/picture-credits', 'Who took the photos'],
];
const unlisted = [
  '/de/wohnungen/zirbe/buchen',
  '/en/apartments/zirbe/book',
  '/de/buchungsbestaetigung',
  '/en/booking-confirmation',
  '/de/wohnungen/zirbe/wohnungsmappe',
  '/en/apartments/zirbe/guide',
];

// To an apartment's page by the home page's first link to it.
const navigate = (page: Page, name: string) =>
  page.getByRole('main').getByRole('link', { name, exact: true }).first().click();

// The head as the server sends it, which is what a crawler reads.
async function head(request: APIRequestContext, path: string) {
  const response = await request.get(path);
  expect(response.status(), path).toBe(200);
  const html = (await response.text()).split('</head>')[0];
  const all = (pattern: RegExp) => [...html.matchAll(pattern)].map((match) => match[1]);
  const meta = (key: string) =>
    all(new RegExp(`<meta (?:name|property)="${key}" content="([^"]*)">`, 'g'));
  const link = (rel: string, hreflang?: string) =>
    all(
      new RegExp(
        `<link rel="${rel}"${hreflang ? ` hreflang="${hreflang}"` : ''} href="([^"]*)">`,
        'g',
      ),
    );
  const data = all(/<script type="application\/ld\+json">([^<]*)<\/script>/g).map(
    (text) => JSON.parse(text) as Record<string, unknown> & { '@type': string },
  );
  return { meta, link, data };
}

test(
  'an indexed page tells search engines and link previews its description, address and picture',
  { tag: '@any-engine' },
  async ({ request }) => {
    for (const [de, en, description] of indexed)
      for (const path of [de, en]) {
        const { meta, link } = await head(request, path);
        expect(meta('robots'), path).toEqual([]);
        expect(link('canonical'), path).toEqual([site + path]);
        expect(link('alternate', 'de-AT'), path).toEqual([site + de]);
        expect(link('alternate', 'en-GB'), path).toEqual([site + en]);
        expect(link('alternate', 'x-default'), path).toEqual([site + (de === '/de' ? '/' : de)]);
        const [text] = meta('description');
        expect(text.length, path).toBeLessThanOrEqual(160);
        if (path === en) expect(text, path).toContain(description);
        expect(meta('og:description'), path).toEqual([text]);
        expect(meta('og:url'), path).toEqual([site + path]);
        expect(meta('og:locale'), path).toEqual([path === de ? 'de_AT' : 'en_GB']);
        expect(meta('og:title')[0], path).toContain('Firn &amp; Farn');
        expect(meta('twitter:card'), path).toEqual(['summary_large_image']);
        expect(meta('og:image:alt'), path).toHaveLength(1);
        const [image] = meta('og:image');
        expect(image, path).toMatch(new RegExp(`^${site}/pictures/previews/.+\\.jpg$`));
        const picture = await request.get(image.slice(site.length));
        expect(picture.headers()['content-type'], path).toBe('image/jpeg');
      }
  },
);

test(
  'the home page and an apartment describe the business and the apartment as structured data',
  { tag: '@any-engine' },
  async ({ request }) => {
    const {
      data: [home],
      meta: homeMeta,
    } = await head(request, '/en');
    expect(home).toMatchObject({
      '@context': 'https://schema.org',
      '@type': 'LodgingBusiness',
      name: 'Firn & Farn Appartements',
      url: `${site}/en`,
      image: homeMeta('og:image')[0],
      address: {
        '@type': 'PostalAddress',
        streetAddress: 'Musterweg 0',
        postalCode: '5753',
        addressLocality: 'Saalbach',
        addressCountry: 'AT',
      },
    });
    expect(home['containsPlace']).toEqual([
      { '@type': 'Apartment', name: 'Zirbe', url: `${site}/en/apartments/zirbe` },
      { '@type': 'Apartment', name: 'Lärche', url: `${site}/en/apartments/laerche` },
      { '@type': 'Apartment', name: 'Ahorn', url: `${site}/en/apartments/ahorn` },
    ]);
    const { data, meta } = await head(request, '/de/wohnungen/zirbe');
    expect(data).toHaveLength(1);
    expect(data[0]).toMatchObject({
      '@type': 'Apartment',
      name: 'Zirbe',
      url: `${site}/de/wohnungen/zirbe`,
      image: meta('og:image')[0],
      description: meta('description')[0],
      geo: { '@type': 'GeoCoordinates', latitude: 47.38782, longitude: 12.64654 },
      occupancy: { '@type': 'QuantitativeValue', maxValue: 2 },
      numberOfBedrooms: 1,
      floorSize: { '@type': 'QuantitativeValue', value: 34, unitCode: 'MTK' },
      containedInPlace: {
        '@type': 'LodgingBusiness',
        url: `${site}/de`,
        image: home['image'],
        address: { addressCountry: 'AT' },
      },
    });
    // Other pages have none.
    expect((await head(request, '/en/faq')).data).toEqual([]);
  },
);

test(
  'the booking step, the confirmation, an unlisted and a missing page are not indexed',
  { tag: '@any-engine' },
  async ({ request }) => {
    for (const path of unlisted) {
      const { meta, link, data } = await head(request, path);
      expect(meta('robots'), path).toEqual(['noindex']);
      expect(link('canonical'), path).toEqual([]);
      expect(link('alternate', 'x-default'), path).toEqual([]);
      expect(data, path).toEqual([]);
    }
    for (const path of ['/de/nichts-hier', '/en/nothing-here']) {
      const missing = await request.get(path);
      expect(missing.status(), path).toBe(404);
      const html = (await missing.text()).split('</head>')[0];
      expect(html, path).toContain('<meta name="robots" content="noindex">');
      expect(html, path).not.toMatch(/og:|rel="canonical"|rel="alternate"|ld\+json/);
    }
  },
);

test('a navigation in the page replaces the head instead of adding to it', async ({ page }) => {
  const count = (selector: string) => page.locator(`head ${selector}`).count();
  const expectOne = async (path: string, data: number) => {
    await expect(page.locator('link[rel=canonical]')).toHaveAttribute('href', site + path);
    expect(await count('link[rel=canonical]')).toBe(1);
    expect(await count('link[rel=alternate]')).toBe(3);
    expect(await count('meta[name=description]')).toBe(1);
    expect(await count('meta[property="og:image"]')).toBe(1);
    expect(await count('script[type="application/ld+json"]')).toBe(data);
  };
  await page.goto('/en');
  await expectOne('/en', 1);
  await navigate(page, 'Zirbe');
  await expect(page).toHaveURL('/en/apartments/zirbe');
  await expectOne('/en/apartments/zirbe', 1);
  await expect(page.locator('meta[name=description]')).toHaveAttribute(
    'content',
    'For two, with a rain shower',
  );
  await page.getByRole('contentinfo').getByRole('link', { name: 'Imprint' }).click();
  await expect(page).toHaveURL('/en/imprint');
  await expectOne('/en/imprint', 0);
});

test(
  'the sitemap lists every indexed page in both languages with its alternates, and robots.txt names it',
  { tag: '@any-engine' },
  async ({ request }) => {
    const robots = await request.get('/robots.txt');
    expect(robots.headers()['content-type']).toContain('text/plain');
    expect(await robots.text()).toBe(`User-agent: *\nAllow: /\n\nSitemap: ${site}/sitemap.xml\n`);
    const response = await request.get('/sitemap.xml');
    expect(response.headers()['content-type']).toContain('application/xml');
    const xml = await response.text();
    const urls = [...xml.matchAll(/<url><loc>([^<]*)<\/loc>(.*?)<\/url>/g)];
    expect(urls.map(([, loc]) => loc.slice(site.length)).sort()).toEqual(
      indexed.flatMap(([de, en]) => [de, en]).sort(),
    );
    const faq = urls.find(([, loc]) => loc === `${site}/en/faq`)![2];
    expect(faq).toBe(
      `<xhtml:link rel="alternate" hreflang="de-AT" href="${site}/de/haeufige-fragen"/>` +
        `<xhtml:link rel="alternate" hreflang="en-GB" href="${site}/en/faq"/>` +
        `<xhtml:link rel="alternate" hreflang="x-default" href="${site}/de/haeufige-fragen"/>`,
    );
  },
);

test(
  'the business data gives an address the footer leaves out, and a locale without a region gets one',
  { tag: '@any-engine' },
  async ({ request }) => {
    const other = 'http://localhost:4002';
    const italian = await head(request, `${other}/it`);
    expect(italian.data[0]).toMatchObject({
      '@type': 'LodgingBusiness',
      name: 'Casa Prova',
      address: {
        streetAddress: 'Via di Prova 1',
        postalCode: '39030',
        addressLocality: 'Prova',
        addressCountry: 'IT',
      },
    });
    expect(italian.meta('og:locale')).toEqual(['it_IT']);
    expect(italian.link('canonical')).toEqual(['https://casa-prova.example/it']);
    expect((await head(request, `${other}/nl`)).meta('og:locale')).toEqual(['nl_BE']);
  },
);

test(
  "a shared link's preview shows the season it names, by itself or by its week",
  { tag: '@any-engine' },
  async ({ request }) => {
    for (const [query, season] of [
      ['?season=summer', 'summer'],
      ['?season=winter', 'winter'],
      ['?arrival=2027-07-03', 'summer'],
      ['?arrival=2027-01-02', 'winter'],
    ]) {
      const apartment = await head(request, `/en/apartments/zirbe${query}`);
      const [picture, alt] = season === 'summer' ? [1, 'Stone pine studio with'] : [2, 'in winter'];
      expect(apartment.meta('og:image')[0], query).toContain(`/zirbe-${picture}.`);
      expect(apartment.meta('og:image:alt')[0], query).toContain(alt);
      expect(apartment.link('canonical'), query).toEqual([`${site}/en/apartments/zirbe`]);
      const home = await head(request, `/en${query}`);
      expect(home.meta('og:image')[0], query).toContain(`/hero-${season}.`);
    }
  },
);
