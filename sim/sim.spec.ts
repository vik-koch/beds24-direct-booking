import { request } from 'node:http';
import type { AddressInfo } from 'node:net';
import { sim } from './server.ts';

interface Range {
  from: string;
  to: string;
  numAvail: number;
  override: string;
  price1?: number;
}

const server = sim('https://demo.example').listen(0);
const at = (path: string) =>
  `http://localhost:${(server.address() as AddressInfo).port}/v2/${path}`;
const refresh = (refreshToken: string) =>
  fetch(at('authentication/token'), { headers: { refreshToken } });
let access = '';
beforeAll(async () => ({ token: access } = await (await refresh('simulator')).json()));
const get = (path: string, token = access) => fetch(at(path), { headers: { token } });
const post = async (items: object[]) =>
  (
    await fetch(at('bookings'), {
      method: 'POST',
      headers: { token: access, 'Content-Type': 'application/json' },
      body: JSON.stringify(items),
    })
  ).json();
const room = 9001012;
const addDays = (date: string, days: number) =>
  new Date(Date.parse(date) + days * 864e5).toISOString().slice(0, 10);
const ranges = async (start: string, end: string, include = 'includeNumAvail=true') => {
  const path = `inventory/rooms/calendar?roomId=${room}&startDate=${start}&endDate=${end}`;
  const [{ calendar }] = (await (await get(`${path}&${include}`)).json()).data;
  return calendar as Range[];
};
const nights = async (arrival: string) => (await ranges(arrival, arrival))[0].numAvail;
// A Saturday next summer, always beyond the lead time, from which the simulator's own calendar
// leaves seven nights free.
const freeWeek = async () => {
  const year = new Date().getUTCFullYear() + 1;
  const range = (await ranges(`${year}-06-05`, `${year}-09-30`)).find(
    ({ from, to, numAvail }) =>
      numAvail === 1 &&
      new Date(from).getUTCDay() === 6 &&
      Date.parse(to) - Date.parse(from) >= 6 * 864e5,
  )!;
  return { roomId: room, arrival: range.from, departure: addDays(range.from, 7) };
};
afterAll(() => server.close());

describe('authentication', () => {
  it('answers an access token for the refresh token, and refuses any other', async () => {
    const response = await refresh('simulator');
    expect(response.headers.get('X-Request-Cost')).toBe('0.5');
    const { token, expiresIn } = await response.json();
    expect(expiresIn).toBe(86_400);
    expect((await get('properties', token)).status).toBe(200);
    expect((await get('properties', 'simulator')).status).toBe(401);
    const refused = await refresh('wrong');
    expect(refused.status).toBe(401);
    expect(refused.headers.has('X-Request-Cost')).toBe(false);
    expect(await refused.json()).toEqual({
      success: false,
      type: 'error',
      code: 401,
      error: 'Token not valid',
    });
  });

  // On a simulator of its own, as the clock it moves also moves the budget's window.
  it('refuses an access token after its 24 hours', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    const own = sim().listen(0);
    const url = `http://localhost:${(own.address() as AddressInfo).port}/v2`;
    const issue = async () =>
      (
        await (
          await fetch(`${url}/authentication/token`, { headers: { refreshToken: 'simulator' } })
        ).json()
      ).token;
    const status = async (token: string) =>
      (await fetch(`${url}/properties`, { headers: { token } })).status;
    const token = await issue();
    vi.advanceTimersByTime(86_400_000 - 1);
    expect(await status(token)).toBe(200);
    vi.advanceTimersByTime(1);
    expect(await status(token)).toBe(401);
    expect(await status(await issue())).toBe(200);
    own.close();
    vi.useRealTimers();
  });
});

