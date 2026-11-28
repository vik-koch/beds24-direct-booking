# ADR 20: The booking form is a Signal Form with spartan/ui's fields, checked by plain functions

Status: accepted, 2026-11-27. Group: stack. Builds the form
[ADR 19](0019-the-booking-form-asks-what-beds24-asks.md) settles.

## Context

The booking form's fields come from each property's booking questions in Beds24: up to 16 guest
fields and 10 questions of six kinds, in Beds24's order, each required or optional. What weighs on
how it is built:

- **Each field has a visible label, the browser's `autocomplete`, and an error that names the field
  and the fix** (WCAG 2.2 AA), shown once the guest has left the field or pressed the button, and
  read with the field by a screen reader.
- **The browser fills in name, e-mail, phone and address** only into a native `<input>`, `<select>`
  or `<textarea>` with the right `autocomplete`.
- **The answers are checked in the form and again on the server** (#349), with the same rules and
  words.
- **Only the booking step loads the form:** its route is a chunk of its own, and every other page
  should carry as little of it as possible. The budget for the initial bundle is 780 kB.
- **The stack** ([ADR 4](0004-the-stack.md)) is Angular 22 with spartan/ui, whose brain package is
  already a dependency for the select and the sheet.

## Decision

1. **Angular's Signal Forms** (`@angular/forms/signals`, stable since Angular 22) on a
   `form[formRoot]`, which sets `novalidate` so that only the site's errors show. The answers are
   one signal, keyed by the question.
2. **The answers are checked once the button is pressed,** then as the guest types. Before, no field
   is invalid, so a screen reader does not call an empty field invalid on its first visit. An error
   shown on leaving a field would push the button down under a pointer pressing it, and the press
   would be lost. A failed submit moves the focus to the first field with an error.
3. **spartan/ui's field, label, input, textarea and checkbox,** copied from v1.9.0 into `src/ui/`.
   Brain reads a Signal Forms field's state itself: it marks an invalid field, sets `aria-invalid`,
   and links a shown error to its control with `aria-describedby`. Their look is in `src/ui/ui.css`;
   Tailwind does not generate their utility classes, whose `outline-none` would hide the focus ring
   and which would add 6 kB to every page's styles. The field directive's variants are kept without
   class-variance-authority, which the site does not depend on.
4. **Native controls where the browser fills them in or answers them:** the country is a
   `<select autocomplete="country">` and a question of choices a `<select>`, both with the input's
   look; a date and the arrival time are `<input type="date">` and `<input type="time">`. A list,
   which Beds24's own page shows as radio buttons (`multipleList`), is a `<select>` too: one control
   for both, and its first entry undoes an optional choice, which a radio button cannot.
5. **Each answer's check is a plain function,** one per question, which returns its error in the
   page's language or nothing (`src/app/answers.ts`). The form runs them through Signal Forms'
   `validate`; the server runs the same functions (#349). They check:
   - a required answer is given, a ticked box ticked, a choice one of the question's;
   - an e-mail address has a name, an at sign and a domain with a dot;
   - a phone, mobile or fax number has a length and a start its country's numbers have, by
     **libphonenumber-js**'s data: with its country code, or written as at home in the country the
     guest chose, so that "06 12 34 56 78" with France is whole; its signs (spaces, brackets, dots,
     slashes, hyphens) stand between digits only. The field shows a mobile number of the chosen
     country, else of the page's language's region, from libphonenumber-js's examples, as its
     placeholder and in its error;
   - a first name and a surname have no digit;
   - a country is one of ISO 3166's codes, a date a day of the calendar, an arrival time a time.

   Left unchecked on purpose: whether an e-mail address or a number is in use, which Beds24's
   confirmation and the host's call tell; whether a mobile number is a mobile's, which some
   countries do not tell apart; a name's letters beyond digits, a street, a town and a postcode,
   whose forms differ by country more than a check could know, and which Beds24 takes as text.

## Options

<!-- prettier-ignore -->
| Option | For | Against | Result |
|---|---|---|---|
| Reactive forms | Mature; spartan/ui's brain was built for them. | A form group built from data by hand, values and status as observables beside the signals the rest of the site uses. | Rejected. |
| A plain form with own state | No forms package in the chunk. | Touched, dirty, errors, focus and the link between a field and its error written by hand; brain's fields could not read them. | Rejected. |
| Signal Forms | The answers are a signal; touched, errors and the first error's focus come with it; brain reads its state. | Released as stable in Angular 22, so young; its control integration lives in `@angular/core` and loads on every page. | Chosen. |

For the checks:

<!-- prettier-ignore -->
| Option | For | Against | Result |
|---|---|---|---|
| A zod/mini schema, through Signal Forms' `validateStandardSchema` | One schema object, the standard interface. zod is already a dependency of the content build. | Every rule is a custom check, so zod only carries them. Its async support brings Angular's `resource` into the initial bundle. Measured below. | Tried, rejected. |
| Plain functions through `validate` | The same rules and words in the form and on the server, without a library in the browser. | Signal Forms' standard interface is not used; a new rule is written by hand. | Chosen. |

For a phone number:

<!-- prettier-ignore -->
| Option | For | Against | Result |
|---|---|---|---|
| Digits and the signs between them, six at least | No data. | A number written as at home ("06…") cannot tell its country; a mistyped number of the right signs passes. | Replaced. |
| A country code chosen apart from the number, with a mask | The country always known. | The browser fills a whole number into one field; a mask gets in the way of pasting. | Rejected. |
| libphonenumber-js, its smaller data | Every country's lengths and starts; a number read in the guest's chosen country. | About 116 kB raw (24 kB gzipped) more in the booking chunk, which only the booking step loads. Its larger data told nothing apart in the numbers tried, at twice the size. | Chosen. |

For the country:

<!-- prettier-ignore -->
| Option | For | Against | Result |
|---|---|---|---|
| spartan/ui's select or combobox | The site's look, a search in the combobox. | Both are custom listboxes: the browser cannot fill in the country. The combobox's input is fixed to `autocomplete="off"` and takes a value only from a chosen item. | Rejected. |
| A native `<select>` | The browser fills it in; a phone shows its own picker; typing a name chooses it. | Its list is the system's; the arrow is drawn by the site. | Chosen. |

For a list of choices (`multipleList`):

<!-- prettier-ignore -->
| Option | For | Against | Result |
|---|---|---|---|
| spartan/ui's radio group, as Beds24's own page shows it | Every choice in view at once. | A second control to copy, style and test; an optional choice, once made, cannot be undone. | Tried, replaced. |
| A native `<select>`, as a dropdown question | One control for every question of choices; its first entry undoes a choice. | The choices show only once the list is opened. | Chosen. |

## What this rests on

- **Measured on 2026-11-27,** production builds of the demo, raw and gzipped:

  <!-- prettier-ignore -->
  | Build | Initial bundle | Booking chunk |
  |---|---|---|
  | `main` before the form | 760.6 kB (185.6 kB) | 3.1 kB (1.4 kB) |
  | The form, checked through zod/mini | 775.9 kB (189.8 kB) | 99.3 kB (26.3 kB) |
  | The form, checked by plain functions | 768.9 kB (187.7 kB) | 76.8 kB (19.5 kB) |
  | The form with libphonenumber-js (2026-11-28) | 770.6 kB (187.8 kB) | 192.8 kB (44.0 kB) |

  zod/mini cost 22 kB in the booking chunk, 8 kB of it the table of regular expressions that its
  e-mail check brings, and 7 kB on every page: `@angular/core`'s `resource`, which
  `validateStandardSchema` uses for an asynchronous schema. What remains on every page with plain
  functions is Signal Forms' control integration in `@angular/core` (7 kB) and the fields' styles (3
  kB); the reactive forms package and brain's field were there already, for the select.

- **Verified in Chromium:** `aria-invalid` only after the button was pressed; each shown error in
  its control's `aria-describedby`, the tick box's too, which brain's checkbox does not link itself;
  the focus on the first error; the `autocomplete` and `name` of each field; axe without violations;
  the form filled in and sent by keyboard.
- **Not checked:** that a browser's saved details actually fill the fields, which a test browser
  does not have; Safari and VoiceOver (#100).

## Consequences

- **A kind of question Beds24 adds** needs code: its control and its check.
- **The rules in `answers.ts` are the server's too:** #349 checks a post with them, in the page's
  language.
- **The copied fields keep their shape;** a later spartan/ui release is copied over them, and the
  look stays in `ui.css`.
