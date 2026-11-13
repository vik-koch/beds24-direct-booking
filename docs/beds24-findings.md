# Beds24: what the API and the booking page really do

Findings from a spike in five rounds (2026-11-10 and 11) against a real account on a trial plan.
Trust this file over the Beds24 documentation and the OpenAPI file, and extend it when the wire
shows something new. The round-by-round log, the recordings and the scripts are kept privately,
because they hold the account's data. Amounts here are example figures.

## Access and limits

- **Base URL:** `https://api.beds24.com/v2`, with the header `token: <token>`.
- **OpenAPI file:** public at `https://beds24.com/api/v2/apiV2.yaml` (263 kB). Good enough to
  generate types and to check the simulator against, but wrong in places: see the rate limit.
- **Tokens:** a long-life token is used directly and expires after about 90 days. A refresh
  token is exchanged for a 24-hour access token at `GET /authentication/token`.
  `GET /authentication/details` reports scopes and expiry.
- **Scopes:** the site needs `read:inventory` and `read:properties` only. A call without its
  scope answers 401 `Token not valid`, the same body as a bad token.
- **Rate limit:** 100 credits per 5 minutes per account. A call costs 1 credit, the full
  `properties` call 1.6. The headers on the wire are `X-Request-Cost`,
  `X-Five-Min-Limit-Remaining` and `X-Five-Min-Limit-Resets-In`; the OpenAPI file names them
  `X-FiveMinCreditLimit-*`. A 401 carries none of them.
- **One call covers every property** when no property filter is passed. A full refresh
  (`properties` and `calendar`) costs about 3 credits, whatever the number of apartments.

## The calls

<!-- prettier-ignore -->
| Call | Returns | Use |
|---|---|---|
| `GET /properties` | Facts, texts, price rules, upsell items and the booking page multiplier, per property and room. Needs its `include*` parameters: `includeAllRooms`, `includeTexts=all`, `includeLanguages=all`, `includePriceRules`, `includeUpsellItems`, `includeUnitDetails`. | Listings. |
| `GET /inventory/rooms/calendar` | Per room, compressed date ranges (`from`, `to`) carrying `numAvail`, `minStay`, `maxStay`, `override`, `multiplier` and `price1`. Returns nothing unless the matching `include*` parameters are passed. | The week grid, in one call. |
| `GET /inventory/rooms/offers` | The price for one concrete stay (`arrival`, `departure`, `numAdults`), all rooms in one call. An unbookable stay returns the room without an `offers` array, not an error. | The authority on price and bookability. One call per stay, so for tests only, not for the grid. |
| `GET /inventory/rooms/availability` | Per room, a map of date to `true` or `false`. | Not needed: `calendar` carries `numAvail`. |

Seen and not used:

- **`GET /inventory/fixedPrices`:** exists, empty when prices are daily.
- **`GET /bookings`:** needs `read:bookings`. Even without the personal-data scope it returns
  comments and notes; the site never needs it.
- **`GET /channels/booking/reviews`:** marked Alpha. The response shape is unknown.
- **`GET /properties/rooms`:** marked "Coming soon"; answered empty, later 500.
- **`POST /bookings` and `POST /channels/stripe`** (`createStripeSession`, Alpha): an own
  checkout is possible in principle, with a write token.
- **Webhook URL:** a property setting. It could drop the cache when a booking arrives.

## Bookable weeks

The weekly rule is configured in Beds24 as `minStay` 7 on every date plus the override "No check
in or out" on every day except the arrival weekday. With it, `offers` answered:

<!-- prettier-ignore -->
| Stay | Offer |
|---|---|
| Saturday to Saturday, one week | yes |
| Saturday to Saturday, two weeks | only when `maxStay` allows it; then the sum of both weeks |
| Three, four, six or eight nights from or to a Saturday | none |
| Monday to Monday | none |
| A week with a booking in it | none |
| A week that starts sooner than the lead time | none |
| More adults than `maxPeople` | none |

`calendar` shows most of this, so the site derives the grid from data and hard-codes no weekday.
A week is bookable when all of these hold:

1. Its first and last day carry `override: "none"` (closed days carry `"noCheckInOrCheckOut"`).
2. Its seven nights have `numAvail` 1 and a price.
3. Its first night is at least `minDaysUntilCheckin` days away.
4. The guest count is at most the room's `maxPeople`.