describe('properties', () => {
  const everything =
    'properties?includeAllRooms=true&includeTexts=all&includeLanguages=all&includePriceRules=true&includeUpsellItems=true';

  it('refuses a call without the token as Beds24 does', async () => {
    const response = await get('properties', 'wrong');
    expect(response.status).toBe(401);
    expect(response.headers.has('X-Request-Cost')).toBe(false);
    expect(await response.json()).toEqual({
      success: false,
      type: 'error',
      code: 401,
      error: 'Token not valid',
    });
  });

  it('answers in the envelope with the rate limit headers', async () => {
    const response = await get(everything);
    expect(response.headers.get('X-Request-Cost')).toBe('1.6');
    const remaining = Number(response.headers.get('X-Five-Min-Limit-Remaining'));
    const next = await get(everything);
    expect(Number(next.headers.get('X-Five-Min-Limit-Remaining'))).toBeCloseTo(remaining - 1.6);
    expect(response.headers.get('X-Five-Min-Limit-Resets-In')).toBe('300');
    expect(await response.json()).toMatchObject({
      success: true,
      type: 'property',
      count: 3,
      pages: { nextPageExists: false, nextPageLink: null },
    });
  });

  it('holds three properties with two rooms, one and one', async () => {
    const { data } = await (await get(everything)).json();
    expect(data.map((property: { roomTypes: unknown[] }) => property.roomTypes.length)).toEqual([
      2, 1, 1,
    ]);
    interface Limits {
      maxPeople: number;
      maxAdult: number | null;
      maxChildren: number | null;
    }
    // Zirbe asks for no children ("None"), Ahorn any six with up to five children, Fichte does
    // not ask.
    expect(
      data.flatMap((property: { roomTypes: Limits[] }) =>
        property.roomTypes.map(({ maxPeople, maxAdult, maxChildren }) => [
          maxPeople,
          maxAdult,
          maxChildren,
        ]),
      ),
    ).toEqual([
      [2, null, 0],
      [4, null, 3],
      [6, null, 5],
      [2, null, null],
    ]);
  });

  it('keeps the oddities of the wire', async () => {
    const [property, farn, moos] = (await (await get(everything)).json()).data;
    expect(property.bookingPageMultiplier).toBe('*0.9');
    expect(property.texts.map((text: { language: string }) => text.language)).toEqual(['de', 'en']);
    expect(property.texts[1].upsellItemName1).toBe('Local tax');
    expect(property.texts[1].upsellItemName2).toBe('');
    expect(property.texts[1].houseRules).toContain('\r\n');
    expect(property.texts[1].directions).toBe('');
    expect(property.upsellItems).toHaveLength(20);
    expect(property.upsellItems[0]).toMatchObject({
      type: 'obligatory',
      per: 'adult',
      period: 'daily',
    });
    expect(property.upsellItems[1].type).toBe('notUsed');
    for (const text of property.texts)
      expect(Object.keys(text).sort()).toEqual(
        [
          'language',
          'headline',
          'propertyDescription',
          'locationDescription',
          'directions',
          'houseRules',
          'generalPolicy',
          'cancellationPolicy',
          'propertyDescription1',
          'propertyDescription2',
          'propertyDescriptionBookingPage1',
          'propertyDescriptionBookingPage2',
          'guestDetailsHeader',
          'guestEnquiryHeader',
          'confirmBookingButtonMessage',
          'roomNotAvailableMessage',
          'roomNoPriceMessage',
          'noRoomsAvailableMessage',
          ...Array.from({ length: 10 }, (_, i) => `customQuestion${i + 1}`),
          ...Array.from({ length: 20 }, (_, i) => `upsellItemName${i + 1}`),
        ].sort(),
      );
    const [room, second] = property.roomTypes;
    expect(room.texts.map((text: { language: string }) => text.language)).toEqual([
      'de',
      'en',
      'it',
    ]);
    for (const text of room.texts)
      expect(Object.keys(text).sort()).toEqual(
        [
          'language',
          'displayName',
          'accommodationType',
          'roomDescription',
          'auxiliary',
          'marketing',
          'contentHeadline',
          'contentDescription',
        ].sort(),
      );
    expect(room.texts[2]).toMatchObject({ roomDescription: '', accommodationType: 'Camera' });
    expect(room.texts[1]).toMatchObject({ contentDescription: '', displayName: '' });
    expect(room.texts[1].roomDescription).toMatch(/^<p><h3 class="">.*<\/p><\/p>/);
    expect(room.texts[1].roomDescription).toContain('\ufeff');
    expect(second.texts[0].roomDescription).toContain('<b>');
    expect(farn.roomTypes[0].featureCodes).toContainEqual(['BOOT_DRYER']);
    expect(moos.roomTypes[0].texts[1].roomDescription).toBe('<p><br></p>');
    const rules = property.roomTypes[0].priceRules;
    expect(rules).toHaveLength(16);
    expect(rules[0].minDaysUntilCheckin).toBe(7);
    expect(rules[1]).toEqual({ id: 2 });
  });

  it('lists every booking question, the unused ones without their order', async () => {
    const [firn, farn, moos] = (await (await get(everything)).json()).data;
    expect(Object.keys(firn.bookingQuestions)).toHaveLength(26);
    expect(firn.bookingQuestions.guestFirstName).toEqual({ usage: 'compulsory', order: 1 });
    expect(firn.bookingQuestions.guestFax).toEqual({ usage: 'notUsed', order: null });
    expect(firn.bookingQuestions.customQuestion7).toEqual({
      usage: 'compulsoryBookingPage',
      order: 18,
      type: 'tickBox',
    });
    expect(firn.bookingQuestions.customQuestion9).toEqual({
      usage: 'notUsed',
      order: null,
      type: 'singleLineField',
    });
    expect(firn.texts[1].customQuestion1).toBe('Arriving by [Car][Train][Plane]');
    // Haus Farn's breakfast question has no English text; Haus Moos takes requests only.
    expect(farn.texts[1].customQuestion2).toBe('');
    expect(firn.bookingRules.bookingType).toBe('confirmedWithDepositCollection1');
    expect(firn.paymentCollection.depositPayment1.variableAmount.percentageValue).toBe(100);
    expect(moos.bookingRules.bookingType).toBe('requestWithManualConfirmation');
  });

  it('leaves out what was not asked for and filters by id', async () => {
    const { data } = await (await get('properties?id=900102')).json();
    expect(data).toHaveLength(1);
    expect(data[0]).not.toHaveProperty('roomTypes');
    expect(data[0]).not.toHaveProperty('texts');
    expect(data[0]).not.toHaveProperty('upsellItems');
  });
});

