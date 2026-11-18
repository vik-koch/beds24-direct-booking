import { z } from 'zod';
import { letters, seasonNames } from './names.ts';

export { lucideName, seasonNames, type SeasonName } from './names.ts';

const segment = z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/);
const text = z.string().min(1);

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
      winter: z.strictObject({ start: day.optional(), hero: picture }).optional(),
      summer: z.strictObject({ start: day.optional(), hero: picture }).optional(),
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
  apartments: z
    .array(
      z.strictObject({
        slug: segment,
        roomId: z.number().int(),
        name: text.refine((value) => letters(value) <= 20, 'at most 20 characters'),
      }),
    )
    .min(1, 'at least one apartment')
    .max(4, 'at most four apartments')
    .refine((list) => unique(list, (a) => a.slug), 'an apartment slug is listed twice'),
  seasons,
  // The hero's features, in their order, each with a Lucide icon by its name on lucide.dev; the
  // content script checks it exists. Each language's texts name them by their keys.
  features: z
    .array(z.strictObject({ key: segment, icon: segment }))
    .max(5, 'at most five features')
    .refine((list) => unique(list, (f) => f.key), 'a feature key is listed twice'),
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
  notice: z
    .strictObject({ text, link: z.strictObject({ text, href: text }).optional() })
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
  // The free-weeks list. {season}, {count} and {amount} are filled in by the page.
  weeks: z.strictObject({
    week: text,
    guests: z.strictObject({ one: text, other: text }),
    size: z.strictObject({ shown: text, spoken: text }),
    taken: text,
    apartment: text,
    next: text,
    current: text,
    notOpen: text,
    full: text,
    unavailable: text,
    note: text,
    tax: z.strictObject({ night: text, stay: text }),
    continue: text,
    clear: text,
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
export type Site = Omit<z.infer<typeof siteSchema>, 'languages'> & { languages: Language[] };
