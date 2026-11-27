import type { Held } from './bookings.ts';
import { nightPrice, taken } from './calendar.ts';
import { bookingPageMultiplier, leadTimeDays, properties } from './data.ts';

const day = 86_400_000;
const iso = (time: number) => new Date(time).toISOString().slice(0, 10);

// One stay, by the rules the wire showed: a Saturday-to-Saturday week, free and priced every night,
// beyond the lead time and within the room's guest limits. Any other stay gets no `offers`.
export const roomOffers = (query: URLSearchParams, held: Held) => {
  const arrival = Date.parse(query.get('arrival') ?? '');
  const departure = Date.parse(query.get('departure') ?? '');
  if (Number.isNaN(arrival) || Number.isNaN(departure)) return null;
  const adults = Number(query.get('numAdults') ?? 0);
  const children = Number(query.get('numChildren') ?? 0);
  const earliest = Date.parse(iso(Date.now())) + leadTimeDays * day;
  const propertyIds = query.getAll('propertyId').map(Number);
  const roomIds = query.getAll('roomId').map(Number);
  return properties
    .filter((property) => !propertyIds.length || propertyIds.includes(property.id))
    .flatMap((property) =>
      property.rooms
        .filter((room) => !roomIds.length || roomIds.includes(room.id))
        .map((room) => {
          const nights = Array.from({ length: (departure - arrival) / day }, (_, n) => ({
            time: arrival + n * day,
            price: nightPrice(room, arrival + n * day),
          }));
          const offered =
            nights.length === 7 &&
            new Date(arrival).getUTCDay() === 6 &&
            arrival >= earliest &&
            adults + children <= room.maxPeople &&
            (room.maxAdult === null || adults <= room.maxAdult) &&
            (room.maxChildren === null || children <= room.maxChildren) &&
            nights.every(
              ({ time, price }) => price && !taken(room, time) && !held(room.id, iso(time)),
            );
          const sum = nights.reduce((total, { price = 0 }) => total + price, 0);
          const price = Math.round(sum * Number(bookingPageMultiplier.slice(1)) * 100) / 100;
          return {
            roomId: room.id,
            propertyId: property.id,
            ...(offered && { offers: [{ offerId: 1, offerName: '', price, unitsAvailable: 1 }] }),
          };
        }),
    );
};
