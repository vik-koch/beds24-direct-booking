import { listingOf, loadInventory, multiplier } from './client';

describe('loadInventory', () => {
  const properties = {
    success: true,
    type: 'property',
    data: [
      {
        id: 1,
        currency: 'EUR',
        address: 'Musterweg 1',
        city: 'Saalbach',
        checkInStart: '16:00',
        checkInEnd: '20:00',
        checkOutEnd: '10:00',
        featureCodes: [['WIFI'], ['PARKING_PAID']],
        texts: [
          { language: 'de', houseRules: 'Nachtruhe ab 22 Uhr. \r\n' },
          { language: 'en', houseRules: '' },
        ],
        bookingPageMultiplier: '*0.9',
        upsellItems: [
          { index: 1, type: 'notUsed', amount: 0, per: 'booking', period: 'oneTime' },
          { index: 2, type: 'obligatory', amount: 2.5, per: 'adult', period: 'daily' },
        ],
        roomTypes: [
          {
            id: 11,
            maxPeople: 4,
            maxAdult: null,
            maxChildren: 3,
            roomSize: 61,
            featureCodes: [['BEDROOM', 'BED_DOUBLE'], ['BOOT_DRYER']],
            texts: [
              {
                language: 'de',
                contentHeadline: 'Für vier ',
                contentDescription: 'Zwei Schlafzimmer.',
                roomDescription: '<p><b>61 m²</b> mit Balkon.<br></p>',
              },
              {
                language: 'en',
                contentHeadline: '',
                contentDescription: '',
                roomDescription: '<p><br></p>',
              },
            ],
            priceRules: [{ id: 1, minDaysUntilCheckin: 7 }, { id: 2 }],
          },
        ],
      },
      // Without any text, Beds24 leaves the key out; of its times only the latest arrival is set.
      {
        id: 2,
        currency: 'EUR',
        address: '',
        city: 'Saalbach',
        checkInStart: '',
        checkInEnd: '18:00',
        checkOutEnd: '',
        featureCodes: [],
        roomTypes: [
          {
            id: 21,
            // No children are asked for.
            maxPeople: 2,
            maxAdult: null,
            maxChildren: null,
            roomSize: 34,
            featureCodes: [],
            texts: [
              { language: 'de', contentHeadline: '', contentDescription: '', roomDescription: '' },
            ],
          },
        ],
      },
    ],
  };
  const calendars = {
    success: true,
    type: 'calendar',
    data: [
      {
        roomId: 11,
        calendar: [
          { from: '2027-01-01', to: '2027-01-01', numAvail: 1, override: 'none', price1: 150.5 },
          { from: '2027-01-02', to: '2027-01-04', numAvail: 0, override: 'noCheckInOrCheckOut' },
        ],
      },
    ],
  };
  const answer = (status: number, ...bodies: object[]) =>
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async (url: string) =>
          new Response(JSON.stringify(url.includes('calendar') ? bodies[1] : bodies[0]), {
            status,
          }),
      ),
    );
  beforeEach(() => {
    vi.stubEnv('BEDS24_URL', 'http://beds24.test/v2');
    vi.stubEnv('BEDS24_TOKEN', 'secret');
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it('maps rooms, their lead time, multiplier and tax, and every day asked for', async () => {
    answer(200, properties, calendars);
    const { rooms, days } = await loadInventory('2027-01-01', '2027-01-05');
    expect(rooms).toEqual([
      {
        id: 11,
        propertyId: 1,
        maxPeople: 4,
        asksChildren: true,
        size: 61,
        bedrooms: 1,
        currency: 'EUR',
        leadDays: 7,
        multiplier: 0.9,
        tax: { amount: 2.5, per: 'night' },
        address: 'Musterweg 1, Saalbach',
        checkIn: { from: '16:00', until: '20:00' },
        checkOut: '10:00',
        features: [['WIFI'], ['PARKING_PAID'], ['BEDROOM', 'BED_DOUBLE'], ['BOOT_DRYER']],
        headlines: { de: 'Für vier', en: '' },
        texts: {
          de: {
            description: '<p><strong>61 m²</strong> mit Balkon.</p>',
            houseRules: 'Nachtruhe ab 22 Uhr.',
          },
          en: { description: '', houseRules: '' },
        },
      },
      {
        id: 21,
        propertyId: 2,
        maxPeople: 2,
        asksChildren: false,
        size: 34,
        bedrooms: 0,
        currency: 'EUR',
        leadDays: 0,
        multiplier: 1,
        tax: null,
        address: 'Saalbach',
        checkIn: { from: null, until: '18:00' },
        checkOut: null,
        features: [],
        headlines: { de: '' },
        texts: { de: { description: '', houseRules: '' } },
      },
    ]);
    expect(days[11]).toEqual([
      { date: '2027-01-01', free: true, price: 150.5, changeover: true },
      { date: '2027-01-02', free: false, price: null, changeover: false },
      { date: '2027-01-03', free: false, price: null, changeover: false },
      { date: '2027-01-04', free: false, price: null, changeover: false },
      // Not listed by Beds24, so closed.
      { date: '2027-01-05', free: false, price: null, changeover: false },
    ]);
    expect(fetch).toHaveBeenCalledWith(
      'http://beds24.test/v2/inventory/rooms/calendar?startDate=2027-01-01&endDate=2027-01-05&includeNumAvail=true&includePrices=true&includeOverride=true',
      expect.objectContaining({ headers: { token: 'secret' } }),
    );
  });

  it('warns of a room that limits adults or children apart from its total, and takes the total', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const strict = structuredClone(properties);
    // Fewer adults and children than the total, and more adults than guests.
    Object.assign(strict.data[0].roomTypes[0], { maxAdult: 3, maxChildren: 2 });
    Object.assign(strict.data[1].roomTypes[0], { maxAdult: 3 });
    answer(200, strict, calendars);
    const { rooms } = await loadInventory('2027-01-01', '2027-01-05');
    expect(warn.mock.calls).toEqual([
      ['Room 11 limits adults or children apart from its total: ignored'],
      ['Room 21 limits adults or children apart from its total: ignored'],
    ]);
    expect(rooms.map(({ maxPeople, asksChildren }) => [maxPeople, asksChildren])).toEqual([
      [4, true],
      [2, false],
    ]);
    warn.mockRestore();
  });

  it('asks for the texts in every language', async () => {
    answer(200, properties, calendars);
    await loadInventory('2027-01-01', '2027-01-05');
    expect(fetch).toHaveBeenCalledWith(
      expect.stringMatching(/\/properties\?.*includeTexts=all&includeLanguages=all/),
      expect.anything(),
    );
  });

  it('fails when Beds24 refuses the token', async () => {
    answer(401, { success: false, type: 'error', code: 401, error: 'Token not valid' });
    await expect(loadInventory('2027-01-01', '2027-01-05')).rejects.toThrow('Beds24 answered 401');
  });

  it('names the missing address instead of fetching', async () => {
    answer(200, { data: [] });
    vi.stubEnv('BEDS24_URL', undefined);
    await expect(loadInventory('2027-01-01', '2027-01-05')).rejects.toThrow(
      'BEDS24_URL is not set',
    );
    expect(fetch).not.toHaveBeenCalled();
  });
});

