# ADR 19: The booking form asks what Beds24's booking questions ask

Status: accepted, 2026-11-27. Group: product. Settles where ADR 18's form takes its fields from, and
which of Beds24's booking rules the site requires.

## Context

ADR 18 made the booking step the site's own form, without saying where its fields come from. In
Beds24 the host sets per property which guest fields the booking page asks, whether each must be
answered, their order, and up to ten questions of their own, such as a cot or how the guest arrives.
Beds24's booking page redirects to the site (ADR 18, decision 9), so these settings reach a guest
only if the site reads them.

A spike on 2026-11-27 read them through the API and tried bookings against them. The results are in
`../beds24-findings.md`, section "Booking questions". What weighs:

- **The settings are there and small:** `bookingQuestions` in `properties` gives each of 16 standard
  fields and 10 custom questions a usage out of five and an order, and each custom question a type
  out of six. A custom question's text and choices come per language.
- **Standard fields come without labels;** Beds24's booking page brings its own.
- **Beds24 checks almost nothing.** `POST /bookings` saves a booking without a compulsory answer,
  with an e-mail `not-an-email`, a phone `abc` and any text as a choice. Only an unknown country
  code is dropped, with a warning.
- **How Beds24 takes a booking is a property's setting too:** `bookingRules` names a booking type
  (confirmed by paying a deposit, by leaving a card, on request, at once, or closed), for normal,
  near-term and exceptional dates, and `paymentCollection` the deposits. The site takes the full
  price at booking (ADR 18), which matches one of these settings only.

## Decision

1. **Beds24's booking questions decide** which fields and questions the form shows, which must be
   answered and in which order. `optional` is optional; `compulsory` and `compulsoryBookingPage`
   must be answered; `internal` and `notUsed` are not shown. First name, surname and e-mail are
   always shown and must be answered, as Stripe and the confirmation need them; where Beds24 does
   not show one of them, it goes before every other question, in that order.
2. **The site maps the 16 standard fields in its code,** as it maps amenities to icons: each with
   its input type, `autocomplete` and validation, and its label as a content key per language that
   the content schema requires. Country names come from `Intl.DisplayNames`.
3. **A custom question's label is Beds24's text** in the page's language, its choices the bracketed
   parts. A ticked box is sent as `"1"`, a choice as its option's text. A question without its text,
   or a choice question without its choices, in one of the site's languages is not supported, as in
   decision 5.
4. **The site validates every answer,** in the form and again on the server: what must be answered,
   the form of an e-mail and a phone number, a country from the list, a choice from its options.
5. **A question the site does not support,** such as a type it does not know or one missing its text
   in a language, is found when the property is loaded and on each refresh. An optional one is left
   out and logged as a warning; one that must be answered closes the property's booking, its
   apartments showing no booking button, and is logged as an error. Telling the host is #363's, as
   for decision 6.
6. **Beds24's booking rules must say what the site does.** The site takes one payment of the full
   price at booking, through its own Stripe Checkout (ADR 18). A property takes bookings on the site
   only when Beds24 says the same: `bookingType` `confirmedWithDepositCollection1`, deposit 1 at 100
   % without a fixed amount, deposit 2 at nothing, and a near-term or exceptional type either off,
   past or the same. Otherwise its booking is closed and logged as an error, as for a question in
   decision 5, so Beds24's settings never promise something the site does not do. Beds24's payment
   gateways are not read. Deposits, if the business ever wants them, are an issue of their own.

## Options

<!-- prettier-ignore -->
| Option | For | Against | Result |
|---|---|---|---|
| A fixed form in the code | The least code; one layout to test. | Every deployment asks the same; a question of the business's own needs a release. Beds24's settings say one thing and the form does another. | Rejected. |
| The fields listed in the deployment's content | Each deployment chooses, without code. | The form is set up in two places, and a custom question's wording per language is kept twice. | Rejected. |
| Beds24's booking questions | The host sets the form where Beds24's booking page would have it, beside the rest of the listing. The set of usages and types is closed and small. | Validation and layout driven by data; each usage and type needs a test; a new type needs code. | Chosen. |

Within the chosen option, for Beds24's booking rules and deposits:

<!-- prettier-ignore -->
| Option | For | Against | Result |
|---|---|---|---|
| Ignore them, and write the limit down | No code. | Beds24 can say "request only" or "10 % deposit" while the site takes the full price; nothing tells the host. | Rejected. |
| Follow them | The host's every choice holds. | Requests, card guarantees and part payments are each a booking step of their own. | Rejected. |
| Accept only the one setting that matches, close the booking otherwise | Beds24 and the site always agree; a mismatch is found, not guessed. | A property set up otherwise takes no booking until the host changes it; a blackout period closes its booking as a whole. | Chosen. |

Within the chosen option, for a question the site does not support:

<!-- prettier-ignore -->
| Option | For | Against | Result |
|---|---|---|---|
| Leave it out always | Booking never stops. | A question the host made compulsory goes unanswered on every booking. | Rejected. |
| Refuse to start | Nothing wrong is ever shown. | One question stops every page of the site, the listings included. | Rejected. |
| Leave out an optional one, close the booking for a compulsory one | Booking keeps every rule the host set; the rest of the site stays up. | That property takes no booking until the code supports the question or the host changes it. | Chosen. |

## What this rests on

- **Verified in the spike:** the shape of `bookingQuestions` and the custom questions' texts; all
  six types on Beds24's booking page; `POST /bookings` saving bookings without compulsory answers
  and with malformed values; a ticked box as `"1"` and a choice as its text, as the control panel
  shows them.
- **Verified on 2026-11-27:** a date stored as `YYYY-MM-DD`, as the control panel's date picker
  saves it too; `bookingRules` and `paymentCollection` as `properties` returns them, on two
  properties set to "confirmed with deposit collection 1" at 100 %.
- **Not checked:** what Beds24's booking page offers and writes as a title; in which language it
  stores a choice.

## Consequences

- **The host shapes the form in Beds24,** per property, and keeps each custom question's text in
  every language the site has.
- **A change in Beds24 reaches the form** at the next refresh of the listings, without a release.
- **The content carries a label per standard field and language,** whether a deployment asks for it
  or not, so a field switched on in Beds24 never lacks one.
- **The simulator's properties carry `bookingQuestions`** and custom question texts, with each usage
  and type the tests need.
- **The setup guide (#352)** names the settings the site follows, the ones it requires and the ones
  it ignores.
