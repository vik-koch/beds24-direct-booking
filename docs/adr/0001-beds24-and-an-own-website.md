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
  2. Serve an own website: an API to read from, and a booking step with a payment gateway.
  3. Hold a price per day that follows the season, and a different price for direct bookings.
  4. Send messages to the guest from templates, on confirmation and later with the check-in
     details.
  5. Later, and with low priority: collect reviews of direct stays.
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

<!-- prettier-ignore -->
| Option | For | Against | Result |
|---|---|---|---|
| No system: an own booking form, calendars synchronised by iCal | No monthly fee. | iCal synchronises with a delay and carries no prices, so a week can be sold twice. Payments, guest data and persistence become ours. | Rejected. |
| Rental software with its own website builder, such as Lodgify, Smoobu or Hospitable | One product for calendar, portals and website. The fastest way to a bookable site. | Two to four times the price at this size. Plans are tiered, and the entry plans leave out parts of the list above. The website is what the builder's templates allow. | Rejected with the builder; see below. |
| Beds24 | Priced by usage, with every function in the one plan. A complete read API: one call returns availability, daily prices and stay rules for every apartment. Its booking page opens by deep link, can be framed and restyled. | A dated control panel and a long setup. The API has gaps: no pictures, and one stay rule is not visible in the calendar. | Chosen. |
| Software for professional managers, such as Guesty or Hostaway | Strong APIs and operations features. | Built and priced for dozens of properties and more. | Rejected. |

Prices per month in November 2026, from each vendor's own price page, on monthly billing and
without VAT:

<!-- prettier-ignore -->
| System | Two apartments, one portal | Four apartments, two portals | Note |
|---|---|---|---|
| Beds24 | €19 | €28 | A base fee, a fee per apartment and a fee per apartment and portal. |
| Smoobu | €47 | €71 | The Professional plan. A cheaper plan takes 0.9% of every booking instead. |
| Lodgify | €41 or €77 | €124 | Starter or Professional for two; Starter has no automated messages and is not offered for four. |
| Hospitable | $39 | $89 | Host for two, its limit; Professional for four. |

Beds24 charges no commission on bookings. It covers points 1 to 4 of the list in its one plan;
point 5 it does not offer, so reviews would be our own later work.

The setup cost of Beds24 is paid once, by the developer. What the business uses day to day is
the calendar and the price table.

What Beds24 really does was checked in a spike before the decision: see
`../beds24-findings.md`.

## The website: options

<!-- prettier-ignore -->
| Option | For | Against | Result |
|---|---|---|---|
| The Beds24 booking page as the website | No code at all. | It is a booking form, not a site: no pages for the company, the guides or each apartment, little for search engines, and a look that custom CSS only partly changes. Its calendar shows nights, not weeks. | Rejected as the site, kept as the last step. |
| A website builder or WordPress with a booking widget | Quick, and the business could edit pages itself. For most businesses of this size it is the sensible choice. | The booking widget is again a calendar of nights in a frame. A view of whole weeks with prices, two seasons of content and fast pages without a consent banner are not on offer. A WordPress site needs upkeep of its own. | Rejected. |
| An own site with an own checkout through the Beds24 API | Full control of every step. | Brings payments, personal data and stored bookings into our code, for a few dozen bookings a year. | Rejected for now; it stays the fallback if the hand-over fails. |
| An own site that hands over to the Beds24 guest form | The parts that make the site worth visiting are ours: the grid of weeks, the apartments, the seasons, speed. Payment and guest data stay with Beds24. | Developer time. The last step looks and behaves as Beds24 allows. | Chosen. |

The own site is affordable here because the developer's time is not billed and the project is
also a portfolio piece. Without that, the builder would be the better trade.

## Consequences

- **The site is coupled to Beds24 directly.** There is no provider interface: a second system
  would change the hand-over and the simulator as well, so an abstraction would be untested
  guesswork.
- **The last step is not ours.** The guest form's look, accessibility and behaviour in a frame
  are limited to what Beds24's settings allow. A full-page link is the first fallback, an own
  checkout the second.
- **The site fills the API's gaps itself:** pictures come from content files, and the rule that
  the calendar does not show is applied by the site.
- **A simulator is needed.** The public demo has no Beds24 account, and the tests must not call
  the real one.
- **The business edits listings in Beds24 and nothing else.** Prices, availability and listing
  texts change there and show on the site without a deployment. Everything else on the site is
  a change in the repository, made by the developer.
- **Running cost** is the Beds24 fee and one small server.
