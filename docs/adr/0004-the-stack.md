# ADR 4: The stack

Status: proposed, 2026-11-12. Group: stack.

## Context

ADR 1 decided what is built: a small site that reads from Beds24 and hands over to its guest
form. The brief adds the shape: one Node process, pages rendered on the server, two languages
per deployment, two seasons, content from files, no database. This ADR fixes what it is built
with. What weighs on the choices:

- **One developer and coding agents** build and maintain it. Angular is the framework the
  developer knows; the new parts are the workflow and the UI.
- **Wording is content, never code,** and a private deployment has its own two languages and
  its own content, built from a public tag.
- **The look is designed for this site,** with two season palettes. A library's look would be
  in the way.
- **The week grid is the hard control:** a grid of weeks by apartment that must work by
  keyboard and with a screen reader.
- **Few dependencies,** each one a thing to update, on a site that should run for years. But
  not at the price of building by hand what a maintained library does well.

## Decision

1. **Angular 22 as one application,** standalone components, signals, without zone.js.
   TypeScript in the version the Angular CLI pins, Node 24, npm.
2. **Server-side rendering with `@angular/ssr`** on the Express server the CLI generates. Pages
   with listings or weeks are rendered per request, the others prerendered, as the brief says.
   The availability route and the preview lock live in the same server.
3. **Languages are keyed text files in the deployment's content,** one per language, with the
   language as the first URL segment. The templates read them as a typed object; numbers,
   dates and plurals are formatted with the platform's `Intl`. No translation library and not
   Angular's built-in i18n.
4. **Tailwind 4 for styling,** with the design tokens as CSS variables, so that a season is one
   attribute on the page.
5. **spartan/ui for the components:** dialog, sheet, accordion, carousel and the like, each
   copied into the project when it is first needed and themed through those variables.
6. **The week grid's behaviour is decided by a spike** before its slice, see the conditions.
7. **Vitest for unit tests** through `ng test`, **Playwright for e2e** with axe, as the working
   agreements describe.
8. **Prettier formats and ESLint lints.** Their plugins are set up in the scaffold.
9. **One Zod schema validates a deployment's content at build time,** texts of both languages
   included, so a missing key or a picture without alternative text fails the build.

The icon set is chosen in the design round. The simulator's own choices are made in its issue;
hosting and delivery get an ADR with the first deployment.

## Languages: options

The site needs little here: an estimated hundred interface texts in two languages, a few of them
with a number in them. The language is part of the address, so it never changes inside a
running page. Guides, season texts and legal pages are content files in any case.

<!-- prettier-ignore -->
| Option | For | Against | Result |
|---|---|---|---|
| Angular's built-in i18n, compiled in | Part of the framework. Plural and select forms. No cost at runtime. | The source text sits in the templates, so wording would be code, and a deployment with two other languages would translate from the demo's. One version of the app is built per language. | Rejected. |
| Angular's built-in i18n, translations loaded at runtime | One build. The same plural forms. | The source text still sits in the templates. A message is translated once, when it is first met, and the documentation rules out changing the language without a reload; one server process that renders both languages would need exactly that. | Rejected. |
| ngx-translate | The most used library for this, current and signal-based, with a pipe, parameters and a recipe for server rendering. Keyed JSON files, which is the shape the content has anyway. | Keys are strings, so a mistyped key shows up on the page, not in the build. Loading has to be wired for server and browser so that hydration sees the same texts. Plural forms are not built in; they need a compiler plugin and message syntax in the files. Its switching of languages at runtime is not needed here. | Runner-up. |
| Transloco | Much the same, with plugins for plural forms and for dates and currency. | The same string keys and wiring. Used less, and its page on server rendering still describes Angular Universal. | Not pursued. |
| Keyed text files, read as a typed object | One mechanism for all wording. The schema checks that both languages have every key, and the compiler checks every key a template uses. Nothing to wire for hydration: the texts are part of the language's code. No dependency. | Three things are our own code, each a few lines: providing the language's texts, putting a value into a text, and choosing the plural form with `Intl.PluralRules`. No select or nested forms. | Chosen. |

