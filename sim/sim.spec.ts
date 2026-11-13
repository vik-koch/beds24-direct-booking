import type { AddressInfo } from 'node:net';
import { sim } from './server.ts';

interface Range {
  from: string;
  to: string;
  numAvail: number;
  override: string;
  price1?: number;
}

const server = sim().listen(0);
const get = (path: string, token = 'simulator') =>
  fetch(`http://localhost:${(server.address() as AddressInfo).port}/v2/${path}`, {
    headers: { token },
  });
afterAll(() => server.close());

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
    expect(response.headers.get('X-Five-Min-Limit-Remaining')).toBe('98.4');
    expect(response.headers.get('X-Five-Min-Limit-Resets-In')).toBe('300');
    expect(await response.json()).toMatchObject({
      success: true,
      type: 'property',
      count: 2,
      pages: { nextPageExists: false, nextPageLink: null },
    });
  });

  it('holds one property with two rooms and one with a single room', async () => {
    const { data } = await (await get(everything)).json();
    expect(data.map((property: { roomTypes: unknown[] }) => property.roomTypes.length)).toEqual([
      2, 1,
    ]);
    expect(
      data.flatMap((property: { roomTypes: { maxPeople: number }[] }) =>
        property.roomTypes.map((room) => room.maxPeople),
      ),
    ).toEqual([2, 4, 6]);
  });

  it('keeps the oddities of the wire', async () => {
    const [property] = (await (await get(everything)).json()).data;
    expect(property.bookingPageMultiplier).toBe('*0.9');
    expect(property.texts.map((text: { language: string }) => text.language)).toEqual(['de', 'en']);
    expect(property.texts[1].upsellItemName1).toBe('Local tax');
    expect(property.texts[1].upsellItemName2).toBe('');
    expect(property.texts[1].houseRules).toContain('\r\n');
    expect(property.upsellItems).toHaveLength(20);
    expect(property.upsellItems[0]).toMatchObject({
      type: 'obligatory',
      per: 'adult',
      period: 'daily',
    });
    expect(property.upsellItems[1].type).toBe('notUsed');
    const rules = property.roomTypes[0].priceRules;
    expect(rules).toHaveLength(16);
    expect(rules[0].minDaysUntilCheckin).toBe(7);
    expect(rules[1]).toEqual({ id: 2 });
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
    const path = `inventory/rooms/calendar?roomId=${roomId}&startDate=2026-11-14&endDate=2027-11-13${all}`;
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
    expect((await bare.json()).data.map((room: { calendar: Range[] }) => room.calendar)).toEqual([
      [],
      [],
      [],
    ]);
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