describe('calendar', () => {
  const all =
    '&includeNumAvail=true&includeMinStay=true&includeMaxStay=true&includeMultiplier=true&includeOverride=true&includePrices=true';
  const day = 86_400_000;
  const weeksOf = async (roomId: number) => {
    const dates = 'startDate=2026-11-14&endDate=2027-11-13';
    const path = `inventory/rooms/calendar?roomId=${roomId}&${dates}${all}`;
    const [{ calendar }] = (await (await get(path)).json()).data as [{ calendar: Range[] }];
    const days = calendar.flatMap((range) =>
      Array.from(
        { length: (Date.parse(range.to) - Date.parse(range.from)) / day + 1 },
        () => range,
      ),
    );
    return Array.from({ length: 52 }, (_, week) => {
      const nights = days.slice(week * 7, week * 7 + 7);
      const free = nights.filter((night) => night.numAvail === 1).length;
      const prices = new Set(nights.map((night) => night.price1));
      return {
        month: new Date(Date.parse('2026-11-14') + week * 7 * day).getUTCMonth() + 1,
        booked: free === 0,
        partly: free > 0 && free < 7,
        priced: !prices.has(undefined),
        unequal: prices.size > 1 && !prices.has(undefined),
        // The bookable-week rules of docs/beds24-findings.md, without the lead time.
        bookable:
          free === 7 &&
          !prices.has(undefined) &&
          nights[0].override === 'none' &&
          days[week * 7 + 7].override === 'none',
      };
    });
  };

  it('answers per room in compressed ranges', async () => {
    const response = await get(
      `inventory/rooms/calendar?propertyId=900101&startDate=2026-12-05&endDate=2026-12-18${all}`,
    );
    expect(response.headers.get('X-Request-Cost')).toBe('1');
    const body = await response.json();
    expect(body).toMatchObject({ success: true, type: 'calendar', count: 2 });
    expect(body.data[1]).toMatchObject({ roomId: 9001012, propertyId: 900101, name: 'Lärche' });
    expect(body.data[0].calendar).toEqual([
      {
        from: '2026-12-05',
        to: '2026-12-05',
        numAvail: 0,
        minStay: 7,
        maxStay: 7,
        override: 'none',
        multiplier: 1,
        price1: 185,
      },
      {
        from: '2026-12-06',
        to: '2026-12-11',
        numAvail: 0,
        minStay: 7,
        maxStay: 7,
        override: 'noCheckInOrCheckOut',
        multiplier: 1,
        price1: 185,
      },
      {
        from: '2026-12-12',
        to: '2026-12-12',
        numAvail: 0,
        minStay: 7,
        maxStay: 7,
        override: 'none',
        multiplier: 1,
        price1: 185,
      },
      {
        from: '2026-12-13',
        to: '2026-12-18',
        numAvail: 0,
        minStay: 7,
        maxStay: 7,
        override: 'noCheckInOrCheckOut',
        multiplier: 1,
        price1: 185,
      },
    ]);
  });

  it('returns no days unless an include parameter is passed, and needs both dates', async () => {
    const bare = await get('inventory/rooms/calendar?startDate=2026-12-05&endDate=2026-12-18');
    const calendars = (await bare.json()).data.map((room: { calendar: Range[] }) => room.calendar);
    expect(calendars).toEqual([[], [], [], []]);
    expect((await get('inventory/rooms/calendar?startDate=2026-12-05')).status).toBe(400);
  });

  it('skips the days that carry none of the fields asked for', async () => {
    const path =
      'inventory/rooms/calendar?roomId=9001012&startDate=2026-11-14&endDate=2026-12-18&includePrices=true';
    const [{ calendar }] = (await (await get(path)).json()).data;
    expect(calendar).toEqual([{ from: '2026-12-05', to: '2026-12-18', price1: 265 }]);
  });

  it('holds every state the site has to handle', async () => {
    const weeks = await weeksOf(9001012);
    for (const state of ['bookable', 'booked', 'partly', 'unequal'] as const)
      expect(weeks.some((week) => week[state])).toBe(true);
    expect(weeks.filter((week) => !week.priced).map((week) => week.month)).toEqual(
      expect.arrayContaining([11, 4, 5, 10]),
    );
    expect(weeks.some((week) => week.bookable && !week.priced)).toBe(false);
  });

  it('books the smallest apartment out for the winter and not for the summer', async () => {
    const weeks = await weeksOf(9001011);
    const winter = weeks.filter((week) => week.month === 12 || week.month <= 3);
    expect(winter.every((week) => week.booked)).toBe(true);
    expect(weeks.some((week) => week.bookable && week.month >= 6 && week.month <= 9)).toBe(true);
  });
});