The files have the same shape for the chosen option and for ngx-translate. If the texts come
to need more than a number and its plural form, the move is a change to how templates read
them, not to the content.

## Components: options

<!-- prettier-ignore -->
| Option | For | Against | Result |
|---|---|---|---|
| Angular Material | Complete and maintained by the Angular team. | Brings its own look, which this site would spend its time overriding. | Rejected. |
| Native elements with our own CSS, Angular Aria for behaviour | No library's look and the fewest dependencies. `<dialog>`, `<details>` and the popover attribute do much by themselves. | Animation, positioning, swipe and the many small states of a dialog, a sheet or a carousel would be designed and written here. That is easy to underestimate, and the result is unlikely to look as finished. | Rejected. |
| spartan/ui | Ready components with their behaviour, animation and states, copied into the project and styled with Tailwind. Colours and radius are CSS variables, so a season palette is a set of values. Only what is used is copied. It supports Angular 21 and 22. | The copies are ours to keep when the library moves on. It brings its own package, the CDK, clsx and an animation package. Its components follow one design, and what the design round changes beyond colour and radius is edited in the copies. | Chosen. |

## What this rests on

Nothing has been built yet. On 2026-11-12:

- **Read from package metadata on npm:** Angular 22.2 is current. `@angular/build` accepts
  TypeScript 6.0 and Vitest 4 or 5. spartan/ui's package asks for Angular 21 or 22, the CDK,
  clsx and tw-animate-css, and for luxon only optionally. Angular Aria is published in
  Angular's version and depends on the CDK. ngx-translate is at 18.1.0, published in October
  2026, and Transloco at 8.4.0. In the week before, npm counted about 1.8 million downloads of
  ngx-translate and 0.5 million of Transloco.
- **Read from the CLI's own help, version 22.0.6:** Vitest is the default test runner, and
  `ng new` has options for server-side rendering, Tailwind and an application without zone.js.
- **Taken from documentation:** runtime translations are applied once per message and do not
  allow changing the language without a reload
  ([loadTranslations](https://angular.dev/api/localize/loadTranslations)). Built-in i18n
  writes each language to its own directory
  ([deployment](https://angular.dev/guide/i18n/deploy)). ngx-translate's set-up and its recipe
  for server rendering ([ngx-translate.org](https://ngx-translate.org/recipes/ssr-and-prerender/)).
  spartan/ui's components, set-up and variables
  ([installation](https://www.spartan.ng/documentation/installation),
  [theming](https://www.spartan.ng/documentation/theming)). Angular Aria's grid
  ([grid](https://angular.dev/guide/aria/grid)). Unit tests run in Node with jsdom
  ([testing](https://angular.dev/guide/testing)), and the server in the rendering guide is
  built on Express ([SSR](https://angular.dev/guide/ssr)).
- **Not checked:** how ngx-translate and Transloco behave in this application, since neither
  was tried; Angular Material beyond what is commonly known of it; how much of spartan/ui's
  design the design round will want to change.

## Conditions

- **The week grid is decided by a spike,** once the scaffold exists and before its slice. It
  is a grid of weeks by apartment, which no library offers ready. The spike compares building
  it from spartan/ui's calendar or table with Angular Aria's grid pattern, which is released
  with Angular and needs only the CDK that spartan/ui brings anyway. It is judged by keyboard,
  with VoiceOver on a real iPhone, and at 320 px. The result is recorded here.
- **The typed texts are confirmed in the first slice with a counted text.** If the three
  helpers grow beyond a few lines each, ngx-translate takes over.

## Consequences

- **A text is added in two places at once:** a key in each language's file. The build fails
  until both have it.
- **Templates hold no wording,** only keys, which also keeps the demo's languages out of the
  code a private deployment builds from.
- **Each language's texts are loaded only for that language,** so a page does not carry both.
- **A component enters the project when a slice needs it,** as copied code that is then ours
  to read, restyle and review.
- **An Angular update waits for spartan/ui** to allow the new major version.
- **The TypeScript version follows the CLI,** not the newest release.
- **Content, pictures and theme values are build inputs,** read from one directory per
  deployment. At runtime the server reads only the Beds24 address and token, the preview
  password and the indexing flag.
