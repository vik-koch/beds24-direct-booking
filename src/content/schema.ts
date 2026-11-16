import { z } from 'zod';

const segment = z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/);
const text = z.string().min(1);

const language = z.strictObject({
  code: z.string().regex(/^[a-z]{2}$/),
  name: text,
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
});

const unique = <T>(list: T[], key: (item: T) => unknown) =>
  new Set(list.map(key)).size === list.length;

export const siteSchema = z.strictObject({
  name: text,
  languages: z
    .array(language)
    .min(2)
    .refine((list) => unique(list, (l) => l.code), 'a language code is listed twice'),
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

export type Site = z.infer<typeof siteSchema>;
export type Language = Site['languages'][number];
export type Texts = z.infer<typeof textsSchema>;
