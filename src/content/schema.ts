import { z } from 'zod';
import { letters, seasonNames, type SeasonName } from './names.ts';

export { lucideName, seasonNames, type SeasonName } from './names.ts';

const segment = z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/);
// `#top` is the page's top, where the site name leads on the home page; the other names are the
// pages' own ids, which an anchor of the same name would lead to instead.
const taken = [
  'top',
  'content',
  'booking',
  'booking-title',
  'booking-season',
  'guests-note',
  'description',
  'amenities',
  'map-more',
];
const anchor = segment.refine(
  (value) => !taken.includes(value) && !value.startsWith('month-'),
  'taken by the pages: top, an id they hold, or month-…',
);
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

// An SVG file, such as the browser tab's icon while the season is shown.
const svg = z.string().regex(/^pictures\/[\w.-]+\.svg$/, 'not an SVG file in pictures/');

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

// A point in degrees, by its keys so that a pair copied from a map app cannot be swapped unnoticed.
const latitude = z.number().min(-90).max(90);
const longitude = z.number().min(-180).max(180);
interface Box {
  west: number;
  south: number;
  east: number;
  north: number;
}
export const inBox = (box: Box, { lat, lon }: { lat: number; lon: number }) =>
  lat >= box.south && lat <= box.north && lon >= box.west && lon <= box.east;

// The tiles' grid ends at 85° of latitude and at 180° east, which is its first column again.
const boxLatitude = z.number().min(-85).max(85);
const boxLongitude = z.number().min(-180).lt(180);
// A span of 0.1° given in decimals, such as 47.3 to 47.4, comes out a hair above it.
const span = 0.1 + 1e-9;

// The map: the box its tiles cover and the places it marks, each with a Lucide icon for its kind,
// shown always or only behind the switch for more places. Each language's texts name them.
const map = z
  .strictObject({
    box: z
      .strictObject({
        west: boxLongitude,
        south: boxLatitude,
        east: boxLongitude,
        north: boxLatitude,
      })
      .refine((b) => b.west < b.east && b.south < b.north, 'west and south below east and north')
      .refine((b) => b.east - b.west <= span && b.north - b.south <= span, 'at most 0.1° each way'),
    places: z
      .array(
        z.strictObject({
          key: segment,
          icon: segment,
          lat: latitude,
          lon: longitude,
          more: z.literal(true).optional(),
        }),
      )
      .min(1, 'at least one place')
      .max(10, 'at most ten places')
      .refine((list) => unique(list, (place) => place.key), 'a place key is listed twice'),
  })
  .superRefine(({ box, places }, context) =>
    places.forEach((place, index) => {
      if (!inBox(box, place))
        context.addIssue({ code: 'custom', path: ['places', index], message: 'outside the box' });
    }),
  );

// With two seasons each starts on its day and lasts until the other starts; a single season
// covers the year and has no start.
const seasons = z
  .strictObject(
    {
      winter: z.strictObject({ start: day.optional(), hero: picture, icon: svg }).optional(),
      summer: z.strictObject({ start: day.optional(), hero: picture, icon: svg }).optional(),
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
  map: map.optional(),
});

// An apartment's floor plan: an SVG drawing in pictures/, its alternative text in each of the
// site's languages by tag, and the zones a visitor chooses on it. A zone has its name in each
// language, its polygon's corners and the point its name is centred on, each as [x, y] in the
// drawing's coordinates; the content script checks the drawing, the languages and the points.
const point = z.tuple([z.number(), z.number()]);
const plan = z.strictObject({
  file: svg,
  alt: z.record(z.string(), text),
  zones: z
    .array(
      z.strictObject({
        key: segment,
        name: z.record(z.string(), text),
        points: z.array(point).min(3, 'at least three points'),
        label: point,
      }),
    )
    .min(1, 'at least one zone')
    .refine((list) => unique(list, (zone) => zone.key), 'a zone key is listed twice'),
});

