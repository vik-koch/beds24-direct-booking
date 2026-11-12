# ADR 1: Beds24 holds the bookings, an own website shows them

Status: accepted, 2026-11-12.

## Context

A small business rents holiday apartments by the week: two now, four soon. They are bookable on
one booking portal only. The business wants direct bookings at a lower price, a second portal
next, and a website that is its official page.

That needs two things, and each could be bought or built:

- **A system that holds the bookings.** It must do what the portal does for the business today,
  for several portals and for the own website:
  1. Connect Booking.com and Airbnb through their APIs, with one calendar, so that no week is
     sold twice.
  2. Sell whole weeks only, with a fixed weekday for arrival and departure.
  3. Serve an own website: an API to read from, and a booking step with a payment gateway.
  4. Hold a price per day that follows the season, and a different price for direct bookings.
  5. Send messages to the guest from templates, on confirmation and later with the check-in
     details.
  6. Later, and with low priority: collect reviews of direct stays.
- **A website for the guest:** the free weeks with their prices, the apartments, the practical
  guides, in two languages, found by search engines and easy to use on a phone.

The volume is small: a few dozen bookings a year. The people who run the business are not
developers. One developer builds and maintains the site.

## Decision

1. **Beds24 is the booking system.** It holds availability, prices, stay rules, bookings and
   the payment, and connects the portals.
2. **The website is our own small application.** It reads from the Beds24 API, shows the weeks
   and the apartments, and hands over to the Beds24 guest form for the booking. It has no
   checkout, no database and no content editor.

## The booking system: options

This is not a full market comparison. Beds24 was tried first, in a spike; the others were
compared by their published prices and plans only.

<!-- prettier-ignore -->
| Option | For | Against | Result |
|---|---|---|---|
| No system: an own booking form, calendars synchronised by iCal | No monthly fee. | iCal synchronises with a delay and carries no prices, so a week can be sold twice. Payments, guest data and persistence become ours. | Rejected. |
| Beds24 | Priced by usage, without feature tiers. The spike showed what the site needs: two API calls return listings, availability, daily prices and stay rules for every apartment, and the weekly rule holds. Its guest form opens by deep link and can be framed and restyled. | A dated control panel that takes long to learn and to configure. The API has gaps: no pictures, and one stay rule is not visible in the calendar. Payment and the return to the site are not tested yet. | Chosen. |
| Smoobu, Lodgify or Hospitable as the system behind an own site | Each publishes an API and advertises the core of the list above: portal connections, prices, a booking engine, guest messages. Each also includes a website builder. | At least twice the price at this size, see below. Their APIs, booking steps and weekly rules were not tried, so whether they meet each point and carry an own site is unknown. | Not pursued: Beds24 does the job at an acceptable price, and a second spike is not worth it at this size. |
| Guesty or Hostaway | Aimed at professional managers, with plans that start at a few listings. | Not evaluated. Hostaway publishes no price for this size. | Not pursued, for the same reason. |

Prices per month on 2026-11-12, read from each vendor's price page or configurator, on monthly
billing and without VAT:

<!-- prettier-ignore -->
| System | Two apartments, one portal | Four apartments, two portals | How it is made up |
|---|---|---|---|
| [Beds24](https://beds24.com/pricing.html) | €19.20 | €27.70 | €12.90 base, €2.60 per apartment, €0.55 per apartment and portal. |
| [Smoobu](https://www.smoobu.com/en/pricing/) Professional Prepaid | €47 | €71 | €35, and €12 per further apartment. The Flex plan has a lower monthly fee plus 0.9% of every booking. |
| [Lodgify](https://www.lodgify.com/pricing/) Professional | €77 | €124 | Starter is €41 for two apartments, its limit, without custom message automation. |
| [Hospitable](https://hospitable.com/pricing) Professional | €59 | €89 | The plan that allows direct bookings. Its basic direct booking option adds a service fee of 1%. |

These are base prices, not final totals:

- **Payment processing** is charged by the payment provider with every system and is left out.
- **The others include a hosted website.** With Beds24 the site runs on a server of our own,
  which adds a few euros a month.
- **Beds24 charges for extras by use:** €0.10 per SMS and €19 a month for a booking page under
  an own subdomain. Neither is needed now.
- **Growth is cheap with Beds24:** a further portal adds €0.55 per apartment a month.

With the server and even the subdomain added, Beds24 stays below the others in both columns.

Beds24 charges no commission on bookings. Against the list above:

- **Verified in the spike:** the read API, the weekly rule, daily prices with a different direct
  price, and the hand-over to the guest form.
- **Taken from its documentation:** the portal connections, the payment gateway and the message
  templates.
- **Not offered:** reviews of direct stays, which would be our own later work.

The effort of setting Beds24 up is spent once, by the developer. What the business uses day to
day is the calendar and the price table.

What Beds24 really does, and what is still untested, is in `../beds24-findings.md`.

## The website: options

<!-- prettier-ignore -->
| Option | For | Against | Result |
|---|---|---|---|
| The Beds24 booking page as the website | No code at all. | It is a booking form, not a site: no pages for the company, the guides or each apartment, little for search engines, and a look that custom CSS only partly changes. Its calendar shows nights, not weeks. | Rejected as the site, kept as the last step. |
| A website builder, or WordPress with the Beds24 plugin | Quick, and the business could edit pages itself. For most businesses of this size it is the sensible choice. | What makes this site different is not there out of the box: a grid of whole weeks with prices, and content that changes with the season. Both would be custom code inside a CMS that the business does not need and that wants upkeep of its own. | Rejected. |
| An own site with an own checkout through the Beds24 API | Full control of every step. | Brings payments, personal data and stored bookings into our code, for a few dozen bookings a year. | Rejected. |
| An own site that hands over to the Beds24 guest form | The parts that make the site worth visiting are ours: the grid of weeks, the apartments, the seasons, speed. Beds24 collects the guest's data, stores the booking and takes the payment. | Developer time. The last step looks and behaves as Beds24 allows. | Chosen. |

The own site is affordable here because the developer's time is not billed and the project is
also a portfolio piece. Without that, the builder would be the better trade.

## Conditions before the real site is released

The decision rests on a spike with a trial account. These are still open and must hold first:

- **A complete booking:** payment, confirmation and the return to the site, on a paid account.
- **The framed guest form in Safari on a real iPhone,** where its session cookie is a
  third-party cookie. If it fails there, the same link opens as a full page.
- **The weekly rule on each portal, before that portal is switched on:** that closed arrival
  and departure days arrive there. Booking.com before the release, Airbnb before it is added.

If the hand-over cannot be made to work even as a full page, an own checkout is the remaining
option. It reverses a boundary of this decision and needs a new ADR.

## Consequences

- **The site is coupled to Beds24 directly.** There is no provider interface: a second system
  would change the hand-over and the simulator as well, so an abstraction would be untested
  guesswork.
- **The last step is not ours.** The guest form's look, accessibility and behaviour in a frame
  are limited to what Beds24's settings allow.
- **Guest data passes through the site once.** After a booking, Beds24 returns the guest to the
  site with the booking and the guest's name and contact in the address. The site shows them,
  keeps them out of logs and storage, and does not treat them as proof of a booking.
- **The site fills the API's gaps itself:** pictures come from content files, and the rule that
  the calendar does not show is applied by the site.
- **A simulator is needed.** The public demo has no Beds24 account, and the tests must not call
  the real one.
- **The business edits listings in Beds24 and nothing else.** Prices, availability and listing
  texts change there and show on the site without a deployment. Everything else on the site is
  a change in the repository, made by the developer.
- **Running cost** is the Beds24 fee and one small server.
