# The Beds24 simulator

A small server that answers like the Beds24 API, from invented data, and plays Stripe Checkout. It
is the demo's Beds24 and Stripe and the e2e tests'; the site itself never knows the difference. The
wire shapes follow [`docs/beds24-findings.md`](../docs/beds24-findings.md).

```sh
npm run sim   # Beds24 at http://localhost:4300/v2, refresh token "simulator";
              # Stripe at http://localhost:4300/v1, key "simulator"
```

`PORT` moves it to another port. `SIM_PUBLIC_URL` is where a browser reaches it, for the checkout
page's address; it defaults to `http://localhost:` and the port, and the demo's stack sets it to the
site's own address, under which only `/simulated-checkout/` is routed to the simulator.
`SIM_PRICES_UNTIL` (a day such as `2026-11-17`) leaves every later night without a price, as on an
account whose owner has not opened the coming season yet; the e2e tests run a second simulator with
it.

Node runs the TypeScript files directly, so there is no build step and no dependency. The business
is described in [`data.json`](data.json); the decisions behind the simulator are in
[ADR 5](../docs/adr/0005-the-simulator.md).

## What it answers

<!-- prettier-ignore -->
| Call | Answer |
|---|---|
| `GET /v2/properties` | The three houses with their four apartments; the demo lists three, the e2e test site all four. Each house's booking questions, booking rules and deposits come without a parameter. Rooms, texts, price rules and upsell items appear when their `include*` parameter is passed; `id` filters. |
| `GET /v2/authentication/token` | For the header `refreshToken: simulator`, a new access token valid for 24 hours. |
| `GET /v2/inventory/rooms/calendar` | Per room the compressed date ranges between `startDate` and `endDate`, with the fields whose `include*` parameter is passed; `roomId` and `propertyId` filter. A held booking takes its nights out. |
| `GET /v2/inventory/rooms/offers` | Per room, for `arrival` and `departure`, one offer when the stay is a Saturday-to-Saturday week, every night free and priced, beyond the lead time and within the room's guest limits (`numAdults`, `numChildren`); otherwise the room without `offers`. The price is the sum of the nights times the booking page multiplier, whatever the mix of guests. `roomId` and `propertyId` filter. |
| `POST /v2/bookings` | Per item, a new booking or a change to one by its `id`: status, price, invoice and info items, `notifyGuest` counted. A `new` or `confirmed` booking holds its nights; with `checkAvailability` a night already taken refuses it. |
| `POST /v1/checkout/sessions` | A Stripe Checkout Session from a form-encoded body: `mode`, `success_url` and `line_items` with `price_data` are required; `amount_total` is their sum. It is open for 24 hours or until `expires_at`, and its `url` is the simulated checkout page. |
| `GET /v1/checkout/sessions/{id}` | The session, `expired` once its expiry time has passed. |
| `POST /v1/checkout/sessions/{id}` | Merges `metadata` into the session's; an empty value removes its key. |
| `GET /v1/checkout/sessions` | The sessions, newest first, by `status` and `created` (`gt`, `gte`, `lt`, `lte`), in pages of `limit` (10, at most 100) after `starting_after`. |
| `GET /simulated-checkout/{id}` | The guest's checkout page, plainly marked as simulated, in German or English by the session's `locale`. Paying completes the session and redirects to `success_url`, with `{CHECKOUT_SESSION_ID}` replaced; cancelling redirects to `cancel_url` and leaves the session open; letting it expire shows it expired. |

A Stripe call needs the header `Authorization: Bearer simulator`, or it answers 401. Any other
Beds24 call needs an access token in the header `token`; without one, as with a wrong refresh token,
it answers 401 `Token not valid`, in the body Beds24 sends and, as there, without rate limit
headers. Every successful Beds24 answer carries the three headers; the budget is counted and never
enforced.

## The data

_Firn & Farn_ does not exist. Saalbach is real; the houses, their addresses and positions, the
prices and the tourist tax are invented. Only the texts the site reads are written; Beds24's other
texts are sent empty.

The calendar is a function of the room and the date, so a week that is booked stays booked as the
days pass:

- **Stays** run from Saturday to Saturday: every other day is closed to arrival and departure.
- **Prices** follow yearly periods that change on a Saturday. Between the seasons there are none.
  Where two priced periods meet, the arrival day keeps the old price.
- **Bookings** are drawn from the room and the week: about a third of the weeks are taken, more in
  the peak periods, and some weeks have single nights taken.
- **Apartment Zirbe** is booked out every winter.
- **Bookings made through the API** and Checkout Sessions live in memory until the simulator
  restarts. As the demo is public, a booking keeps its stay, status and money and a session its
  amount and metadata, never the guest's details: `customer_email` is dropped.
- **The lead time** is seven days, so the nearest Saturday is always inside it.
- **The booking questions** are few, as a host would ask: Haus Firn asks the name, the e-mail, the
  phone, the country, and optionally the arrival time and a message, with its mobile number
  internal. Haus Farn asks the same and one of each kind of choice: a dropdown, a list, a date and a
  tick box after the arrival time, and a required tick box last; it leaves out the first name, asks
  the e-mail as optional and keeps one question internal. Haus Moos, with Fichte alone, takes
  bookings on request only, which the site does not do. The custom questions are written in German
  and English only, so on the e2e test site Haus Farn's compulsory one closes its booking.

## What differs from Beds24

- **Left out:** the blocks of a property the site never reads (payment gateways, vouchers, units and
  the like), every other call, and the booking page.
- **Stripe** is played only as far as the site uses it: no customers, payment methods or webhooks,
  no validation of `expires_at`, and a session answers only the fields above.
- **`maxChildren` 0** refuses any child in `offers`; whether Beds24 does is not checked.
- **Not recorded on the wire, so the simulator's own:** what `properties` returns when only some
  `include*` parameters are passed, the calendar's answer without any (a day that carries none of
  the fields asked for is skipped), the answer to a new booking beyond its `id` and to a change, and
  every error other than the 401, the refused week and the unknown booking, and the `offers` answer
  without both dates.
