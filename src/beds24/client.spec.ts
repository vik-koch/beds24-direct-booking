import type { AddressInfo } from 'node:net';
import { sim } from '../../sim/server.ts';
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
        permit: ' 00000-000001 ',
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
        permit: '',
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
      vi.fn(async (url: string) =>
        url.endsWith('/authentication/token')
          ? Response.json({ token: 'secret', expiresIn: 86_400 })
          : new Response(JSON.stringify(url.includes('calendar') ? bodies[1] : bodies[0]), {
              status,
            }),
      ),
    );
  beforeEach(() => {
    vi.stubEnv('BEDS24_URL', 'http://beds24.test/v2');
    vi.stubEnv('BEDS24_REFRESH_TOKEN', 'refresh');
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
        permit: '00000-000001',
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
        permit: '',
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
    permit: '00000-000001',
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
      permit: '00000-000001',
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

// Against the simulator, with the client loaded afresh so that no access token is kept.
describe('the token and the bookings', () => {
  const server = sim().listen(0);
  let client: typeof import('./client');
  const guest = {
    firstName: 'Anna',
    lastName: 'Muster',
    email: 'anna@example.com',
    phone: '+49 30 1234567',
    country: 'DE',
    language: 'en',
  };
  const charges = [
    { description: 'Stay from 3 to 10 July', qty: 1, amount: 1290 },
    { description: 'Tourist tax', qty: 14, amount: 2.5 },
  ];
  const renewals = () =>
    vi.mocked(fetch).mock.calls.filter(([url]) => String(url).endsWith('/authentication/token'))
      .length;
  // A week the simulator has free for its second apartment.
  const freeWeek = async () => {
    const { days } = await client.loadInventory('2027-06-05', '2027-09-30');
    const list = days[9001012];
    const index = list.findIndex(
      (day, i) =>
        day.changeover &&
        new Date(day.date).getUTCDay() === 6 &&
        list.slice(i, i + 7).every(({ free }) => free),
    );
    const arrival = list[index].date;
    return {
      roomId: 9001012,
      arrival,
      departure: client.addDays(arrival, 7),
      adults: 2,
      children: 0,
    };
  };
  beforeEach(async () => {
    vi.stubEnv('BEDS24_URL', `http://localhost:${(server.address() as AddressInfo).port}/v2`);
    vi.stubEnv('BEDS24_REFRESH_TOKEN', 'simulator');
    vi.spyOn(globalThis, 'fetch');
    vi.resetModules();
    client = await import('./client');
  });
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
    vi.useRealTimers();
  });
  afterAll(() => server.close());

  it('takes one access token for callers at the same moment, and renews it an hour before it expires', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    await Promise.all([
      client.loadInventory('2027-01-01', '2027-01-07'),
      client.loadInventory('2027-01-01', '2027-01-07'),
    ]);
    vi.advanceTimersByTime(22 * 36e5);
    await client.loadInventory('2027-01-01', '2027-01-07');
    expect(renewals()).toBe(1);
    vi.advanceTimersByTime(36e5 + 1);
    await client.loadInventory('2027-01-01', '2027-01-07');
    expect(renewals()).toBe(2);
    // Past the expiry too, as after a night without a page view.
    vi.advanceTimersByTime(2 * 864e5);
    await client.loadInventory('2027-01-01', '2027-01-07');
    expect(renewals()).toBe(3);
  });

  it('fails when Beds24 refuses the refresh token, and tries again on the next call', async () => {
    vi.stubEnv('BEDS24_REFRESH_TOKEN', 'expired');
    await expect(client.loadInventory('2027-01-01', '2027-01-07')).rejects.toThrow(
      'Beds24 answered 401 to the token refresh',
    );
    vi.stubEnv('BEDS24_REFRESH_TOKEN', 'simulator');
    await expect(client.loadInventory('2027-01-01', '2027-01-07')).resolves.toBeDefined();
  });

  it('books a week, records its payment, confirms and cancels it', async () => {
    const stay = await freeWeek();
    const id = await client.createBooking(stay, guest, charges);
    expect(id).toEqual(expect.any(Number));
    // The simulator keeps no guest details, so they are read off the request.
    const [, sent] = vi
      .mocked(fetch)
      .mock.calls.find(([url]) => String(url).endsWith('/bookings'))!;
    expect(JSON.parse(String(sent?.body))).toEqual([
      expect.objectContaining({
        numAdult: 2,
        numChild: 0,
        firstName: 'Anna',
        lastName: 'Muster',
        email: 'anna@example.com',
        phone: '+49 30 1234567',
        country2: 'DE',
        lang: 'en',
        actions: { checkAvailability: true },
      }),
    ]);
    expect(server.bookings.get(id as number)).toMatchObject({
      roomId: 9001012,
      arrival: stay.arrival,
      departure: stay.departure,
      status: 'new',
      price: 1325,
      invoiceItems: charges.map((charge) => ({ type: 'charge', ...charge })),
    });
    await client.recordPayment(id as number, { description: 'Paid by card', amount: 1325 }, 'pi_1');
    expect(server.bookings.get(id as number)).toMatchObject({
      status: 'confirmed',
      invoiceItems: [
        {},
        {},
        { type: 'payment', description: 'Paid by card', qty: 1, amount: 1325 },
      ],
      infoItems: [{ code: 'STRIPE_PAYMENT', text: 'pi_1' }],
      notified: 0,
    });
    await client.sendConfirmation(id as number);
    expect(server.bookings.get(id as number)?.notified).toBe(1);
    await client.cancelBooking(id as number);
    expect(server.bookings.get(id as number)?.status).toBe('cancelled');
  });

  it('answers that a week is taken when Beds24 holds it already', async () => {
    const stay = await freeWeek();
    await client.createBooking(stay, guest, charges);
    expect(await client.createBooking(stay, guest, charges)).toBe('taken');
  });

  it('fails for a booking Beds24 does not have, naming only the booking', async () => {
    await expect(
      client.recordPayment(1, { description: 'Paid by card', amount: 1 }, 'pi_1'),
    ).rejects.toThrow(/^Beds24 refused the payment of booking 1$/);
    await expect(client.cancelBooking(1)).rejects.toThrow(
      /^Beds24 refused the cancellation of booking 1$/,
    );
  });

  it('drops an access token Beds24 refuses, so that the next call renews it', async () => {
    await client.loadInventory('2027-01-01', '2027-01-07');
    vi.mocked(fetch).mockResolvedValueOnce(new Response('{}', { status: 401 }));
    await expect(client.loadInventory('2027-01-01', '2027-01-07')).rejects.toThrow('401');
    await client.loadInventory('2027-01-01', '2027-01-07');
    expect(renewals()).toBe(2);
  });

  // With a token in hand, so that the booking itself is what fails.
  describe('when a booking call fails', () => {
    const stay = {
      roomId: 9001012,
      arrival: '2027-07-03',
      departure: '2027-07-10',
      adults: 2,
      children: 0,
    };
    const fails = async (reason: string) => {
      const logs = ['log', 'info', 'warn', 'error'].map((level) =>
        vi.spyOn(console, level as 'log').mockImplementation(() => undefined),
      );
      const error = await client.createBooking(stay, guest, charges).then(
        () => undefined,
        (error: Error) => error.message,
      );
      expect(error).toBe(`Beds24 ${reason}`);
      for (const log of logs) expect(log).not.toHaveBeenCalled();
    };
    beforeEach(() => client.loadInventory('2027-01-01', '2027-01-07'));

    it('names only the room when Beds24 is unreachable', async () => {
      vi.stubEnv('BEDS24_URL', 'http://localhost:9/v2');
      await fails('did not answer a booking of room 9001012');
    });

    it('repeats nothing of a broken answer', async () => {
      vi.mocked(fetch).mockResolvedValueOnce(
        new Response('[{"success":true,"new":{"id":7,"email":"anna@example.com"', { status: 201 }),
      );
      await fails('answered a booking of room 9001012 unreadably');
    });

    it('takes a success without a booking ID for a failure, not for a taken week', async () => {
      vi.mocked(fetch).mockResolvedValueOnce(Response.json([{ success: true }], { status: 201 }));
      await fails('refused a booking of room 9001012');
    });
  });
});
