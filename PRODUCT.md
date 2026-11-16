# Product

<!-- impeccable:product-schema 1 -->

The product facts the design tooling works from. Decisions and their reasons are in
`docs/brief.md`; the pages and their addresses are in `docs/site-map.md`.

## Platform

web

## Users

- **The primary visitor** plans a week in the mountains for a family or a group of friends, two
  to eight people. They are mostly on a phone and often arrive after seeing the same apartment
  on Booking.com. Their job: find a free week, see what it costs for their apartment, and book
  it.
- **The second visitor** is a guest already in the apartment, who opens the FAQ from a printed
  QR code.

## Product Purpose

A direct-booking website for a small business that rents holiday apartments by the week. It
shows the free weeks with their prices and hands over to the Beds24 guest form for the booking
and the payment. It is also the business's official page: who they are, where the apartments
are, how to get in touch. Success is a visitor who books a week directly instead of through a
portal.

## Positioning

The same apartments and the same weeks as on the portals, at a lower price, because no
commission is paid, from a small business run by its owners. Stays run by the week from a fixed
weekday, and the place has two seasons, which the site shows as two faces of one site.

## Operating Context

- Availability, prices and listing texts come from Beds24 and change without a deployment.
- A stay is a whole week; not every week is bookable. The home page lists one dated season's
  weeks with a price per apartment.
- The site has two languages, with the language in the address, and two seasons that a visitor
  can switch between.
- Wording, pictures and theme values are content of a deployment, never code.

## Capabilities and Constraints

- No own checkout, payment, accounts or review texts.
- No tracking that needs consent and no third-party requests for fonts.
- Server-rendered pages: prices and texts are in the HTML.
- Works at 320 px, by keyboard, at 200% zoom, in both languages and both seasons.
- This repository carries a fictional demo only: _Firn & Farn_, an invented business with three
  apartments (Zirbe, Lärche, Ahorn) in two houses in Saalbach in Austria, in German and English.
  The village is real; the houses, prices and tourist tax are made up.

## Brand Commitments

- The name _Firn & Farn_ as a text wordmark; there is no logo.
- An Alpine chalet base of wood and stone with one bright accent per season: an icy blue for
  winter, a fern green for summer.
- The hero is a photograph of the valley in the current season.

## Evidence on Hand

- Two hero photographs of the valley from Wikimedia Commons, one per season, used with credit.
- Apartment names, sizes and prices from the simulator's data in `sim/data.json`.
- Apartment interiors are generated pictures and are labelled as such.
- There are no review texts, guest counts, awards or testimonials, and none may be invented.

## Product Principles

1. The free weeks and their prices are the point; everything else leads to them or away from
   doubt.
2. One site with two seasons: a visitor looking at a July week sees summer.
3. A phone first: the list of weeks has to work in one hand.
4. Honest and small: an owner-run business, said plainly, with nothing claimed that is not
   there.

## Accessibility & Inclusion

Contrast of 4.5:1 for text and 3:1 for large text and control edges on both season palettes,
full keyboard operation with a visible focus ring, reduced motion respected, and alternative
texts for every picture.
