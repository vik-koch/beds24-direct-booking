// What the site reads of Beds24. Each room is its own room type: one unit per room type is
// assumed, the hotel case of several units of one type is not supported.
export interface Room {
  id: number;
  propertyId: number;
  maxPeople: number;
  size: number;
  currency: string;
  // The earliest arrival is this many days after today.
  leadDays: number;
  // The property's booking page multiplier; null when it cannot be read, and then no price.
  multiplier: number | null;
  tax: Tax | null;
}

// The tourist tax per adult, per night or once per stay.
export interface Tax {
  amount: number;
  per: 'night' | 'stay';
}

// One calendar day of a room. A day Beds24 does not list is closed and unpriced.
export interface Day {
  date: string;
  free: boolean;
  price: number | null;
  // Arrival and departure are allowed on this day.
  changeover: boolean;
}

export interface Inventory {
  rooms: Room[];
  // Per room ID, every day from the first to the last day asked for.
  days: Record<number, Day[]>;
}

interface Properties {
  data: {
    id: number;
    currency: string;
    bookingPageMultiplier?: string;
    upsellItems?: { type: string; amount: number; per: string; period: string }[];
    roomTypes: {
      id: number;
      maxPeople: number;
      roomSize: number;
      priceRules?: { minDaysUntilCheckin?: number }[];
    }[];
  }[];
}

interface Calendars {
  data: {
    roomId: number;
    calendar: {
      from: string;
      to: string;
      numAvail?: number;
      override?: string;
      price1?: number;
    }[];
  }[];
}

const day = 864e5;
export const addDays = (date: string, days: number) =>
  new Date(Date.parse(date) + days * day).toISOString().slice(0, 10);

// Written "*0.9"; a bare "0.9" is returned by Beds24 but applied nowhere, so it is not read.
export const multiplier = (value = '') =>
  value === '' ? 1 : /^\*\d+(\.\d+)?$/.test(value) ? Number(value.slice(1)) : null;

const get = async <T>(path: string): Promise<T> => {
  const url = process.env['BEDS24_URL'];
  if (!url) throw new Error('BEDS24_URL is not set: the address of Beds24 or the simulator');
  const response = await fetch(`${url}${path}`, {
    headers: { token: process.env['BEDS24_TOKEN'] ?? '' },
    signal: AbortSignal.timeout(5000),
  });
  if (!response.ok) throw new Error(`Beds24 answered ${response.status} to ${path}`);
  return response.json();
};

// The rooms of every property and their calendars from the first to the last day: two calls.
export const loadInventory = async (first: string, last: string): Promise<Inventory> => {
  const [properties, calendars] = await Promise.all([
    get<Properties>(
      '/properties?includeAllRooms=true&includePriceRules=true&includeUpsellItems=true',
    ),
    get<Calendars>(
      `/inventory/rooms/calendar?startDate=${first}&endDate=${last}` +
        '&includeNumAvail=true&includePrices=true&includeOverride=true',
    ),
  ]);
  const rooms: Room[] = properties.data.flatMap((property) => {
    const tax = property.upsellItems?.find(
      (item) =>
        ['obligatory', 'obligatoryTax'].includes(item.type) &&
        item.per === 'adult' &&
        ['daily', 'oneTime'].includes(item.period),
    );
    return property.roomTypes.map((room) => {
      // Unused rules come back as bare IDs; the rule that allows the soonest arrival counts.
      const leads = (room.priceRules ?? []).flatMap((rule) => rule.minDaysUntilCheckin ?? []);
      return {
        id: room.id,
        propertyId: property.id,
        maxPeople: room.maxPeople,
        size: room.roomSize,
        currency: property.currency,
        leadDays: leads.length ? Math.min(...leads) : 0,
        multiplier: multiplier(property.bookingPageMultiplier),
        tax: tax ? { amount: tax.amount, per: tax.period === 'daily' ? 'night' : 'stay' } : null,
      };
    });
  });
  const count = (Date.parse(last) - Date.parse(first)) / day + 1;
  const days = Object.fromEntries(
    calendars.data.map(({ roomId, calendar }) => {
      const list: Day[] = Array.from({ length: count }, (_, i) => ({
        date: addDays(first, i),
        free: false,
        price: null,
        changeover: false,
      }));
      for (const range of calendar)
        for (let date = range.from; date <= range.to; date = addDays(date, 1)) {
          const index = (Date.parse(date) - Date.parse(first)) / day;
          if (index < 0 || index >= count) continue;
          list[index] = {
            date,
            free: range.numAvail === 1,
            price: range.price1 || null,
            changeover: range.override === 'none',
          };
        }
      return [roomId, list];
    }),
  );
  return { rooms, days };
};
