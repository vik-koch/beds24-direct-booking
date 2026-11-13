import { periods, properties, type Level, type Room } from './data.ts';

const day = 86_400_000;
const iso = (time: number) => new Date(time).toISOString().slice(0, 10);
const saturdayOnOrAfter = (time: number) => time + ((6 - new Date(time).getUTCDay()) % 7) * day;
const saturdayOnOrBefore = (time: number) => time - ((new Date(time).getUTCDay() + 1) % 7) * day;

const period = (time: number) => {
  const year = new Date(time).getUTCFullYear();
  return [year - 1, year]
    .flatMap((y) =>
      periods.map(([month, date, level]) => ({
        start: saturdayOnOrAfter(Date.UTC(y, month - 1, date)),
        level,
      })),
    )
    .filter(({ start }) => start <= time)
    .at(-1)!;
};

// Where two priced periods meet, the arrival day keeps the old price, as on the wire.
const level = (time: number): Level => {
  const now = period(time);
  const before = period(time - day).level;
  return now.start === time && now.level !== 'off' && before !== 'off' ? before : now.level;
};

const taken = (room: Room, time: number) => {
  const week = saturdayOnOrBefore(time);
  const season = period(week).level;
  if (room.bookedOutInWinter && (season === 'winter' || season === 'peak')) return true;
  const draw = ((Math.imul(room.id ^ (week / day), 0x9e3779b1) >>> 8) % 100) + 1;
  const whole = season === 'peak' ? 60 : 30;
  const night = (time - week) / day;
  return draw <= whole || (draw <= whole + 8 && night >= 2 && night <= 4);
};

const dayOf = (room: Room, time: number, has: (name: string) => boolean) => {
  const price = level(time);
  return {
    ...(has('includeNumAvail') && { numAvail: taken(room, time) ? 0 : 1 }),
    ...(has('includeMinStay') && { minStay: 7 }),
    ...(has('includeMaxStay') && { maxStay: 7 }),
    ...(has('includeOverride') && {
      override: new Date(time).getUTCDay() === 6 ? 'none' : 'noCheckInOrCheckOut',
    }),
    ...(has('includeMultiplier') && { multiplier: 1 }),
    ...(has('includePrices') && price !== 'off' && { price1: room.prices[price] }),
  };
};

export const roomCalendars = (query: URLSearchParams) => {
  const has = (name: string) => query.has(name) && query.get(name) !== 'false';
  const start = Date.parse(query.get('startDate') ?? '');
  const end = Date.parse(query.get('endDate') ?? '');
  if (Number.isNaN(start) || Number.isNaN(end)) return null;
  const propertyIds = query.getAll('propertyId').map(Number);
  const roomIds = query.getAll('roomId').map(Number);
  return properties
    .filter((property) => !propertyIds.length || propertyIds.includes(property.id))
    .flatMap((property) =>
      property.rooms
        .filter((room) => !roomIds.length || roomIds.includes(room.id))
        .map((room) => {
          const calendar: ({ from: string; to: string } & ReturnType<typeof dayOf>)[] = [];
          let last = '';
          for (let time = start; time <= end; time += day) {
            const values = dayOf(room, time, has);
            const key = JSON.stringify(values);
            if (key === '{}') break;
            if (key === last) calendar.at(-1)!.to = iso(time);
            else calendar.push({ from: iso(time), to: iso(time), ...values });
            last = key;
          }
          return { roomId: room.id, propertyId: property.id, name: room.name, calendar };
        }),
    );
};