describe('bookings', () => {
  const refusal = {
    success: false,
    errors: [{ action: 'new booking', field: 'no availability', message: 'invalid' }],
  };

  it('saves a booking that holds its week, and refuses the week again', async () => {
    const stay = await freeWeek();
    const asked = { ...stay, status: 'new', actions: { checkAvailability: true } };
    const [created] = await post([asked]);
    expect(created).toMatchObject({
      success: true,
      new: { id: expect.any(Number), status: 'new' },
    });
    expect(await nights(stay.arrival)).toBe(0);
    expect(await post([asked])).toEqual([refusal]);
    // Without the check, Beds24 saves an overlap silently.
    expect(await post([{ ...stay, status: 'new' }])).toMatchObject([{ success: true }]);
  });

  it('refuses a week its own calendar has taken', async () => {
    const stay = { roomId: 9001011, arrival: '2026-12-05', departure: '2026-12-12' };
    expect(await post([{ ...stay, actions: { checkAvailability: true } }])).toEqual([refusal]);
  });

  it('records a payment and a confirmation, and frees the week when cancelled', async () => {
    const stay = await freeWeek();
    const [{ new: created }] = await post([
      { ...stay, status: 'new', price: 980, firstName: 'Anna', email: 'anna@example.com' },
    ]);
    const payment = { type: 'payment', description: 'Paid by card', qty: 1, amount: 980 };
    expect(
      await post([
        {
          id: created.id,
          status: 'confirmed',
          invoiceItems: [payment],
          infoItems: [{ code: 'STRIPE_PAYMENT', text: 'pi_1' }],
        },
      ]),
    ).toEqual([{ success: true, modified: { id: created.id } }]);
    await post([{ id: created.id, actions: { notifyGuest: true } }]);
    // The guest's details are not kept.
    expect(server.bookings.get(created.id)).toEqual({
      ...stay,
      status: 'confirmed',
      price: 980,
      invoiceItems: [payment],
      infoItems: [{ code: 'STRIPE_PAYMENT', text: 'pi_1' }],
      notified: 1,
    });
    expect(await nights(stay.arrival)).toBe(0);
    await post([{ id: created.id, status: 'cancelled' }]);
    expect(await nights(stay.arrival)).toBe(1);
  });

  it('answers 400 to a body that is not a list of bookings, and keeps running', async () => {
    const response = await fetch(at('bookings'), {
      method: 'POST',
      headers: { token: access },
      body: '[{"roomId": 9001012',
    });
    expect(response.status).toBe(400);
    expect((await get('properties')).status).toBe(200);
  });

  it('keeps a character that arrives split between two chunks', async () => {
    const stay = await freeWeek();
    const bytes = Buffer.from(
      JSON.stringify([
        {
          ...stay,
          invoiceItems: [{ type: 'charge', description: 'Kurtaxe für Gäste', qty: 1, amount: 5 }],
        },
      ]),
    );
    const split = bytes.indexOf(Buffer.from('ä')) + 1;
    const answer = await new Promise<string>((resolve) => {
      const sent = request(
        at('bookings'),
        { method: 'POST', headers: { token: access } },
        (response) => {
          let text = '';
          response.on('data', (chunk) => (text += chunk)).on('end', () => resolve(text));
        },
      );
      sent.write(bytes.subarray(0, split));
      setTimeout(() => sent.end(bytes.subarray(split)), 20);
    });
    const [{ new: created }] = JSON.parse(answer);
    expect(server.bookings.get(created.id)?.invoiceItems[0].description).toBe('Kurtaxe für Gäste');
  });

  it('refuses a change to a booking it does not have', async () => {
    expect(await post([{ id: 1, status: 'cancelled' }])).toEqual([
      { success: false, errors: [{ action: 'modify booking', message: 'access denied' }] },
    ]);
  });
});