Traps:

- **The lead time is invisible in `calendar` and `availability`.** It is in `properties` as
  `priceRules[].minDaysUntilCheckin` (beside `maxDaysUntilCheckin`, `minimumStay` and
  `maximumStay`). Unused rules come back as bare `{id}` entries. The site applies it itself.
- **`maxStay` may be set where the control panel shows it empty.** `calendar` returned 7 with
  an empty Max Stay row.
- **The price does not depend on the guest count** (`priceFor: maxCapacity`).

## Prices

- **Daily prices** arrive as `price1` on the calendar ranges.
- **The week price** is the sum of the seven daily prices times the property's
  `bookingPageMultiplier`. `offers` and the guest form apply the multiplier; `calendar` does
  not. The `multiplier` in `calendar` is a different, per-day value.
- **The multiplier is a string and must be written `*0.9`.** Written `0.9`, it is returned but
  applied nowhere. Parse an optional leading `*`; anything else means no price is shown.
- **No rounding:** a week of 7 × 150.50 (1,053.50) shows as 948.15.
- **Daily prices within a week need not be equal.** Where a price period ends on the arrival
  day, that day carries the old price and the other six the new one.
- **Cleaning** is part of the daily price by choice of setup, so there is no fee line. The
  room's `cleaningFee` field exists.
- **Tourist tax** is an upsell item on the property: `type` `obligatory` or `obligatoryTax`,
  `amount`, `per: adult`, `period: daily` or `oneTime`, and its name per language in
  `upsellItemName1`. It is not part of an offer's price, and the room's `taxPerson` and
  `taxPercentage` stay 0. The guest form adds it as its own line: 2.50 × 2 adults × 7 nights
  = 35.00, for three adults 52.50. Grand total in the example: 983.15.

## Listing data

- **A room is the listing; a property groups rooms.** Every inventory call is keyed by `roomId`
  and returns `propertyId` beside it.
- **Facts:** on the property the address, city, country, coordinates, check-in and check-out
  times, `permit` and `featureCodes`; on the room `roomSize`, `maxPeople`, `minStay`, `maxStay`
  and its own `featureCodes`.
- **Feature codes** are fixed codes such as `FIREPLACE` or `ICE_SKATING`: labels and icons are
  the site's. Room codes carry the sleeping layout as groups, such as
  `["BEDROOM", "BED_DOUBLE"]`.
- **Plain texts** come per account language, with empty strings where nothing is written and
  `\r\n` line breaks. Property: `headline`, `propertyDescription`, `locationDescription`,
  `directions`, `houseRules` and the policies. Room: `displayName`, `contentHeadline`,
  `contentDescription`, `roomDescription`, `accommodationType`.
- **Rich texts** are the booking page's content slots in `texts[]`: `propertyDescription1`,
  `propertyDescription2`, `propertyDescriptionBookingPage1` and `…2`. They are raw editor HTML
  with inline styles, so they pass a sanitiser with a small allowlist.
- **Pictures are not in the API.** `includePictures=true` returns no picture field, and the
  picture schema is commented out in the OpenAPI file. The control panel shows a public URL per
  picture, built from the property ID and a two-digit number. The files load without a token:
  PNGs of about 1 MB, at most about 1100 px wide, without cache headers, around forty per
  listing. The numbers carry no order.

## The booking page

**Links.** Both are plain GETs on a fresh session:

- The calendar: `https://beds24.com/booking2.php?propid=…&checkin=YYYY-MM-DD&numnight=7&numadult=2&lang=de`.
- The guest form directly: `booking2.php?propid=…&page=book3&checkin_hide=YYYY-MM-DD&numnight=7&numadult=2&br1-<roomId>=Book`.

**Behaviour of the guest form:**

- **It shows** a summary (week price with the multiplier, the tourist tax line, the grand
  total) beside twelve fields. Title, first name, surname, e-mail and country are required.
- **`lang`** translates the form and the tax label. The listing name and the room type text
  stay as written in Beds24.
- **It does not refuse an unbookable week:** the form renders with "Sold" and a total of 0.00.
  The site must link bookable weeks only.
