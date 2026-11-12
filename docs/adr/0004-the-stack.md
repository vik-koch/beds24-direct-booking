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
- **Few dependencies,** each one a thing to update, on a site that should run for years.

## Decision

1. **Angular 22 as one application,** standalone components, signals, without zone.js.
   TypeScript in the version the Angular CLI pins, Node 24, npm.
2. **Server-side rendering with `@angular/ssr`** on the Express server the CLI generates. Pages
   with listings or weeks are rendered per request, the others prerendered, as the brief says.
   The availability route and the preview lock live in the same server.
3. **Languages are keyed text files in the deployment's content,** one per language, with the
   language as the first URL segment. Numbers, dates and plurals are formatted with the
   platform's `Intl`. Angular's built-in i18n is not used.
4. **Tailwind 4 for styling,** with the design tokens as CSS variables, so that a season is one
   attribute on the page.
5. **Angular Aria for interactive patterns, native HTML for the rest.** Aria supplies the
   behaviour of the week grid, the accordion, menus and selects without any look; `<dialog>`,
   `<details>` and the popover attribute cover what it does not have. No component library.
6. **Vitest for unit tests** through `ng test`, **Playwright for e2e** with axe, as the working
   agreements describe.
7. **Prettier formats,** with one plugin that sorts imports and Tailwind's plugin that sorts
   classes. **ESLint lints,** with angular-eslint and a Tailwind plugin that reports unknown
   and conflicting classes.
8. **One Zod schema validates a deployment's content at build time,** texts of both languages
   included, so a missing key or a picture without alternative text fails the build.

The icon set is chosen in the design round. The simulator's own choices are made in its issue;
hosting and delivery get an ADR with the first deployment.

## Languages: options

<!-- prettier-ignore -->
| Option | For | Against | Result |
|---|---|---|---|
| Angular's built-in i18n | Part of the framework. Texts are compiled in, with plural and select forms. | The source text sits in the templates, so wording would be code, and a deployment with two other languages would translate from the demo's. It builds one version of the app per language. Guides and season texts are content files anyway, so there would be two mechanisms. | Rejected. |
| A translation library (Transloco) | Keyed files, loaded per language, made for this. | A dependency for what a typed object from the content files does. Not tried. | Not pursued. |
| Keyed text files in the content | One mechanism for all wording. The content schema checks that both languages have every key, and gives the templates typed access. A private deployment brings its languages with its content. | Loading the texts per language is our own code. Plural forms are written by hand with `Intl.PluralRules`. | Chosen. |

## UI primitives: options

<!-- prettier-ignore -->
| Option | For | Against | Result |
|---|---|---|---|
| Angular Material | Complete and maintained by the Angular team. | Brings its own look, which this site would spend its time overriding. | Rejected. |
| spartan/ui, the candidate in the brief | Many ready components, copied into the project and styled with Tailwind: dialog, sheet, carousel, accordion and more. | The copied styles are a look to rework for two palettes, and the copies are ours to maintain. It needs its own package plus the CDK, luxon, clsx and an animation package, and allows Angular below 23. Its list has no grid pattern for the week grid. | Rejected. |
| Angular Aria with native HTML | Behaviour only, so the look is entirely the design round's. It has a grid pattern with arrow keys, spans, disabled cells and selection, and test harnesses. It is released with Angular, in the same version, and depends on the CDK alone. | Fewer patterns: no dialog, tooltip or carousel, which fall to native elements and CSS. Introduced with Angular 21, so young. | Chosen. |
| Everything self-built | No dependency. | Keyboard and screen reader behaviour of a grid is easy to get wrong. | Rejected. |

## What this rests on

Nothing has been built yet. On 2026-11-12:

- **Read from package metadata on npm:** Angular 22.2 is current, and Angular Aria is published
  in the same version and depends on the CDK. `@angular/build` accepts TypeScript 6.0 and
  Vitest 4 or 5. spartan/ui's package asks for Angular 21 or 22, the CDK, luxon, clsx and
  tw-animate-css. angular-eslint accepts ESLint 9 and 10.
- **Read from the CLI's own help, version 22.0.6:** Vitest is the default test runner, and
  `ng new` has options for server-side rendering, Tailwind and an application without zone.js.
- **Taken from documentation:** Angular Aria's patterns and the grid's behaviour
  ([overview](https://angular.dev/guide/aria/overview),
  [grid](https://angular.dev/guide/aria/grid)); neither page marks it as a preview. Unit tests run in Node with jsdom
  ([testing](https://angular.dev/guide/testing)). The server in the rendering guide is built
  on Express ([SSR](https://angular.dev/guide/ssr)). Built-in i18n writes each language to its own
  directory ([deployment](https://angular.dev/guide/i18n/deploy)). spartan/ui's components and
  set-up ([installation](https://www.spartan.ng/documentation/installation)). The Tailwind lint
  plugin, eslint-plugin-better-tailwindcss, lists Angular templates as supported.
- **Not checked:** Transloco, and Angular Material beyond what is commonly known of it.

## Conditions

Two choices are confirmed by building, and reversed here if they fail:

- **The week grid on Angular Aria's grid,** in the first slice that has it: by keyboard, and
  with VoiceOver on a real iPhone. If it does not hold, the grid's behaviour is written for
  this one control.
- **The Tailwind lint plugin on Angular templates,** in the scaffold. If it cannot read them,
  it is dropped; the class order is Prettier's job either way.

## Consequences

- **A text is added in two places at once:** a key in each language's file. The build fails
  until both have it.
- **Templates hold no wording,** only keys, which also keeps the demo's languages out of the
  code a private deployment builds from.
- **Each language's texts are loaded only for that language,** so a page does not carry both.
- **Dialogs, disclosure and the picture gallery are native elements with CSS.** Their
  accessibility is checked by axe and by keyboard like everything else.
- **Angular Aria and the CDK move with Angular,** so an Angular update is one step, not a wait
  for a third party.
- **The TypeScript version follows the CLI,** not the newest release.
- **Content, pictures and theme values are build inputs,** read from one directory per
  deployment. At runtime the server reads only the Beds24 address and token, the preview
  password and the indexing flag.