describe('offers', () => {
  interface Stay {
    roomId: number;
    arrival: string;
    departure: string;
  }
  const ask = ({ roomId, arrival, departure }: Stay, adults = 2, children = 0) =>
    `inventory/rooms/offers?roomId=${roomId}&arrival=${arrival}&departure=${departure}` +
    `&numAdults=${adults}&numChildren=${children}`;
  const offers = async (stay: Stay, adults?: number, children?: number) => {
    const { data } = await (await get(ask(stay, adults, children))).json();
    return data[0].offers?.[0]?.price as number | undefined;
  };

  it('offers a free week at the sum of its nights times the multiplier', async () => {
    const stay = await freeWeek();
    const response = await get(
      `inventory/rooms/offers?arrival=${stay.arrival}&departure=${stay.departure}&numAdults=2`,
    );
    expect(response.headers.get('X-Request-Cost')).toBe('1');
    const body = await response.json();
    expect(body).toMatchObject({ success: true, type: 'offer', count: 4 });
    const days = await ranges(stay.arrival, addDays(stay.departure, -1), 'includePrices=true');
    const sum = days.reduce(
      (total, { from, to, price1 = 0 }) =>
        total + price1 * ((Date.parse(to) - Date.parse(from)) / 864e5 + 1),
      0,
    );
    expect(body.data.find(({ roomId }: { roomId: number }) => roomId === room)).toEqual({
      roomId: room,
      propertyId: 900101,
      offers: [{ offerId: 1, offerName: '', price: Math.round(sum * 90) / 100, unitsAvailable: 1 }],
    });
  });

  it('offers no week that is held, and the week again once it is cancelled', async () => {
    const stay = await freeWeek();
    const [{ new: created }] = await post([{ ...stay, status: 'new' }]);
    expect(await offers(stay)).toBeUndefined();
    await post([{ id: created.id, status: 'cancelled' }]);
    expect(await offers(stay)).toBeGreaterThan(0);
  });

  it('offers no week its own calendar has taken, and no stay that is not one week', async () => {
    expect(
      await offers({ roomId: 9001011, arrival: '2026-12-05', departure: '2026-12-12' }),
    ).toBeUndefined();
    const stay = await freeWeek();
    expect(await offers({ ...stay, departure: addDays(stay.arrival, 4) })).toBeUndefined();
    expect(await offers({ ...stay, departure: addDays(stay.arrival, 14) })).toBeUndefined();
    const monday = addDays(stay.arrival, 2);
    expect(await offers({ ...stay, arrival: monday, departure: addDays(monday, 7) })).toBe(
      undefined,
    );
  });

  // On a simulator of its own, as the clock it moves also moves the budget's window.
  it('offers a week exactly at the lead time and none a day sooner', async () => {
    const stay = await freeWeek();
    vi.useFakeTimers({ toFake: ['Date'] });
    const own = sim().listen(0);
    const url = `http://localhost:${(own.address() as AddressInfo).port}/v2`;
    const price = async () => {
      const refreshed = await fetch(`${url}/authentication/token`, {
        headers: { refreshToken: 'simulator' },
      });
      const { token } = await refreshed.json();
      const { data } = await (await fetch(`${url}/${ask(stay)}`, { headers: { token } })).json();
      return data[0].offers?.[0]?.price;
    };
    vi.setSystemTime(`${addDays(stay.arrival, -7)}T20:00:00Z`);
    expect(await price()).toBeGreaterThan(0);
    vi.setSystemTime(`${addDays(stay.arrival, -6)}T08:00:00Z`);
    expect(await price()).toBeUndefined();
    own.close();
    vi.useRealTimers();
  });

  it('keeps to the guest limits, at one price whatever the mix', async () => {
    const stay = await freeWeek();
    const price = await offers(stay, 4);
    expect(price).toBeGreaterThan(0);
    expect(await offers(stay, 1, 3)).toBe(price);
    expect(await offers(stay, 0, 1)).toBe(price);
    expect(await offers(stay, 5)).toBeUndefined();
    expect(await offers(stay, 0, 4)).toBeUndefined();
  });

  it('needs both dates', async () => {
    const response = await get('inventory/rooms/offers?arrival=2027-06-05');
    expect(response.status).toBe(400);
    expect((await response.json()).error).toBe('arrival and departure are required');
  });
});