- **Session:** the ID is in a `booking` cookie without a `SameSite` attribute, and also in a
  hidden field and in the page's links. The form posts to the same page.
- **Back buttons** are links to the Beds24 calendar (`book_bookingback`,
  `book_bookingbackright`). No parameter for a return address exists.
- **An unpublished page** answers "Online booking isn't available for this property yet"; so
  does a page whose payment gateways are all disabled. The control panel issues a `b24preview`
  cookie that opens it for about an hour.

**Embedding** (checked in headless Chromium at 1280 px and as an iPhone 13, through a local
proxy that injected what the settings below would carry):

- **The frame is allowed:** no `X-Frame-Options` and no frame policy.
- **Restyling** goes through two booking engine settings: "Custom CSS", and "Insert in HTML
  <BODY> bottom" for a script. About 60 lines of CSS hide the back buttons, the "Book
  <property>" strip, the secure logo and the "powered by" line, and restyle panels, fields and
  the confirm button. The hooks are stable IDs and classes (`b24-guestdetails`,
  `b24-bookingdetails`, `book_confirmbookingbut`, …) on Bootstrap 3 markup.
- **The page sends nothing to its parent.** The injected script reports the content height
  (914 px on desktop, 1821 px on the phone) and the step shown (guest form, calendar, other)
  through `postMessage`.
- **Scrollbars:** removing the container's padding makes Bootstrap's rows overflow by 15 px
  and produces both scrollbars. Use a negative margin on `#bookingpage`, `overflow: hidden` on
  the framed document and `scrolling="no"` on the iframe.
- **Phone:** the summary stacks above the form; fields at 16 px avoid the iOS focus zoom.

**After "Confirm Booking"** (settings read in the control panel, untested):

- **On a trial account** the submit answers a bare page reading "An error has occured" and
  creates no booking. The page stays in the frame; the script reports it as step `other` with
  a height of 78 px.
- **"Booking Return URL" and "Booking Failed URL"** redirect to the site's own pages. The
  return carries the booking as query parameters: `bookid`, `propid`, `roomid`, `roomname`,
  `propname`, `status` (1 or 2 confirmed, 3 on request), `firstnight`, `lastnight`, `checkout`,
  `numnight`, `numadult`, `numchild`, `lang`, `price`, `qty`, `pricenum`, `referer`,
  `ratedesc`, and the guest's `guestname`, `guestfirstname`, `guesttitle`, `guestemail` and
  `guestphone`. They are unsigned.
- **"Open in New Window: Frame Killer On Secure Payment"** may take the page out of the frame
  at the payment step.
- **Also there:** guest verification (captcha, e-mail code) and "Confirmation Page Insert in
  HTML <HEAD>".

## What follows for the site

- **One process with an in-memory cache is enough**, refreshed on a timer, with the last good
  responses on disk: listings come from Beds24, so a start without it would show an empty site.
- **The grid is built from `calendar` and `properties`** by the rules above, and a test compares
  it with `offers`, edge of the lead time included.
- **The content files keep what the API lacks:** per listing the room ID, a slug and the
  pictures with alternative texts. The site converts and serves its own copies of the pictures.
- **The booking step sits behind one seam:** one function builds the deep link, one route
  holds the frame. A full-page link is then a setting.
- **The confirmation page** shows what the return URL carries, then removes the query from the
  address bar. The server never logs that query, and the page never treats it as proof of a
  booking.
- **The simulator's surface is small:** `authentication/details`, `properties`, `calendar`,
  `offers` and a fake booking page with the same deep-link parameters. Its data includes a
  week with unequal daily prices, a taken week and a week inside the lead time.

## Not verified

- **Everything after "Confirm Booking":** the payment, the frame killer, the return URL. Needs
  a paid account.
- **The frame's session cookie in Safari:** a third-party cookie there. The proxy made it
  first-party, so it showed nothing. Fallbacks: the deep link as a full page, then an own form
  on `POST /bookings`.
- **The lead time's boundary:** whether the day exactly `minDaysUntilCheckin` away is bookable,
  and in which time zone the days are counted.
- **Whether the override reaches the channels** as closed to arrival and departure.
- **A property with several rooms:** known from the API's structure only.
