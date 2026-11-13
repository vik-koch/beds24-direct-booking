// Firn & Farn does not exist: the houses, their positions, the prices and the tax are invented.
export const languages = ['de', 'en'] as const;
export type Text = Record<(typeof languages)[number], string>;
export type Level = 'off' | 'summer' | 'winter' | 'peak';

export interface Room {
  id: number;
  name: string;
  maxPeople: number;
  roomSize: number;
  featureCodes: string[][];
  prices: Record<Exclude<Level, 'off'>, number>;
  bookedOutInWinter?: true;
  texts: Record<
    | 'displayName'
    | 'accommodationType'
    | 'contentHeadline'
    | 'contentDescription'
    | 'roomDescription',
    Text
  >;
}

export interface Property {
  id: number;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  featureCodes: string[][];
  texts: Record<
    | 'headline'
    | 'propertyDescription'
    | 'locationDescription'
    | 'directions'
    | 'houseRules'
    | 'propertyDescription1',
    Text
  >;
  rooms: Room[];
}

export const token = 'simulator';
export const bookingPageMultiplier = '*0.9';
export const leadTimeDays = 7;
export const tax = { amount: 3.5, name: { de: 'Ortstaxe', en: 'Local tax' } };

// Each period starts on the first Saturday on or after its day of the year.
export const periods: [month: number, day: number, level: Level][] = [
  [1, 5, 'winter'],
  [2, 1, 'peak'],
  [3, 1, 'winter'],
  [4, 12, 'off'],
  [5, 25, 'summer'],
  [10, 12, 'off'],
  [12, 1, 'winter'],
  [12, 20, 'peak'],
];

const fiction = {
  de: 'Firn & Farn ist ein erfundener Betrieb: Diese Seite ist eine Demo, hier kann nichts gebucht werden.',
  en: 'Firn & Farn is an invented business: this site is a demo and nothing can be booked here.',
};
const apartment = { de: 'Ferienwohnung', en: 'Holiday apartment' };
const houseRules = {
  de: 'Nichtraucherhaus. Haustiere sind nicht erlaubt.\nNachtruhe von 22 bis 7 Uhr.',
  en: 'No smoking in the house. Pets are not allowed.\nQuiet hours from 10 pm to 7 am.',
};
const group = (...codes: string[]) => codes.map((code) => [code]);
const shared = group(
  'SMOKING_NOT_ALLOWED',
  'PETS_NOT_ALLOWED',
  'HEATING',
  'LINENS',
  'TOWELS',
  'WIFI',
  'KITCHEN',
  'DISHWASHER',
  'COFFEE_MAKER',
  'DOWNTOWN',
  'MOUNTAIN_VIEW',
  'SKI_STORAGE',
  'PARKING_PAID',
);
const shower = ['BATHROOM', 'BATH_SHOWER', 'BATH_TOILET'];
const tub = ['BATHROOM', 'BATH_TUB', 'BATH_TOILET'];
const double = ['BEDROOM', 'BED_DOUBLE'];
const bunk = ['BEDROOM', 'BED_BUNK'];

