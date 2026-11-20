import type { Picture } from './schema';

// Names and helpers the schema and the application share. Kept apart from the schema, so that
// the browser's bundle does not take Zod along with them.
export const seasonNames = ['winter', 'summer'] as const;
export type SeasonName = (typeof seasonNames)[number];

// Characters as a reader counts them: an accent typed as its own code point is no second one.
export const letters = (text: string) => [...new Intl.Segmenter().segment(text)].length;

// A converted picture's files for an img's srcset.
export const srcset = (picture: Picture) =>
  picture.sources.map(({ url, width }) => `${url} ${width}w`).join(', ');

// A Lucide icon's name as lucide.dev shows it, such as calendar-days, and its name in
// @ng-icons/lucide, lucideCalendarDays.
export const lucideName = (name: string) =>
  'lucide' + name.replace(/(^|-)([a-z0-9])/g, (_, _dash, char: string) => char.toUpperCase());
