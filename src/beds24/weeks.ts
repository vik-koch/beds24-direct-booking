import type { SeasonName } from '../content/names';
import { addDays, type Day, type Inventory, type Room, type Tax } from './client';

// A week Beds24 offers: price is null when it is taken.
export interface Week {
  arrival: string;
  departure: string;
  price: number | null;
}

// One dated season, or the whole year of a site with one season (then without years).
export interface Period {
  name: SeasonName;
  years: string | null;
  start: string;
  end: string;
}

// What the free-weeks list shows: per season one row per week, one price per apartment.
export interface FreeWeeks {
  apartments: {
    slug: string;
    name: string;
    guests: number;
    size: number;
    bedrooms: number;
    // Per Beds24 language code of the site, empty where nothing is written.
    headline: Record<string, string>;
  }[];
  currency: string;
  // Shown once beside the prices, so only when every apartment has the same.
  tax: Tax | null;
  seasons: {
    name: SeasonName;
    years: string | null;
    // notOpen: no week has prices yet; full: no week is free.
    state: 'open' | 'notOpen' | 'full';
    weeks: { arrival: string; departure: string; prices: (number | null)[] }[];
  }[];
}

// The weeks of one room that arrive on or after the earliest day: both ends allow a
// changeover and all seven nights have a price. A week is free when all seven nights are.
export function offeredWeeks(room: Room, days: Day[], earliest: string): Week[] {
  if (room.multiplier === null) return [];
  return days.flatMap((first, i) => {
    const nights = days.slice(i, i + 7);
    const last = days[i + 7];
    if (first.date < earliest || !last || !first.changeover || !last.changeover) return [];
    if (nights.some((night) => night.price === null)) return [];
    const sum = nights.reduce((total, night) => total + night.price!, 0);
    const price = nights.every((night) => night.free)
      ? Math.round(sum * room.multiplier! * 100) / 100
      : null;
    return [{ arrival: first.date, departure: last.date, price }];
  });
}

// The apartments the content lists, in its order, with their weeks per period.
export function freeWeeks(
  inventory: Inventory,
  apartments: { slug: string; roomId: number; name: string }[],
  periods: Period[],
  today: string,
  languages: string[],
): FreeWeeks {
  const listed = apartments.flatMap((apartment) => {
    const room = inventory.rooms.find((one) => one.id === apartment.roomId);
    if (!room) console.warn(`Beds24 has no room ${apartment.roomId} for ${apartment.slug}`);
    return room ? [{ apartment, room }] : [];
  });
  if (!listed.length) throw new Error('Beds24 has none of the rooms the content lists');
  for (const { apartment, room } of listed)
    if (room.multiplier === null)
      console.warn(`The booking page multiplier of ${apartment.slug} is unreadable: no prices`);
  const weeks = listed.map(({ room }) =>
    offeredWeeks(room, inventory.days[room.id] ?? [], addDays(today, room.leadDays)),
  );
  const taxes = new Set(listed.map(({ room }) => JSON.stringify(room.tax)));
  return {
    apartments: listed.map(({ apartment, room }) => ({
      slug: apartment.slug,
      name: apartment.name,
      guests: room.maxPeople,
      size: room.size,
      bedrooms: room.bedrooms,
      headline: Object.fromEntries(languages.map((code) => [code, room.headlines[code] ?? ''])),
    })),
    currency: listed[0].room.currency,
    tax: taxes.size === 1 ? listed[0].room.tax : null,
    seasons: periods.map(({ name, years, start, end }) => {
      const arrivals = [...new Set(weeks.flat().map((week) => week.arrival))]
        .filter((arrival) => arrival >= start && arrival <= end)
        .sort();
      const rows = arrivals.map((arrival) => {
        const offered = weeks.map((list) => list.find((week) => week.arrival === arrival));
        return {
          arrival,
          departure: addDays(arrival, 7),
          prices: offered.map((week) => week?.price ?? null),
        };
      });
      // Unpriced weeks are not open yet; a season that has begun is full instead.
      const state = rows.some((row) => row.prices.some((price) => price !== null))
        ? 'open'
        : rows.length || start <= today
          ? 'full'
          : 'notOpen';
      return { name, years, state, weeks: state === 'open' ? rows : [] };
    }),
  };
}