export const properties: Property[] = [
  {
    id: 900101,
    name: 'Haus Firn',
    address: 'Musterweg 1',
    latitude: 47.391,
    longitude: 12.636,
    featureCodes: [...shared, ...group('ELEVATOR')],
    texts: {
      headline: {
        de: 'Zwei Wohnungen neben dem Schattberg X-press',
        en: 'Two apartments beside the Schattberg X-press',
      },
      propertyDescription: {
        de: `Haus Firn steht mitten in Saalbach. Skiraum mit Schuhtrockner im Winter, Radkeller mit Waschplatz im Sommer.\n${fiction.de}`,
        en: `Haus Firn stands in the middle of Saalbach. A ski room with a boot dryer in winter, a bike cellar with a wash station in summer.\n${fiction.en}`,
      },
      locationDescription: {
        de: 'Zwei Gehminuten zur Talstation des Schattberg X-press, Bäcker und Supermarkt um die Ecke.',
        en: 'Two minutes on foot to the Schattberg X-press valley station, a bakery and a supermarket around the corner.',
      },
      directions: {
        de: 'Die Tiefgarage ist über die Zufahrt hinter dem Haus erreichbar.',
        en: 'The underground car park is reached by the drive behind the house.',
      },
      houseRules,
      propertyDescription1: {
        de: `<p style="text-align: left;"><span style="font-size: 14px;">Zirbenholz, Lodenstoffe und ein Blick auf den <strong>Schattberg</strong>.</span></p>`,
        en: `<p style="text-align: left;"><span style="font-size: 14px;">Stone pine, loden fabrics and a view of the <strong>Schattberg</strong>.</span></p>`,
      },
    },
    rooms: [
      {
        id: 9001011,
        name: 'Zirbe',
        maxPeople: 2,
        roomSize: 34,
        featureCodes: [double, shower],
        prices: { summer: 135, winter: 185, peak: 245 },
        bookedOutInWinter: true,
        texts: {
          displayName: { de: 'Apartment Zirbe', en: 'Apartment Zirbe' },
          accommodationType: apartment,
          contentHeadline: { de: 'Für zwei, mit Regendusche', en: 'For two, with a rain shower' },
          contentDescription: {
            de: 'Ein Raum mit Doppelbett, Küchenzeile und Sitzecke am Fenster. Kein Balkon.',
            en: 'One room with a double bed, a kitchenette and a window seat. No balcony.',
          },
          roomDescription: { de: '34 m² im ersten Stock', en: '34 m² on the first floor' },
        },
      },
      {
        id: 9001012,
        name: 'Lärche',
        maxPeople: 4,
        roomSize: 61,
        featureCodes: [double, bunk, tub],
        prices: { summer: 195, winter: 265, peak: 345 },
        texts: {
          displayName: { de: 'Apartment Lärche', en: 'Apartment Lärche' },
          accommodationType: apartment,
          contentHeadline: {
            de: 'Für vier, mit Südbalkon und Badewanne',
            en: 'For four, with a south-facing balcony and a bath tub',
          },
          contentDescription: {
            de: 'Zwei Schlafzimmer, eine Wohnküche und ein Balkon zur Sonnenseite.',
            en: 'Two bedrooms, a kitchen-living room and a balcony on the sunny side.',
          },
          roomDescription: { de: '61 m² im zweiten Stock', en: '61 m² on the second floor' },
        },
      },
    ],
  },
  {
    id: 900102,
    name: 'Haus Farn',
    address: 'Musterweg 7',
    latitude: 47.392,
    longitude: 12.638,
    featureCodes: [...shared, ...group('BALCONY', 'WASHER')],
    texts: {
      headline: {
        de: 'Ein Haus für sechs bei der Kohlmaisbahn',
        en: 'A house for six near the Kohlmaisbahn',
      },
      propertyDescription: {
        de: `Haus Farn hat eine einzige Wohnung über zwei Etagen, mit Terrasse und eigener Sauna.\n${fiction.de}`,
        en: `Haus Farn holds a single apartment on two floors, with a terrace and a sauna of its own.\n${fiction.en}`,
      },
      locationDescription: {
        de: 'Wenige Gehminuten zur Kohlmaisbahn und in die Fußgängerzone.',
        en: 'A few minutes on foot to the Kohlmaisbahn and to the pedestrian zone.',
      },
      directions: {
        de: 'Zwei Stellplätze liegen direkt vor dem Haus.',
        en: 'Two parking spaces are right in front of the house.',
      },
      houseRules,
      propertyDescription1: { de: '', en: '' },
    },
    rooms: [
      {
        id: 9001021,
        name: 'Ahorn',
        maxPeople: 6,
        roomSize: 96,
        featureCodes: [double, double, bunk, tub, shower],
        prices: { summer: 310.5, winter: 420, peak: 560 },
        texts: {
          displayName: { de: 'Apartment Ahorn', en: 'Apartment Ahorn' },
          accommodationType: apartment,
          contentHeadline: {
            de: 'Für sechs, mit Terrasse und Sauna',
            en: 'For six, with a terrace and a sauna',
          },
          contentDescription: {
            de: 'Drei Schlafzimmer, zwei Bäder und ein großer Tisch für alle.',
            en: 'Three bedrooms, two bathrooms and one large table for everyone.',
          },
          roomDescription: { de: '96 m² auf zwei Etagen', en: '96 m² on two floors' },
        },
      },
    ],
  },
];
