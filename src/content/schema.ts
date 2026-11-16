import { z } from 'zod';

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

export const siteSchema = z.strictObject({
  name: text,
  languages: z
    .array(tag)
    .min(2)
    // Runs on invalid tags too, which the tag check reports.
    .refine(
      (list) => unique(list, (value) => value.split('-')[0].toLowerCase()),
      'two languages would share one address prefix',
    ),
  apartments: z
    .array(z.strictObject({ slug: segment, roomId: z.number().int(), name: text }))
    .refine((list) => unique(list, (a) => a.slug), 'an apartment slug is listed twice'),
  contact: z.strictObject({
    name: text,
    address: z.array(text).min(1),
    phone: text,
    email: z.email(),
  }),
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
  home: z.strictObject({ title: text }),
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
