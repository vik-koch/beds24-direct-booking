import type { Day, Inventory, Room } from './client';
import { freeWeeks, offeredWeeks, type Period } from './weeks';

const room = (overrides: Partial<Room> = {}): Room => ({
  id: 11,
  propertyId: 1,
  maxPeople: 4,
  asksChildren: false,
  size: 61,
  bedrooms: 2,
  currency: 'EUR',
  leadDays: 0,
  multiplier: 1,
  tax: { amount: 3.5, per: 'night' },
  address: '',
  checkIn: { from: null, until: null },
  checkOut: null,
  features: [],
  texts: {},
  headlines: { de: 'Für vier', en: 'For four' },
  ...overrides,
});

// Saturday 2027-01-02 to Saturday 2027-01-30: four weeks, changeovers on Saturdays only.
const calendar = (change: (day: Day, index: number) => Partial<Day> = () => ({})): Day[] =>
  Array.from({ length: 29 }, (_, i) => {
    const date = new Date(Date.UTC(2027, 0, 2 + i)).toISOString().slice(0, 10);
    const day: Day = { date, free: true, price: 100, changeover: i % 7 === 0 };
    return { ...day, ...change(day, i) };
  });

describe('offeredWeeks', () => {
  it('offers Saturday to Saturday weeks at the sum of their nights', () => {
    expect(offeredWeeks(room(), calendar(), '2027-01-01')).toEqual([
      { arrival: '2027-01-02', departure: '2027-01-09', price: 700 },
      { arrival: '2027-01-09', departure: '2027-01-16', price: 700 },
      { arrival: '2027-01-16', departure: '2027-01-23', price: 700 },
      { arrival: '2027-01-23', departure: '2027-01-30', price: 700 },
    ]);
  });

  it('needs a changeover on the first and the last day', () => {
    const closed = calendar((_, i) => (i === 7 ? { changeover: false } : {}));
    expect(offeredWeeks(room(), closed, '2027-01-01').map((week) => week.arrival)).toEqual([
      '2027-01-16',
      '2027-01-23',
    ]);
  });

  it('leaves out a week with an unpriced night', () => {
    const unpriced = calendar((_, i) => (i === 10 ? { price: null } : {}));
    expect(offeredWeeks(room(), unpriced, '2027-01-01').map((week) => week.arrival)).toEqual([
      '2027-01-02',
      '2027-01-16',
      '2027-01-23',
    ]);
  });

  it('shows a week with a taken night as taken', () => {
    const taken = calendar((_, i) => (i === 17 ? { free: false } : {}));
    expect(offeredWeeks(room(), taken, '2027-01-01')[2]).toEqual({
      arrival: '2027-01-16',
      departure: '2027-01-23',
      price: null,
    });
  });

  it('starts no sooner than the earliest arrival, which may be the arrival day itself', () => {
    expect(offeredWeeks(room(), calendar(), '2027-01-09')[0].arrival).toBe('2027-01-09');
    expect(offeredWeeks(room(), calendar(), '2027-01-10')[0].arrival).toBe('2027-01-16');
  });

  it('applies the multiplier without rounding beyond the cent', () => {
    const odd = calendar(() => ({ price: 150.5 }));
    expect(offeredWeeks(room({ multiplier: 0.9 }), odd, '2027-01-01')[0].price).toBe(948.15);
  });

  it('adds unequal nights, as where a price period ends on the arrival day', () => {
    const change = calendar((day, i) => ({ price: i === 7 ? 100 : i > 7 ? 120 : day.price }));
    expect(offeredWeeks(room(), change, '2027-01-01')[1].price).toBe(100 + 6 * 120);
  });

  it('offers nothing when the multiplier cannot be read', () => {
    expect(offeredWeeks(room({ multiplier: null }), calendar(), '2027-01-01')).toEqual([]);
  });
});

