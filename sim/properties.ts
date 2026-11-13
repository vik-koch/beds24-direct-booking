import {
  bookingPageMultiplier,
  languages,
  leadTimeDays,
  properties,
  tax,
  type Property,
  type Room,
  type Text,
} from './data.ts';

const numbered = (name: string, from: number, to: number) =>
  Array.from({ length: to - from + 1 }, (_, i) => name + (from + i));

const perLanguage = (texts: Record<string, Text>, empty: string[]) =>
  languages.map((language) => ({
    language,
    ...Object.fromEntries(empty.map((key) => [key, ''])),
    ...Object.fromEntries(
      Object.entries(texts).map(([key, text]) => [key, text[language].replaceAll('\n', '\r\n')]),
    ),
  }));

const roomType = (property: Property, room: Room, has: (name: string) => boolean) => ({
  id: room.id,
  propertyId: property.id,
  name: room.name,
  roomType: 'apartment',
  qty: 1,
  minStay: 7,
  maxStay: 7,
  maxPeople: room.maxPeople,
  taxPercentage: 0,
  taxPerson: 0,
  cleaningFee: 0,
  roomSize: room.roomSize,
  ...(has('includeTexts') && { texts: perLanguage(room.texts, ['auxiliary', 'marketing']) }),
  featureCodes: room.featureCodes,
  ...(has('includePriceRules') && {
    priceRules: [
      {
        id: 1,
        name: '',
        priceFor: { type: 'maxCapacity' },
        minimumStay: 0,
        maximumStay: 365,
        minDaysUntilCheckin: leadTimeDays,
        maxDaysUntilCheckin: 999,
      },
      ...Array.from({ length: 15 }, (_, i) => ({ id: i + 2 })),
    ],
  }),
});

export const propertyList = (query: URLSearchParams) => {
  const has = (name: string) => query.has(name) && query.get(name) !== 'false';
  const ids = query.getAll('id').map(Number);
  return properties
    .filter((property) => !ids.length || ids.includes(property.id))
    .map((property) => ({
      id: property.id,
      name: property.name,
      propertyType: 'apartment',
      currency: 'EUR',
      address: property.address,
      city: 'Saalbach',
      state: 'Salzburg',
      country: 'AT',
      postcode: '5753',
      latitude: property.latitude,
      longitude: property.longitude,
      checkInStart: '16:00',
      checkInEnd: '20:00',
      checkOutEnd: '10:00',
      bookingPageMultiplier,
      permit: '',
      featureCodes: property.featureCodes.map((code) => [code]),
      ...(has('includeTexts') && {
        texts: perLanguage({ ...property.texts, upsellItemName1: tax.name }, [
          'propertyDescription2',
          'propertyDescriptionBookingPage1',
          'propertyDescriptionBookingPage2',
          'generalPolicy',
          'cancellationPolicy',
          ...numbered('upsellItemName', 2, 20),
        ]),
      }),
      ...(has('includeUpsellItems') && {
        upsellItems: [
          {
            index: 1,
            type: 'obligatory',
            amount: tax.amount,
            per: 'adult',
            period: 'daily',
            vat: 0,
          },
          ...Array.from({ length: 19 }, (_, i) => ({
            index: i + 2,
            type: 'notUsed',
            amount: 0,
            per: 'booking',
            period: 'oneTime',
            vat: 0,
          })),
        ],
      }),
      ...(has('includeAllRooms') && {
        roomTypes: property.rooms.map((room) => roomType(property, room, has)),
      }),
    }));
};
