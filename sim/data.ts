import seed from './data.json' with { type: 'json' };

export const languages = ['de', 'en'] as const;
export type Text = Record<(typeof languages)[number], string>;

export interface Room {
  id: number;
  name: string;
  maxPeople: number;
  maxAdult: number | null;
  maxChildren: number | null;
  roomSize: number;
  featureCodes: string[][];
  prices: Record<'summer' | 'winter' | 'peak', number>;
  bookedOutInWinter?: boolean;
  // Only the texts the site reads; the others are sent empty.
  texts: Record<'contentHeadline' | 'roomDescription', Text>;
}

export interface Property {
  id: number;
  name: string;
  address: string;
  permit?: string;
  latitude: number;
  longitude: number;
  featureCodes: string[];
  texts: Record<'houseRules', Text> & Partial<Record<`customQuestion${number}`, Text>>;
  // The questions asked, in their order: a guest field's usage, or a custom question's usage and
  // type, such as "optional tickBox". Every other one is not used.
  questions: Partial<Record<string, string>>;
  bookingRules: object;
  paymentCollection: object;
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
