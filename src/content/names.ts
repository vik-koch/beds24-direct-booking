import type { Picture } from './schema';

// Names and helpers the schema and the application share. Kept apart from the schema, so that
// the browser's bundle does not take Zod along with them.
export const seasonNames = ['winter', 'summer'] as const;
export type SeasonName = (typeof seasonNames)[number];

// Characters as a reader counts them: an accent typed as its own code point is no second one.
export const letters = (text: string) => [...new Intl.Segmenter().segment(text)].length;

// Each place in an apartment's galleries: one picture for every season, or each season's own,
// named by the season that shows it there. Each season's gallery is the list without the other
// season's pictures, so a picture without a season may stand at different places in them; the
// content script makes them equally long.
export interface Shown {
  picture: Picture;
  season: SeasonName | null;
}
export const placesOf = (pictures: Picture[], seasons: readonly SeasonName[]): Shown[][] => {
  const lists = seasons.map((name) => pictures.filter(({ season }) => !season || season === name));
  return lists[0].map((_, index) => {
    const chosen = lists.map((list) => list[index]);
    return chosen.every((picture) => picture === chosen[0])
      ? [{ picture: chosen[0], season: null }]
      : chosen.map((picture, at) => ({ picture, season: seasons[at] }));
  });
};

// A converted picture's files for an img's srcset.
export const srcset = (picture: Picture) =>
  picture.sources.map(({ url, width }) => `${url} ${width}w`).join(', ');

// A Lucide icon's name as lucide.dev shows it, such as calendar-days, and its name in
// @ng-icons/lucide, lucideCalendarDays.
export const lucideName = (name: string) =>
  'lucide' + name.replace(/(^|-)([a-z0-9])/g, (_, _dash, char: string) => char.toUpperCase());
