import { dayOf, seasonScript, seasonState, type Starts } from './season';

describe('seasonState', () => {
  const demo: Starts = { winter: '09-01', summer: '04-01' };
  const on = (year: number, month: number, date: number) => new Date(year, month - 1, date, 12);
  const state = (now: Date, wanted: string | null = null, stored: string | null = null) =>
    seasonState(demo, wanted, stored, now);
  const stored = (season: string, day: string) => JSON.stringify({ season, on: day });

  it('follows the date on both boundary days', () => {
    expect(state(on(2026, 8, 31)).season).toBe('summer');
    expect(state(on(2026, 9, 1)).season).toBe('winter');
    expect(state(on(2027, 3, 31)).season).toBe('winter');
    expect(state(on(2027, 4, 1)).season).toBe('summer');
  });

  it('keeps a winter across the turn of the year', () => {
    expect(state(on(2026, 12, 31)).shown[0].id).toBe('winter-2026');
    expect(state(on(2027, 1, 1)).shown[0].id).toBe('winter-2026');
  });

  it('puts 29 February into the season that started before it', () => {
    expect(state(on(2028, 2, 29)).shown[0]).toEqual({
      name: 'winter',
      id: 'winter-2027',
      start: '2027-09-01',
      end: '2028-03-31',
      years: '2027/28',
    });
    // A season that starts on 1 March ends on 28 or 29 February.
    const march: Starts = { winter: '10-01', summer: '03-01' };
    expect(seasonState(march, null, null, on(2028, 2, 29)).shown[0].end).toBe('2028-02-29');
    expect(seasonState(march, null, null, on(2027, 2, 28)).shown[0].end).toBe('2027-02-28');
  });

  it('shows the current season and the next one, with their dated names', () => {
    expect(state(on(2026, 11, 16)).shown.map(({ id, years }) => [id, years])).toEqual([
      ['winter-2026', '2026/27'],
      ['summer-2027', '2027'],
    ]);
    expect(state(on(2027, 5, 1)).shown.map(({ id }) => id)).toEqual(['summer-2027', 'winter-2027']);
  });

  it('lets a link win over a stored choice, and a stored choice over the date', () => {
    const summer = stored('summer-2027', '2026-11-10');
    expect(state(on(2026, 11, 16), null, summer).season).toBe('summer');
    expect(state(on(2026, 11, 16), 'winter', summer).season).toBe('winter');
    expect(state(on(2026, 11, 16), 'autumn').season).toBe('winter');
  });

  it('drops a stored choice after 30 days', () => {
    const summer = stored('summer-2027', '2026-11-01');
    expect(state(on(2026, 12, 1), null, summer)).toMatchObject({ season: 'summer', drop: false });
    expect(state(on(2026, 12, 2), null, summer)).toMatchObject({ season: 'winter', drop: true });
  });

  it('drops a stored choice whose season is no longer shown', () => {
    // Chosen at the end of a summer; a month later that summer is over.
    const summer = stored('summer-2026', '2026-08-20');
    expect(state(on(2026, 8, 31), null, summer).season).toBe('summer');
    expect(state(on(2026, 9, 1), null, summer)).toMatchObject({ season: 'winter', drop: true });
  });

  it('drops what it cannot read', () => {
    expect(state(on(2026, 11, 16), null, 'summer')).toMatchObject({ season: 'winter', drop: true });
    expect(state(on(2026, 11, 16), null, stored('summer-2027', 'soon')).drop).toBe(true);
  });

  it('has nothing to choose with a single season', () => {
    const one = seasonState({ summer: null }, 'winter', null, on(2026, 11, 16));
    expect(one).toEqual({ season: 'summer', shown: [], drop: false });
  });
});

it("names the visitor's day", () => {
  expect(dayOf(new Date(2026, 0, 5, 23, 59))).toBe('2026-01-05');
});

describe('seasonScript', () => {
  afterEach(() => {
    delete document.documentElement.dataset['season'];
    delete document.documentElement.dataset['script'];
    localStorage.clear();
  });

  // The script is the function's own source text, so it must run without the module.
  it('runs on its own and sets the attribute', () => {
    localStorage.setItem('season', JSON.stringify({ season: 'summer-2027', on: '2026-11-15' }));
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 10, 16, 12));
    new Function(seasonScript({ winter: '09-01', summer: '04-01' }))();
    vi.useRealTimers();
    expect(document.documentElement.dataset['season']).toBe('summer');
    expect(document.documentElement.dataset['script']).toBe('');
  });
});
