import { richText } from './rich-text';

// What the site reads of Beds24. Each room is its own room type: one unit per room type is
// assumed, the hotel case of several units of one type is not supported.
export interface Room extends Listing {
  id: number;
  propertyId: number;
  currency: string;
  // The earliest arrival is this many days after today.
  leadDays: number;
  // The property's booking page multiplier; null when it cannot be read, and then no price.
  multiplier: number | null;
  tax: Tax | null;
  // Per Beds24 language code, empty where nothing is written.
  headlines: Record<string, string>;
}

// What a room's page shows of it.
export interface Listing {
  // Any of them adults: the site supports a room by its total alone (findings, Guests).
  maxPeople: number;
  // Beds24 asks for children; where it does not ("Don't Ask" or "None"), they count as adults.
  asksChildren: boolean;
  size: number;
  bedrooms: number;
  address: string;
  // The property's registration number, empty where none is set.
  permit: string;
  // HH:MM, midnight as 24:00; null where the property sets none.
  checkIn: { from: string | null; until: string | null };
  checkOut: string | null;
  // The property's codes, each a group of its own, then the room's groups in their order.
  features: string[][];
  // Per Beds24 language code, such as de, empty where nothing is written; rich text sanitised.
  texts: Record<string, { description: string; houseRules: string }>;
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

type Texts<K extends string> = ({ language: string } & Record<K, string>)[];

interface Properties {
  data: {
    id: number;
    currency: string;
    address: string;
    city: string;
    checkInStart: string;
    checkInEnd: string;
    checkOutEnd: string;
    permit: string;
    featureCodes: string[][];
    // Missing when the property has no text at all.
    texts?: Texts<'houseRules'>;
    bookingPageMultiplier?: string;
    upsellItems?: { type: string; amount: number; per: string; period: string }[];
    roomTypes: {
      id: number;
      maxPeople: number;
      // null is "Use Guests" (as many as maxPeople); children null is "Don't Ask", 0 "None".
      maxAdult: number | null;
      maxChildren: number | null;
      roomSize: number;
      featureCodes: string[][];
      texts: Texts<'contentHeadline' | 'roomDescription'>;
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

const base = () => {
  const url = process.env['BEDS24_URL'];
  if (!url) throw new Error('BEDS24_URL is not set: the address of Beds24 or the simulator');
  return url;
};

let access: { token: string; until: number } | undefined;
let renewing: Promise<string> | undefined;
// A 24-hour access token from the refresh token, renewed when less than an hour is left.
const token = async () => {
  if (access && access.until - Date.now() > 36e5) return access.token;
  return (renewing ??= fetch(`${base()}/authentication/token`, {
    headers: { refreshToken: process.env['BEDS24_REFRESH_TOKEN'] ?? '' },
    signal: AbortSignal.timeout(5000),
  })
    .then(async (response) => {
      if (!response.ok) throw new Error(`Beds24 answered ${response.status} to the token refresh`);
      const { token, expiresIn } = (await response.json()) as { token: string; expiresIn: number };
      access = { token, until: Date.now() + expiresIn * 1000 };
      return token;
    })
    .finally(() => (renewing = undefined)));
};

const get = async <T>(path: string): Promise<T> => {
  const response = await fetch(`${base()}${path}`, {
    headers: { token: await token() },
    signal: AbortSignal.timeout(5000),
  });
  if (!response.ok) throw new Error(`Beds24 answered ${response.status} to ${path}`);
  return response.json();
};

// The rooms of every property and their calendars from the first to the last day: two calls.
export const loadInventory = async (first: string, last: string): Promise<Inventory> => {
  const [properties, calendars] = await Promise.all([
    get<Properties>(
      '/properties?includeAllRooms=true&includePriceRules=true&includeUpsellItems=true' +
        '&includeTexts=all&includeLanguages=all',
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
      const { maxPeople, maxAdult, maxChildren } = room;
      if ((maxAdult ?? maxPeople) !== maxPeople || (maxChildren && maxChildren < maxPeople - 1))
        console.warn(`Room ${room.id} limits adults or children apart from its total: ignored`);
      // Unused rules come back as bare IDs; the rule that allows the soonest arrival counts.
      const leads = (room.priceRules ?? []).flatMap((rule) => rule.minDaysUntilCheckin ?? []);
      return {
        id: room.id,
        propertyId: property.id,
        maxPeople,
        asksChildren: !!maxChildren,
        size: room.roomSize,
        bedrooms: room.featureCodes.filter(([code]) => code === 'BEDROOM').length,
        currency: property.currency,
        leadDays: leads.length ? Math.min(...leads) : 0,
        multiplier: multiplier(property.bookingPageMultiplier),
        tax: tax ? { amount: tax.amount, per: tax.period === 'daily' ? 'night' : 'stay' } : null,
        address: [property.address, property.city].filter(Boolean).join(', '),
        permit: property.permit.trim(),
        checkIn: { from: property.checkInStart || null, until: property.checkInEnd || null },
        checkOut: property.checkOutEnd || null,
        features: [...property.featureCodes, ...room.featureCodes],
        headlines: Object.fromEntries(
          room.texts.map((text) => [text.language, text.contentHeadline.trim()]),
        ),
        texts: Object.fromEntries(
          room.texts.map((text) => [
            text.language,
            {
              description: richText(text.roomDescription),
              houseRules:
                property.texts
                  ?.find(({ language }) => language === text.language)
                  ?.houseRules.trim() ?? '',
            },
          ]),
        ),
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

// A room's listing for its page, with the texts of the site's languages only.
export function listingOf(rooms: Room[], id: number, languages: string[]): Listing {
  const room = rooms.find((one) => one.id === id);
  if (!room) throw new Error(`Beds24 has no room ${id}`);
  const { maxPeople, asksChildren, size, bedrooms, address, permit } = room;
  const { checkIn, checkOut, features, texts } = room;
  return {
    maxPeople,
    asksChildren,
    size,
    bedrooms,
    address,
    permit,
    checkIn,
    checkOut,
    features,
    texts: Object.fromEntries(
      languages.flatMap((code) => (texts[code] ? [[code, texts[code]]] : [])),
    ),
  };
}

export interface Stay {
  roomId: number;
  arrival: string;
  departure: string;
  adults: number;
  children: number;
}

export interface Guest {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  // ISO 3166 alpha-2, such as DE.
  country: string;
  // A Beds24 language code, such as de: the language of Beds24's confirmation.
  language: string;
}

// An invoice line, worded for the guest: Beds24's confirmation lists it as it is.
export interface Charge {
  description: string;
  qty: number;
  amount: number;
}

interface Answer {
  success: boolean;
  new?: { id: number };
  errors?: { field?: string }[];
}

// Beds24's answer can repeat the guest's details, so an error names no more than the booking.
const post = async (booking: object, what: string): Promise<Answer> => {
  const response = await fetch(`${base()}/bookings`, {
    method: 'POST',
    headers: { token: await token(), 'Content-Type': 'application/json' },
    body: JSON.stringify([booking]),
    signal: AbortSignal.timeout(5000),
  });
  if (!response.ok) throw new Error(`Beds24 answered ${response.status} to ${what}`);
  const [answer] = (await response.json()) as Answer[];
  if (!answer?.success && !answer?.errors?.some(({ field }) => field === 'no availability'))
    throw new Error(`Beds24 refused ${what}`);
  return answer;
};

const cents = (amount: number) => Math.round(amount * 100) / 100;

// Holds the stay as a new booking, priced by its charges, unless Beds24 has it taken.
export const createBooking = async (
  { roomId, arrival, departure, adults, children }: Stay,
  { firstName, lastName, email, phone, country, language }: Guest,
  charges: Charge[],
): Promise<number | 'taken'> => {
  const answer = await post(
    {
      roomId,
      status: 'new',
      arrival,
      departure,
      numAdult: adults,
      numChild: children,
      firstName,
      lastName,
      email,
      phone,
      country2: country,
      lang: language,
      price: cents(charges.reduce((sum, { qty, amount }) => sum + qty * amount, 0)),
      invoiceItems: charges.map((charge) => ({ type: 'charge', ...charge })),
      actions: { checkAvailability: true },
    },
    `a booking of room ${roomId}`,
  );
  return answer.new?.id ?? 'taken';
};

// The payment as a line of its own, with Stripe's ID beside it where the guest does not see it.
export const recordPayment = async (id: number, charge: Omit<Charge, 'qty'>, paymentId: string) => {
  await post(
    {
      id,
      status: 'confirmed',
      invoiceItems: [{ type: 'payment', qty: 1, ...charge }],
      infoItems: [{ code: 'STRIPE_PAYMENT', text: paymentId }],
    },
    `the payment of booking ${id}`,
  );
};

// Beds24's confirmation e-mail, in the booking's language.
export const sendConfirmation = async (id: number) => {
  await post({ id, actions: { notifyGuest: true } }, `the confirmation of booking ${id}`);
};

export const cancelBooking = async (id: number) => {
  await post({ id, status: 'cancelled' }, `the cancellation of booking ${id}`);
};
