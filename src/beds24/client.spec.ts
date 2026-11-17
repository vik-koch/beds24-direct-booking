import { loadInventory, multiplier } from './client';

describe('loadInventory', () => {
  const properties = {
    success: true,
    type: 'property',
    data: [
      {
        id: 1,
        currency: 'EUR',
        bookingPageMultiplier: '*0.9',
        upsellItems: [
          { index: 1, type: 'notUsed', amount: 0, per: 'booking', period: 'oneTime' },
          { index: 2, type: 'obligatory', amount: 2.5, per: 'adult', period: 'daily' },
        ],
        roomTypes: [
          {
            id: 11,
            maxPeople: 4,
            roomSize: 61,
            priceRules: [{ id: 1, minDaysUntilCheckin: 7 }, { id: 2 }],
          },
        ],
      },
      { id: 2, currency: 'EUR', roomTypes: [{ id: 21, maxPeople: 2, roomSize: 34 }] },
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
        size: 61,
        currency: 'EUR',
        leadDays: 7,
        multiplier: 0.9,
        tax: { amount: 2.5, per: 'night' },
      },
      {
        id: 21,
        propertyId: 2,
        maxPeople: 2,
        size: 34,
        currency: 'EUR',
        leadDays: 0,
        multiplier: 1,
        tax: null,
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