describe('multiplier', () => {
  it('reads the form Beds24 applies, and no other', () => {
    expect(multiplier('*0.9')).toBe(0.9);
    expect(multiplier('*1.15')).toBe(1.15);
    expect(multiplier('')).toBe(1);
    expect(multiplier(undefined)).toBe(1);
    expect(multiplier('0.9')).toBeNull();
    expect(multiplier('*x')).toBeNull();
  });
});

describe('listingOf', () => {
  const room = {
    id: 11,
    propertyId: 1,
    maxPeople: 4,
    asksChildren: true,
    size: 61,
    bedrooms: 1,
    currency: 'EUR',
    leadDays: 0,
    multiplier: 1,
    tax: null,
    address: 'Musterweg 1, Saalbach',
    checkIn: { from: '16:00', until: null },
    checkOut: '10:00',
    features: [['WIFI']],
    headlines: { de: 'Für vier' },
    texts: Object.fromEntries(
      ['de', 'en', 'it'].map((code) => [code, { description: code, houseRules: '' }]),
    ),
  };

  it("keeps the page's facts and the site's languages only", () => {
    const listing = listingOf([room], 11, ['de', 'en', 'fr']);
    expect(listing).toEqual({
      maxPeople: 4,
      asksChildren: true,
      size: 61,
      bedrooms: 1,
      address: 'Musterweg 1, Saalbach',
      checkIn: { from: '16:00', until: null },
      checkOut: '10:00',
      features: [['WIFI']],
      texts: { de: room.texts['de'], en: room.texts['en'] },
    });
  });

  it('fails for a room Beds24 does not list', () => {
    expect(() => listingOf([room], 12, ['de'])).toThrow('Beds24 has no room 12');
  });
});
