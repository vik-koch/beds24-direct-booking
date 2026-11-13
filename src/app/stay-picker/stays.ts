export interface Stay {
  start: string;
  end: string;
  price: number;
  state: 'free' | 'booked' | 'closed';
}

export interface Day {
  date: string;
  stay?: Stay;
}

export interface Month {
  first: string;
  weeks: (Day | undefined)[][];
}

const dayMs = 86_400_000;

export const utc = (date: string) => new Date(`${date}T00:00:00Z`);
export const iso = (date: Date) => date.toISOString().slice(0, 10);
export const addDays = (date: string, days: number) =>
  iso(new Date(utc(date).getTime() + days * dayMs));

const dayFormat = new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeZone: 'UTC' });
const longFormat = new Intl.DateTimeFormat('en-GB', { dateStyle: 'full', timeZone: 'UTC' });
const monthFormat = new Intl.DateTimeFormat('en-GB', {
  month: 'long',
  year: 'numeric',
  timeZone: 'UTC',
});
const priceFormat = new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'EUR' });

export const formatDay = (date: string) => dayFormat.format(utc(date));
export const formatLongDay = (date: string) => longFormat.format(utc(date));
export const formatMonth = (date: string) => monthFormat.format(utc(date));
export const formatPrice = (price: number) => priceFormat.format(price);
export const formatStay = (stay: Stay) => `${formatDay(stay.start)} to ${formatDay(stay.end)}`;

export const stateLabel = (stay: Stay | undefined) =>
  stay?.state === 'free'
    ? formatPrice(stay.price)
    : stay?.state === 'booked'
      ? 'booked'
      : 'not bookable';

// A night belongs to the stay it starts in, so a changeover day selects the stay that begins on it.
export const stayOf = (stays: Stay[], date: string) =>
  stays.find((stay) => stay.start <= date && date < stay.end);

export function months(stays: Stay[]): Month[] {
  const result: Month[] = [];
  if (!stays.length) return result;
  const last = stays[stays.length - 1].end.slice(0, 7);
  for (let first = `${stays[0].start.slice(0, 7)}-01`; first.slice(0, 7) <= last;) {
    const next = iso(new Date(Date.UTC(+first.slice(0, 4), +first.slice(5, 7), 1)));
    const lead = (utc(first).getUTCDay() + 6) % 7;
    const cells: (Day | undefined)[] = Array<undefined>(lead).fill(undefined);
    for (let date = first; date < next; date = addDays(date, 1))
      cells.push({ date, stay: stayOf(stays, date) });
    const weeks = [];
    for (let i = 0; i < cells.length; i += 7)
      weeks.push(Array.from({ length: 7 }, (_, column) => cells[i + column]));
    result.push({ first, weeks });
    first = next;
  }
  return result;
}

function weekly(start: string, states: string): Stay[] {
  return [...states].map((state, week) => ({
    start: addDays(start, week * 7),
    end: addDays(start, week * 7 + 7),
    price: 1400 + ((week * 7) % 5) * 100,
    state: state === 'f' ? 'free' : state === 'b' ? 'booked' : 'closed',
  }));
}

export const fixtures: Record<string, Stay[]> = {
  mixed: weekly('2026-11-14', 'fbffbbffcccfffbfbbffffbfff'),
  booked: weekly('2026-11-14', 'bbbbbbbb'),
  empty: [],
};
