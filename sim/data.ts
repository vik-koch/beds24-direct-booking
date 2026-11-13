import seed from './data.json' with { type: 'json' };

export const languages = ['de', 'en'] as const;
export type Text = Record<(typeof languages)[number], string>;

export interface Room {
  id: number;
  name: string;
  maxPeople: number;
  roomSize: number;
  featureCodes: string[][];
  prices: Record<'summer' | 'winter' | 'peak', number>;
  bookedOutInWinter?: boolean;
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
  featureCodes: string[];
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

interface Seed {
  bookingPageMultiplier: string;
  leadTimeDays: number;
  tax: { amount: number; name: Text };
  properties: Property[];
}

// Firn & Farn does not exist: the houses, their positions, the prices and the tax are invented.
export const { bookingPageMultiplier, leadTimeDays, tax, properties }: Seed = seed;