// An apartment's pictures in their order: a file in the content folder's pictures/ or an https
// address, such as a Beds24 picture's, and its alternative text in each of the site's languages
// by tag; the content script checks the languages and converts the pictures. A picture with a
// season shows in that season only; each season's gallery is the list without the other's. A
// picture names the plan's zones it shows.
export const apartmentSchema = z.strictObject({
  roomId: z.number().int(),
  // Where a guest leaves the house; given with a map and only then.
  lat: latitude.optional(),
  lon: longitude.optional(),
  // Its name on the map left of its pin, for one that would cover a neighbour's.
  mapLabel: z.literal('left').optional(),
  // The points a route to a place goes through in their order, by the place's key.
  via: z
    .record(segment, z.array(z.strictObject({ lat: latitude, lon: longitude })).min(1))
    .optional(),
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
        zones: z
          .array(segment)
          .min(1)
          .refine((list) => unique(list, (key) => key), 'a zone is listed twice')
          .optional(),
      }),
    )
    .min(1, 'at least one picture'),
  plan: plan.optional(),
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
    weeks: anchor,
    apartments: anchor,
    location: anchor,
    about: anchor,
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
  // The pictures' mosaic and viewer; {index} counts from 1. With a floor plan: its name, on its
  // cell and its view, the photos' view, and the name of its zones' choice.
  gallery: z.strictObject({
    name: text,
    position: text,
    previous: text,
    next: text,
    more: z.strictObject({ one: text, other: text }),
    plan: text,
    photos: text,
    zones: text,
  }),
  // The names of the areas and the rooms site.json lists, and the labels of Beds24's codes: the
  // amenities' and the beds' and fittings' in a room.
  amenities: z.strictObject({
    areas: z.record(segment, text),
    codes: z.record(text, text),
    rooms: z.record(text, text),
  }),
  // The map's wording: the panel's, MapLibre's own (its title, controls and the hints shown when
  // a scroll or one finger would move the map), and each place by its key with its name and a
  // text for each season the site lists.
  map: z
    .strictObject({
      label: text,
      from: text,
      more: text,
      zoomIn: text,
      zoomOut: text,
      reset: text,
      attribution: text,
      gestures: z.strictObject({ windows: text, mac: text, touch: text }),
      places: z.record(
        segment,
        z.strictObject({ name: text, winter: text.optional(), summer: text.optional() }),
      ),
    })
    .optional(),
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
  zones?: string[];
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
// A floor plan as the page draws it: its file's address, its viewBox as [x, y, width, height],
// and its texts by address prefix.
export interface Plan {
  url: string;
  viewBox: [number, number, number, number];
  alt: Record<string, string>;
  zones: {
    key: string;
    name: Record<string, string>;
    points: [number, number][];
    label: [number, number];
  }[];
}
export type Apartment = { slug: string; pictures: Picture[]; plan?: Plan } & Omit<
  z.infer<typeof apartmentSchema>,
  'pictures' | 'via' | 'plan'
>;
type Map = NonNullable<z.infer<typeof siteSchema>['map']>;
// A walking route as the map draws it: its line as [longitude, latitude] pairs.
export interface Route {
  apartment: string;
  place: string;
  meters: number;
  line: [number, number][];
}
// An aerial lift as OpenStreetMap tags it: its kind, such as gondola or t-bar, and its local name.
export interface Lift {
  kind: string;
  name?: string;
  line: [number, number][];
}
export type Site = Omit<
  z.infer<typeof siteSchema>,
  'languages' | 'apartments' | 'seasons' | 'map'
> & {
  // The tiles' address, /map/tiles/<build>, by the Protomaps build they were cut from, and the
  // theme's font file, in which the map writes its labels.
  map?: Map & { tiles: string; font: string };
  languages: Language[];
  apartments: Apartment[];
  seasons: { [name in keyof Seasons]: Omit<NonNullable<Seasons[name]>, 'hero'> & { hero: Hero } };
};
