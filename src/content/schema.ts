import { z } from 'zod';
import { letters, seasonNames, type SeasonName } from './names.ts';

export { lucideName, seasonNames, type SeasonName } from './names.ts';

const segment = z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/);
const text = z.string().refine((value) => value.trim() !== '', 'empty or only spaces');

const unique = <T>(list: T[], key: (item: T) => unknown) =>
  new Set(list.map(key)).size === list.length;

// A BCP 47 tag in its canonical form, such as de-AT or en-GB.
const tag = z.string().refine((value) => {
  try {
    return Intl.getCanonicalLocales(value)[0] === value;
  } catch {
    return false;
  }
}, 'not a language tag in its canonical form, such as de-AT');

// The address prefix: the tag's language, de for de-AT.
export const prefix = (value: string) => new Intl.Locale(value).language;

// A day of the year as MM-DD. 29 February is refused: a season would start only in leap years.
const day = z
  .string()
  .regex(/^(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/, 'not a day as MM-DD')
  .refine((value) => {
    const [month, date] = value.split('-').map(Number);
    return value !== '02-29' && date <= new Date(Date.UTC(2025, month, 0)).getUTCDate();
  }, 'not a day of every year');

// What was done to a credited picture; each language's texts name them.
export const changeNames = ['cropped', 'scaled'] as const;

// The browser tab's icon while the season is shown.
const icon = z.string().regex(/^pictures\/[\w.-]+\.svg$/, 'not an SVG file in pictures/');

// A file in the content folder's pictures/, and who to credit for it.
const picture = z.strictObject({
  file: z.string().regex(/^pictures\/[\w.-]+$/, 'not a file in pictures/'),
  credit: z
    .strictObject({
      title: text,
      author: text,
      source: z.url(),
      licence: z.strictObject({ name: text, url: z.url() }),
      changes: z
        .array(z.enum(changeNames))
        .min(1)
        .refine((list) => unique(list, (change) => change), 'a change is listed twice')
        .optional(),
    })
    .optional(),
});

// With two seasons each starts on its day and lasts until the other starts; a single season
// covers the year and has no start.
const seasons = z
  .strictObject(
    {
      winter: z.strictObject({ start: day.optional(), hero: picture, icon }).optional(),
      summer: z.strictObject({ start: day.optional(), hero: picture, icon }).optional(),
    },
    {
      error: (issue) =>
        issue.code === 'unrecognized_keys' ? 'only winter and summer, one or both' : undefined,
    },
  )
  .superRefine((value, context) => {
    const listed = seasonNames.filter((name) => value[name]);
    if (listed.length === 0) context.addIssue({ code: 'custom', message: 'no season is listed' });
    for (const name of listed) {
      const start = value[name]?.start;
      if (listed.length === 2 && !start)
        context.addIssue({
          code: 'custom',
          path: [name, 'start'],
          message: 'two seasons need a start each',
        });
      if (listed.length === 1 && start)
        context.addIssue({
          code: 'custom',
          path: [name, 'start'],
          message: 'a single season covers the year and has no start',
        });
    }
    if (listed.length === 2 && value.winter?.start === value.summer?.start)
      context.addIssue({
        code: 'custom',
        path: ['summer', 'start'],
        message: 'both seasons start on one day',
      });
  });

// The limits docs/content.md lists, each with its reason there.
export const siteSchema = z.strictObject({
  name: text.refine((value) => letters(value) <= 15, 'at most 15 characters'),
  languages: z
    .array(tag)
    .length(2, 'exactly two languages')
    // Runs on invalid tags too, which the tag check reports.
    .refine(
      (list) => unique(list, (value) => value.split('-')[0].toLowerCase()),
      'two languages would share one address prefix',
    ),
  // Each slug names a file of its own, apartments/<slug>.json; the order is the site's.
  apartments: z
    .array(segment)
    .min(1, 'at least one apartment')
    .max(4, 'at most four apartments')
    .refine((list) => unique(list, (slug) => slug), 'an apartment slug is listed twice'),
  seasons,
  // The hero's features, in their order, each with a Lucide icon by its name on lucide.dev; the
  // content script checks it exists. Each language's texts name them by their keys.
  features: z
    .array(z.strictObject({ key: segment, icon: segment }))
    .max(5, 'at most five features')
    .refine((list) => unique(list, (f) => f.key), 'a feature key is listed twice'),
  // The apartment page's features: Beds24's codes sorted into areas, each with a Lucide icon,
  // in their order, or a code standing alone with its own. Each language's texts name the
  // areas and the codes. A code listed nowhere is not shown.
  amenities: z
    .array(
      z.union([
        z.strictObject({ code: text, icon: segment }),
        z.strictObject({ area: segment, icon: segment, codes: z.array(text).min(1) }),
      ]),
    )
    .refine(
      (list) =>
        unique(
          list.flatMap((entry) => ('code' in entry ? [entry.code] : entry.codes)),
          (code) => code,
        ),
      'a code is listed twice',
    ),
  // The rooms the apartment page names, by the code that opens a Beds24 room group, such as
  // BEDROOM, each with a Lucide icon. Each language's texts name them. A group whose code is
  // listed nowhere is not a room: its codes count as amenities.
  rooms: z
    .array(z.strictObject({ code: text, icon: segment }))
    .refine((list) => unique(list, (room) => room.code), 'a room code is listed twice'),
  // The footer shows what is listed, and no contact without one: a site may give its details
  // on its imprint page instead.
  contact: z
    .strictObject({
      name: text.optional(),
      address: z.array(text).min(1).optional(),
      phone: text.optional(),
      email: z.email().optional(),
    })
    .refine((value) => Object.keys(value).length > 0, 'lists nothing: leave the contact out')
    .optional(),
});

// An apartment's pictures in their order: a file in the content folder's pictures/ or an https
// address, such as a Beds24 picture's, and its alternative text in each of the site's languages
// by tag; the content script checks the languages and converts the pictures. A picture with a
// season shows in that season only; each season's gallery is the list without the other's.
export const apartmentSchema = z.strictObject({
  roomId: z.number().int(),
  name: text.refine((value) => letters(value) <= 20, 'at most 20 characters'),
  pictures: z
    .array(
      z.strictObject({
        file: z
          .string()
          .regex(
            /^(pictures\/[\w.-]+|https:\/\/\S+)$/,
            'not a file in pictures/ or an https address',
          ),
        alt: z.record(z.string(), text),
        // Made by an image model: the page labels it so.
        generated: z.literal(true).optional(),
        season: z.enum(seasonNames).optional(),
      }),
    )
    .min(1, 'at least one picture'),
});

export const textsSchema = z.strictObject({
  paths: z.strictObject({
    apartments: segment,
    book: segment,
    confirmation: segment,
    faq: segment,
    about: segment,
    imprint: segment,
    privacy: segment,
    terms: segment,
    credits: segment,
  }),
  anchors: z.strictObject({
    weeks: segment,
    apartments: segment,
    location: segment,
    about: segment,
  }),
  skip: text,
  // A link within the site is a path from its root, which carries the visitor's choices; any
  // other is a full https address.
  notice: z
    .strictObject({
      text,
      link: z
        .strictObject({
          text,
          href: z.union([
            z.string().regex(/^\/(?!\/)/, 'a path from the root'),
            z.url({ protocol: /^https$/, hostname: z.regexes.domain }),
          ]),
        })
        .optional(),
    })
    .optional(),
  nav: z.strictObject({
    label: text,
    weeks: text,
    apartments: text,
    allApartments: text,
    location: text,
    about: text,
    language: text,
    menu: text,
    close: text,
  }),
  // The names of the seasons site.json lists, and no other; the content script checks it.
  seasons: z.strictObject({ label: text, winter: text.optional(), summer: text.optional() }),
  home: z.strictObject({ title: text }),
  hero: z.strictObject({
    // The photo's alternative text per season.
    winter: text.optional(),
    summer: text.optional(),
    lead: text,
    // The text of each feature site.json lists, by its key; the content script checks the keys.
    features: z.record(segment, text),
    button: text,
  }),
  pages: z.strictObject({
    book: text,
    confirmation: text,
    faq: text,
    about: text,
    imprint: text,
    privacy: text,
    terms: text,
    credits: text,
  }),
  credits: z.strictObject({
    lead: text,
    author: text,
    licence: text,
    none: text,
    // The content script checks that each change a credit lists is named here.
    changes: z.strictObject({ cropped: text.optional(), scaled: text.optional() }).optional(),
  }),
  // The free-weeks list. {season}, {count}, {amount}, {guests} and {price} are filled in by the
  // page.
  weeks: z.strictObject({
    week: text,
    guests: z.strictObject({ one: text, other: text }),
    size: z.strictObject({ shown: text, spoken: text }),
    taken: text,
    // An apartment too small for the chosen guests: in its cells, and on its card.
    small: text,
    smallFor: text,
    // In a bar, in place of the price: a chosen week booked or passed since.
    gone: text,
    apartment: text,
    next: text,
    current: text,
    notOpen: text,
    // Its first sentence alone, for the home page's cards.
    notOpenShort: text,
    full: text,
    unavailable: text,
    note: text,
    tax: z.strictObject({ night: text, stay: text }),
    clear: text,
  }),
  // The apartment page. {count}, {from} and {until} are filled in by the page.
  apartment: z.strictObject({
    back: text,
    guests: z.strictObject({ one: text, other: text }),
    bedrooms: z.strictObject({ one: text, other: text }),
    more: text,
    rooms: text,
    features: text,
    allFeatures: text,
    goodToKnow: text,
    times: text,
    // By the bounds Beds24 sets: both, only the start or only the end.
    checkIn: z.strictObject({ both: text, from: text, until: text }),
    checkOut: text,
    houseRules: text,
    unavailable: text,
    generated: text,
  }),
  // The apartment page's booking panel. {season}, {age}, {price}, {stay}, {guests}, {nights},
  // {amount}, {count} and {name} are filled in by the page.
  panel: z.strictObject({
    title: text,
    views: z.strictObject({ label: text, list: text, calendar: text }),
    previous: text,
    next: text,
    guests: text,
    adults: z.strictObject({ label: text, one: text, other: text }),
    children: text,
    // Who counts as a child and how babies are counted, beside the counts; an asterisk points
    // to it. Beds24 has no age: where a child ends depends on the place, usually on its tax.
    guestsNote: text.optional(),
    // The apartment is too small for the chosen guests.
    small: text,
    from: text,
    week: text,
    tax: z.strictObject({ night: text, stay: text }),
    total: text,
    book: text,
    choose: text,
    bar: z.strictObject({ choose: text, book: text }),
  }),
  // The pictures' mosaic and viewer; {index} counts from 1.
  gallery: z.strictObject({
    name: text,
    position: text,
    previous: text,
    next: text,
    more: z.strictObject({ one: text, other: text }),
  }),
  // The names of the areas and the rooms site.json lists, and the labels of Beds24's codes: the
  // amenities' and the beds' and fittings' in a room.
  amenities: z.strictObject({
    areas: z.record(segment, text),
    codes: z.record(text, text),
    rooms: z.record(text, text),
  }),
  placeholder: text,
  notFound: z.strictObject({ title: text, text, home: text }),
  footer: z.strictObject({ label: text, contact: text, more: text }),
});

export type Texts = z.infer<typeof textsSchema>;

// A language as the application uses it: its tag, its address prefix, its own name, and its
// address parts from its texts file.
export type Language = { tag: string; code: string; name: string } & Pick<
  Texts,
  'paths' | 'anchors'
>;
// A converted picture: its alternative text by address prefix, the size of its widest file, and
// each file by its width, narrowest first.
export interface Picture {
  alt: Record<string, string>;
  generated?: true;
  season?: SeasonName;
  width: number;
  height: number;
  sources: { width: number; url: string }[];
}
type Files = Pick<Picture, 'width' | 'height' | 'sources'>;
type Seasons = z.infer<typeof siteSchema>['seasons'];
// A season's hero photo as converted files, its centre crop of 3:4 too unless it is that narrow,
// and its credit.
export type Hero = Files & {
  portrait?: Files;
  credit?: NonNullable<Seasons['winter']>['hero']['credit'];
};
export type Apartment = { slug: string; pictures: Picture[] } & Omit<
  z.infer<typeof apartmentSchema>,
  'pictures'
>;
export type Site = Omit<z.infer<typeof siteSchema>, 'languages' | 'apartments' | 'seasons'> & {
  languages: Language[];
  apartments: Apartment[];
  seasons: { [name in keyof Seasons]: Omit<NonNullable<Seasons[name]>, 'hero'> & { hero: Hero } };
};
