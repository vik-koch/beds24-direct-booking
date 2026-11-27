import { taken } from './calendar.ts';
import { properties } from './data.ts';

export type Held = (room: number, date: string) => boolean;

interface Item {
  type: string;
  description?: string;
  qty?: number;
  amount: number;
}

// One item of a `POST /bookings`: a new booking without `id`, a change to one with it.
export interface Booking {
  id?: number;
  roomId?: number;
  status?: string;
  arrival?: string;
  departure?: string;
  price?: number;
  invoiceItems?: Item[];
  infoItems?: { code: string; text: string }[];
  actions?: { checkAvailability?: boolean; notifyGuest?: boolean };
}

// The demo is public, so a booking keeps its stay and money, never the guest's details.
type Saved = Required<Omit<Booking, 'id' | 'actions'>> & { notified: number };

const day = 86_400_000;
const next = (date: string) => new Date(Date.parse(date) + day).toISOString().slice(0, 10);
const rooms = properties.flatMap((property) => property.rooms);

export const bookings = () => {
  const saved = new Map<number, Saved>();
  let last = 70_000_000;
  const held: Held = (room, date) =>
    [...saved.values()].some(
      (booking) =>
        booking.roomId === room &&
        ['new', 'confirmed'].includes(booking.status) &&
        booking.arrival <= date &&
        date < booking.departure,
    );
  const free = (roomId: number, arrival: string, departure: string) => {
    const room = rooms.find(({ id }) => id === roomId);
    if (!room || !(arrival < departure)) return false;
    for (let date = arrival; date < departure; date = next(date))
      if (taken(room, Date.parse(date)) || held(roomId, date)) return false;
    return true;
  };
  const post = (items: Booking[]) =>
    items.map(({ id, actions, invoiceItems = [], infoItems = [], ...fields }) => {
      if (id === undefined) {
        const { roomId = 0, arrival = '', departure = '' } = fields;
        if (actions?.checkAvailability && !free(roomId, arrival, departure))
          return {
            success: false,
            errors: [{ action: 'new booking', field: 'no availability', message: 'invalid' }],
          };
        const booking = {
          roomId,
          arrival,
          departure,
          status: fields.status ?? 'new',
          price: fields.price ?? 0,
          invoiceItems,
          infoItems,
          notified: actions?.notifyGuest ? 1 : 0,
        };
        saved.set(++last, booking);
        return { success: true, new: { id: last, ...booking } };
      }
      const booking = saved.get(id);
      if (!booking)
        return { success: false, errors: [{ action: 'modify booking', message: 'access denied' }] };
      if (fields.status) booking.status = fields.status;
      if (fields.price !== undefined) booking.price = fields.price;
      booking.invoiceItems.push(...invoiceItems);
      booking.infoItems.push(...infoItems);
      if (actions?.notifyGuest) booking.notified++;
      return { success: true, modified: { id } };
    });
  return { saved, held, post };
};