describe('Stripe Checkout', () => {
  const origin = () => `http://localhost:${(server.address() as AddressInfo).port}`;
  const stripe = (path = '', form?: Record<string, string | number>, key = 'simulator') =>
    fetch(`${origin()}/v1/checkout/sessions${path}`, {
      method: form ? 'POST' : 'GET',
      headers: { Authorization: `Bearer ${key}` },
      body: form && new URLSearchParams(Object.entries(form).map(([k, v]) => [k, String(v)])),
    });
  const order = (fields: Record<string, string | number> = {}) => ({
    mode: 'payment',
    'line_items[0][quantity]': 1,
    'line_items[0][price_data][currency]': 'eur',
    'line_items[0][price_data][unit_amount]': 98_315,
    'line_items[0][price_data][product_data][name]': 'Lärche, 5 to 12 June 2027',
    client_reference_id: '70000001',
    'metadata[booking]': '70000001',
    customer_email: 'anna@example.com',
    'payment_method_types[0]': 'card',
    locale: 'de',
    success_url: 'https://demo.example/de/booked?session={CHECKOUT_SESSION_ID}',
    cancel_url: 'https://demo.example/de/book',
    ...fields,
  });
  const open = async (fields?: Record<string, string | number>) =>
    (await (await stripe('', order(fields))).json()) as { id: string; url: string };
  const press = (id: string, action: string) =>
    fetch(`${origin()}/simulated-checkout/${id}`, {
      method: 'POST',
      body: new URLSearchParams({ action }),
      redirect: 'manual',
    });
  const read = async (id: string) => (await stripe(`/${id}`)).json();

  it('creates an open session with its total and page, without the guest e-mail', async () => {
    const created = await (await stripe('', order())).json();
    expect(created).toMatchObject({
      object: 'checkout.session',
      status: 'open',
      payment_status: 'unpaid',
      amount_total: 98_315,
      currency: 'eur',
      client_reference_id: '70000001',
      metadata: { booking: '70000001' },
      payment_intent: null,
      url: `https://demo.example/simulated-checkout/${created.id}`,
    });
    expect(created.id).toMatch(/^cs_test_/);
    expect(created.expires_at - created.created).toBe(86_400);
    expect(JSON.stringify(created)).not.toContain('anna');
    expect(await read(created.id)).toEqual(created);
  });

  it('refuses a wrong key, a missing parameter and an unknown session', async () => {
    const wrong = await stripe('', order(), 'sk_test_other');
    expect(wrong.status).toBe(401);
    expect((await wrong.json()).error.type).toBe('invalid_request_error');
    const { success_url, ...missing } = order();
    expect(success_url).toBeTruthy();
    const refused = await stripe('', missing);
    expect(refused.status).toBe(400);
    expect((await refused.json()).error.param).toBe('success_url');
    expect((await stripe('/cs_test_none')).status).toBe(404);
  });

  it('keeps a crafted field name off every object, and refuses a value that is also a hash', async () => {
    const { id } = await open();
    await stripe(`/${id}`, { '__proto__[paid]': 'yes', 'metadata[__proto__][paid]': 'yes' });
    expect(({} as Record<string, unknown>)['paid']).toBeUndefined();
    const mixed = await stripe('', { ...order(), metadata: 'x' });
    expect(mixed.status).toBe(400);
    expect((await stripe('')).status).toBe(200);
  });

  it('pays on the page and redirects to the success address with the session', async () => {
    const { id } = await open();
    const page = await fetch(`${origin()}/simulated-checkout/${id}`);
    const html = await page.text();
    expect(html).toContain('<html lang="de">');
    expect(html).toContain('Simulierte Zahlung');
    expect(html).toContain('983,15');
    const paid = await press(id, 'pay');
    expect(paid.status).toBe(303);
    expect(paid.headers.get('Location')).toBe(`https://demo.example/de/booked?session=${id}`);
    expect(await read(id)).toMatchObject({
      status: 'complete',
      payment_status: 'paid',
      payment_intent: expect.stringMatching(/^pi_/),
      url: null,
    });
    expect((await press(id, 'pay')).status).toBe(200);
  });

  it('cancels back to the cancel address and leaves the session open', async () => {
    const { id } = await open();
    const cancelled = await press(id, 'cancel');
    expect(cancelled.headers.get('Location')).toBe('https://demo.example/de/book');
    expect((await read(id)).status).toBe('open');
  });

  it('lets a session expire on the page, and at its expiry time', async () => {
    const { id } = await open({ locale: 'en' });
    const expired = await press(id, 'expire');
    expect(expired.status).toBe(303);
    expect(expired.headers.get('Location')).toBe(`/simulated-checkout/${id}`);
    expect(await read(id)).toMatchObject({ status: 'expired', payment_status: 'unpaid' });
    const page = await (await fetch(`${origin()}/simulated-checkout/${id}`)).text();
    expect(page).toContain('This payment has expired.');
    expect(page).not.toContain('<button');
    const past = await open({ expires_at: Math.floor(Date.now() / 1000) - 1 });
    expect((await read(past.id)).status).toBe('expired');
  });

  it('merges metadata into a session, an empty value removing its key', async () => {
    const { id } = await open();
    await stripe(`/${id}`, { 'metadata[recorded]': 'yes' });
    expect((await read(id)).metadata).toEqual({ booking: '70000001', recorded: 'yes' });
    await stripe(`/${id}`, { 'metadata[recorded]': '' });
    expect((await read(id)).metadata).toEqual({ booking: '70000001' });
  });

  it('lists sessions newest first, by status and creation time, in pages', async () => {
    const first = await open();
    const second = await open();
    await press(second.id, 'expire');
    const list = async (query: string) =>
      (await (await stripe(`?${query}`)).json()) as {
        data: { id: string }[];
        has_more: boolean;
      };
    const page = await list('limit=1');
    expect(page).toMatchObject({ data: [{ id: second.id }], has_more: true });
    expect((await list(`limit=1&starting_after=${second.id}`)).data[0].id).toBe(first.id);
    const expired = await list('status=expired&limit=100');
    expect(expired.data.map(({ id }) => id)).toContain(second.id);
    expect(expired.data.map(({ id }) => id)).not.toContain(first.id);
    const later = Math.floor(Date.now() / 1000) + 60;
    expect((await list(`created[gte]=${later}`)).data).toEqual([]);
  });

  it('answers 404 for a page it has no session for', async () => {
    const response = await fetch(`${origin()}/simulated-checkout/cs_test_none`);
    expect(response.status).toBe(404);
    expect(await response.text()).toContain('There is no such payment.');
  });
});