describe('freeWeeks', () => {
  const apartments = [
    { slug: 'two', roomId: 12, name: 'Two' },
    { slug: 'one', roomId: 11, name: 'One' },
  ];
  const inventory = (days: Day[] = calendar(), other: Partial<Room> = {}): Inventory => ({
    rooms: [room(), room({ id: 12, maxPeople: 2, size: 34, ...other })],
    days: { 11: days, 12: calendar((_, i) => (i === 3 ? { free: false } : {})) },
  });
  const january: Period = {
    name: 'winter',
    years: '2026/27',
    start: '2026-09-01',
    end: '2027-01-15',
  };
  const summer: Period = { name: 'summer', years: '2027', start: '2027-01-16', end: '2027-08-31' };

  it('takes a room’s changeover weekdays from its rule, not from an unpriced stretch', () => {
    // Two more weeks after the four, unpriced and open on every day, as Beds24 returns them.
    const days = [
      ...calendar(),
      ...Array.from({ length: 14 }, (_, i): Day => ({
        date: new Date(Date.UTC(2027, 0, 31 + i)).toISOString().slice(0, 10),
        free: false,
        price: null,
        changeover: true,
      })),
    ];
    const list = freeWeeks(inventory(days), apartments, [january, summer], '2026-12-01', ['de']);
    expect(list.apartments.map(({ changeover }) => changeover)).toEqual([[6], [6]]);
    // Unpriced on every day: only the closed days show the rule.
    const unpriced = calendar(() => ({ price: null }));
    const bare = freeWeeks(inventory(unpriced), apartments, [january, summer], '2026-12-01', [
      'de',
    ]);
    expect(bare.apartments[1].changeover).toEqual([6]);
  });

  it('puts the apartments in the content order and the week into the season of its arrival', () => {
    const list = freeWeeks(inventory(), apartments, [january, summer], '2026-12-01', ['de', 'fr']);
    expect(list.apartments).toEqual([
      {
        slug: 'two',
        name: 'Two',
        guests: 2,
        size: 34,
        bedrooms: 2,
        tax: { amount: 3.5, per: 'night' },
        headline: { de: 'Für vier', fr: '' },
        changeover: [6],
      },
      {
        slug: 'one',
        name: 'One',
        guests: 4,
        size: 61,
        bedrooms: 2,
        tax: { amount: 3.5, per: 'night' },
        headline: { de: 'Für vier', fr: '' },
        changeover: [6],
      },
    ]);
    expect(list.seasons[0]).toEqual({
      name: 'winter',
      years: '2026/27',
      start: '2026-09-01',
      end: '2027-01-15',
      state: 'open',
      states: ['open', 'open'],
      weeks: [
        { arrival: '2027-01-02', departure: '2027-01-09', prices: [null, 700] },
        { arrival: '2027-01-09', departure: '2027-01-16', prices: [700, 700] },
      ],
    });
    expect(list.seasons[1].weeks.map((week) => week.arrival)).toEqual(['2027-01-16', '2027-01-23']);
    expect(list.tax).toEqual({ amount: 3.5, per: 'night' });
  });

  it('keeps every apartment’s capacity where the weeks are of one apartment alone', () => {
    const list = freeWeeks(inventory(), apartments, [january], '2026-12-01', ['de'], 'one');
    expect(list.apartments.map(({ slug }) => slug)).toEqual(['one']);
    expect(list.seasons[0].weeks.map(({ prices }) => prices)).toEqual([[700], [700]]);
    expect(list.capacities).toEqual({
      two: { maxPeople: 2, asksChildren: false },
      one: { maxPeople: 4, asksChildren: false },
    });
  });

  it('counts the lead time from today', () => {
    const list = freeWeeks(inventory(), apartments, [january], '2027-01-01', ['de']);
    expect(list.seasons[0].weeks).toHaveLength(2);
    const later = inventory();
    later.rooms.forEach((one) => (one.leadDays = 7));
    expect(
      freeWeeks(later, apartments, [january], '2027-01-01', ['de']).seasons[0].weeks,
    ).toHaveLength(1);
  });

  it('tells a season not open yet from one that is full or has begun', () => {
    const none = inventory(
      calendar(() => ({ price: null })),
      {},
    );
    none.days[12] = calendar(() => ({ price: null }));
    expect(freeWeeks(none, apartments, [summer], '2026-12-01', ['de']).seasons[0].state).toBe(
      'notOpen',
    );
    expect(freeWeeks(none, apartments, [summer], '2027-01-20', ['de']).seasons[0].state).toBe(
      'full',
    );
    const taken = inventory(calendar(() => ({ free: false })));
    taken.days[12] = calendar(() => ({ free: false }));
    expect(freeWeeks(taken, apartments, [summer], '2026-12-01', ['de']).seasons[0]).toMatchObject({
      state: 'full',
      weeks: [],
    });
  });

  it("tells each apartment's state apart from the season's", () => {
    const unpriced = inventory(calendar(() => ({ price: null })));
    const ahead = freeWeeks(unpriced, apartments, [summer], '2026-12-01', ['de']).seasons[0];
    expect(ahead).toMatchObject({ state: 'open', states: ['open', 'notOpen'] });
    const begun = freeWeeks(unpriced, apartments, [summer], '2027-01-20', ['de']).seasons[0];
    expect(begun).toMatchObject({ state: 'open', states: ['open', 'full'] });
  });

  it('shows the tax only when every apartment has the same', () => {
    const list = freeWeeks(
      inventory(calendar(), { tax: null }),
      apartments,
      [january],
      '2026-12-01',
      ['de'],
    );
    expect(list.tax).toBeNull();
  });

  it('leaves out an apartment Beds24 does not know, and fails without any', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const unknown = [...apartments, { slug: 'three', roomId: 99, name: 'Three' }];
    expect(
      freeWeeks(inventory(), unknown, [january], '2026-12-01', ['de']).apartments,
    ).toHaveLength(2);
    expect(() => freeWeeks(inventory(), [unknown[2]], [january], '2026-12-01', ['de'])).toThrow(
      'none of the rooms',
    );
  });
});
