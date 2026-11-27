# Beds24: what the API and the booking page really do

Findings from a spike in five rounds (2026-11-10 and 11) against a real account on a trial plan, and
a sixth round on the booking step (2026-11-26), when the same account could take bookings with its
Stripe gateway in test mode, and a seventh on its booking questions (2026-11-27). Trust this file
over the Beds24 documentation and the OpenAPI file, and extend it when the wire shows something new.
The round-by-round log, the recordings and the scripts are kept privately, because they hold the
account's data. Amounts here are example figures.

## Access and limits

- **Base URL:** `https://api.beds24.com/v2`, with the header `token: <token>`.
- **OpenAPI file:** public at `https://beds24.com/api/v2/apiV2.yaml` (263 kB). Good enough to
  generate types and to check the simulator against, but wrong in places: see the rate limit.
- **Tokens:** a long-life token is used directly and expires after about 90 days. An invite code
  from the control panel is exchanged once, at `GET /authentication/setup`, for a refresh token
  (tried). The OpenAPI file says a refresh token lives as long as it is used within 30 days;
  inactivity was not tried. With the header `refreshToken`, `GET /authentication/token` answers a
  24-hour access token with the same scopes and no new refresh token (tried):
  `{ token, expiresIn: 86400 }`, for half a credit. A wrong or missing refresh token answers 401
  `Token not valid` without rate limit headers (tried on 2026-11-27). `GET /authentication/details`
  reports scopes and expiry.
- **Scopes:** reading the listings needs `read:inventory` and `read:properties`. Booking adds
  `write:bookings`, `write:bookings-personal` and `write:bookings-financial`. A write scope does not
  include reading: a token with only these five runs the whole booking step but cannot read a
  booking. It can change any existing booking by its ID. A call without its scope answers 401
  `Token not valid`, the same body as a bad token.
- **Rate limit:** 100 credits per 5 minutes per account. A call costs 1 credit, the full
  `properties` call 1.6. The headers on the wire are `X-Request-Cost`, `X-Five-Min-Limit-Remaining`
  and `X-Five-Min-Limit-Resets-In`; the OpenAPI file names them `X-FiveMinCreditLimit-*`. A 401
  carries none of them.
- **One call covers every property** when no property filter is passed. A full refresh (`properties`
  and `calendar`) costs about 3 credits, whatever the number of apartments.

## The calls

<!-- prettier-ignore -->
| Call | Returns | Use |
|---|---|---|
| `GET /properties` | Facts, texts, price rules, upsell items and the booking page multiplier, per property and room. Needs its `include*` parameters: `includeAllRooms`, `includeTexts=all`, `includeLanguages=all`, `includePriceRules`, `includeUpsellItems`, `includeUnitDetails`. | Listings. |
| `GET /inventory/rooms/calendar` | Per room, compressed date ranges (`from`, `to`) carrying `numAvail`, `minStay`, `maxStay`, `override`, `multiplier` and `price1`. Returns nothing unless the matching `include*` parameters are passed. | The week grid, in one call. |
| `GET /inventory/rooms/offers` | The price for one concrete stay (`arrival`, `departure`, `numAdults`), all rooms in one call. An unbookable stay returns the room without an `offers` array, not an error. | The authority on price and bookability. One call per stay: the booking step checks the chosen stay with it, and tests compare the grid with it. |
| `GET /inventory/rooms/availability` | Per room, a map of date to `true` or `false`. | Not needed: `calendar` carries `numAvail`. |

Seen and not used:

- **`GET /inventory/fixedPrices`:** exists, empty when prices are daily.
- **`GET /bookings`:** needs `read:bookings`. Even without the personal-data scope it returns
  comments and notes; the site never needs it.
- **`GET /channels/booking/reviews`:** marked Alpha. The response shape is unknown.
- **`GET /properties/rooms`:** marked "Coming soon"; answered empty, later 500.
- **`POST /bookings` and `POST /channels/stripe`** (`createStripeSession`, Alpha): an own checkout
  is possible in principle, with a write token.
- **Webhook URL:** a property setting. It could drop the cache when a booking arrives.

## Bookable weeks

The weekly rule is configured in Beds24 as `minStay` 7 on every date plus the override "No check in
or out" on every day except the arrival weekday. With it, `offers` answered:

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

`calendar` shows most of this, so the site derives the grid from data and hard-codes no weekday. A
week is bookable when all of these hold:

1. Its first and last day carry `override: "none"` (closed days carry `"noCheckInOrCheckOut"`).
2. Its seven nights have `numAvail` 1 and a price.
3. Its first night is at least `minDaysUntilCheckin` days away.
4. The guest count is at most the room's `maxPeople`.

Traps:

- **The lead time is invisible in `calendar` and `availability`.** It is in `properties` as
  `priceRules[].minDaysUntilCheckin` (beside `maxDaysUntilCheckin`, `minimumStay` and
  `maximumStay`). Unused rules come back as bare `{id}` entries. The site applies it itself.
- **`maxStay` may be set where the control panel shows it empty.** `calendar` returned 7 with an
  empty Max Stay row.
- **The price does not depend on the guest count** (`priceFor: maxCapacity`).

Checked on 17 November 2026 against a real account with two properties of one room each, with the
read-only token, for the free-weeks list:

- **Nights an owner has not priced** come back without a `price1` field (never as `0`), with
  `numAvail` 0 and, at the start of the calendar, `override` `none` on every day. So an unopened
  week looks taken by its availability and is told apart only by its missing prices. The site treats
  a season without any fully priced week as not open yet, unless it has begun; then it says no week
  is free. It reads a `price1` of `0` like a missing one.
- **One `calendar` call covers a year** (today plus 372 days, both rooms): one page, every day
  listed, 1 credit. The `properties` call with rooms, price rules and upsell items cost 1.3.
- **The lead time's boundary:** a week arriving exactly `minDaysUntilCheckin` days after today is
  offered, one a week earlier is not (checked with `offers` at a lead time of 25 days, in the
  evening, Central European Time). The site counts from the server's today and takes the smallest
  value among the rules that carry one; the two rooms had different lead times.
- **The site's week prices equal `offers`** to the cent for sixteen weeks of both rooms (the sum of
  the nights times `*0.9`, rounded to the cent).
- **A booked week** (checked on 19 November 2026, with one booking of a week in one room): its seven
  nights come back with `numAvail` 0 and keep their `price1`, so it is told apart from an unpriced
  week; its departure day has `numAvail` 1 again. `offers` returns the room without an `offers`
  array for that week and offers the weeks before and after it. The site shows the week as booked
  for that room only, the other room's week priced, and the neighbouring weeks at the `offers`
  price.
- **The tourist tax** was an upsell item of type `obligatory` on one property and `obligatoryTax` on
  the other, both per adult and night; the site reads both.
- **A day the calendar does not list** counts as closed and unpriced (not seen on the wire).

## Prices

- **Daily prices** arrive as `price1` on the calendar ranges.
- **The week price** is the sum of the seven daily prices times the property's
  `bookingPageMultiplier`. `offers` and the guest form apply the multiplier; `calendar` does not.
  The `multiplier` in `calendar` is a different, per-day value.
- **The multiplier is a string and must be written `*0.9`.** Written `0.9`, it is returned but
  applied nowhere. The site reads `*` and a number; an empty or missing value as 1 (not checked on
  the wire); anything else, a bare `0.9` included, as unreadable, and then shows no week of that
  property and logs why.
- **No rounding:** a week of 7 × 150.50 (1,053.50) shows as 948.15.
- **Daily prices within a week need not be equal.** Where a price period ends on the arrival day,
  that day carries the old price and the other six the new one.
- **Cleaning** is part of the daily price by choice of setup, so there is no fee line. The room's
  `cleaningFee` field exists.
- **Tourist tax** is an upsell item on the property: `type` `obligatory` or `obligatoryTax`,
  `amount`, `per: adult`, `period: daily` or `oneTime`, and its name per language in
  `upsellItemName1`. It is not part of an offer's price, and the room's `taxPerson` and
  `taxPercentage` stay 0. The guest form adds it as its own line: 2.50 × 2 adults × 7 nights =
  35.00, for three adults 52.50. Grand total in the example: 983.15.

## Guests

Checked on 20 November 2026 on a real account with a read-only token.

- **A room carries three limits:** `maxPeople`, `maxAdult` and `maxChildren`. `maxAdult: null` (the
  control panel's "Use Guests") allows up to `maxPeople` adults. `maxChildren: null` ("Don't Ask")
  treats children as adults, and the booking page asks only for guests; a number allows up to that
  many children.
- **`maxChildren: 0`** is the control panel's "None". Whether it refuses children or only stops
  asking for them is not checked, so whether a family may stay in such a room is open. The site
  treats it like "Don't Ask", by the maintainer's decision: one count of guests, each handed over as
  an adult.
- **The site supports a room by its total alone:** `maxAdult` empty or equal to `maxPeople`, and
  `maxChildren` empty, 0 or at least `maxPeople − 1`, so that any guest may be an adult and, with
  one adult required, the children's limit never applies on its own. A room limited further is
  logged as a warning when the data is loaded and treated by its total, by the maintainer's
  decision: the apartments are for families and friends alike.
- **`offers` enforces the limits** (`numAdults`, `numChildren`): a stay over `maxPeople` in total,
  or over `maxChildren`, gets no offer. The price does not change with the mix
  (`priceFor: maxCapacity`).
- **`offers` accepts a stay without adults** (0 adults and 1 child was offered), so the site
  requires one adult itself.
- **Beds24 has no age for a child or a baby** anywhere in `properties`. Where a child ends depends
  on the place, usually on its tourist tax exemption, so the age limit is a deployment's content.
- **A tourist tax per adult is charged for adults only** on the guest form (checked on 21 November
  2026): two adults with two children (`numadult=2&numchild=2`) pay the same tax line as two adults
  alone, four adults twice that, and the form lists the children as such. With "Don't Ask" every
  guest counts as an adult.
- **A tax item can also be per room** (`per: room`, the control panel's "per Apartment"): the guest
  form then charges it once per night, whatever the guests. The site reads only an item per adult.
- **A booking question,** such as a cot as a tick box, is configured on the property; see
  [Booking questions](#booking-questions).

## Listing data

- **A room is the listing; a property groups rooms.** Every inventory call is keyed by `roomId` and
  returns `propertyId` beside it.
- **Facts:** on the property the address, city, country, coordinates, check-in and check-out times
  (`checkInStart`, `checkInEnd`, `checkOutEnd` as `HH:MM`; midnight is `"24:00"`), `permit` (the
  registration number, `""` where none is set) and `featureCodes`; on the room `roomSize`,
  `maxPeople`, `maxAdult`, `maxChildren`, `minStay`, `maxStay` and its own `featureCodes`.
- **Feature codes** come as two lists, the property's and the room's. The control panel shows the
  property's codes as applied to each of its rooms; the API does not merge them. Each entry is a
  group: a property code is a group of one (`["WIFI"]`), and a room's groups carry the sleeping
  layout, such as `["BEDROOM", "BED_DOUBLE"]` or `["BEDROOM_OTHER_SLEEPING_AREA", "BED_SOFA"]`.
  Labels and icons are the site's.
- **A code is any string.** The OpenAPI file lists none, and a code of one's own typed into a room's
  list arrives as a group of its own, `["SOME_CODE"]` (checked on 19 November 2026). How a channel
  treats a code it does not know is not known.
- **A room's groups relate to one another only by their order.** Nothing says which bathroom belongs
  to which bedroom.
- **Texts come per language**, each language an entry in `texts[]` with all its keys and empty
  strings where nothing is written. A room has an entry for every language the account ever had, a
  switched-off one included. A property without any text has no `texts` key; one with any text has
  all its keys in each of its languages. Plain texts keep `\r\n` line breaks and may end in spaces.
- **Where each text is written** (marked with its control-panel name on 19 November 2026):

  <!-- prettier-ignore -->
  | Control panel | Key | Kind |
  |---|---|---|
  | Room: Room Headline | `contentHeadline` | plain |
  | Room: Room Description | `contentDescription` | plain |
  | Room: Booking Engine, Room Description 1 | `roomDescription` | rich |
  | Room: Auxiliary Text, for message templates | `auxiliary` | rich |
  | Property: Headline, Property Description, Location Description, Directions, House Rules, General Policy, Cancellation Policy | `headline`, `propertyDescription`, `locationDescription`, `directions`, `houseRules`, `generalPolicy`, `cancellationPolicy` | plain |
  | Property: Property Description 1 and 2, Booking Page 1 and 2, the guest form's headers and messages | `propertyDescription1`, `propertyDescription2`, `propertyDescriptionBookingPage1`, `propertyDescriptionBookingPage2`, `guestDetailsHeader`, `guestEnquiryHeader`, `confirmBookingButtonMessage`, `roomNotAvailableMessage`, `roomNoPriceMessage`, `noRoomsAvailableMessage` | rich |

- **Rich text is the Summernote 0.9 editor's HTML, stored as written:**
  - blocks (headings, quotes, `pre`, tables) nested inside a `<p>`, which an HTML parser repairs;
  - `<b>`, `<i>`, `<u>`, `<strike>`, `<sup>`, `<sub>`, and bold also as
    `<span style="font-weight: bolder">`;
  - `<font color face>`, inline styles on any element and `class=""` on blocks;
  - U+FEFF characters at the start of styled spans;
  - `<p><br></p>` as spacing, and a text left empty as `<p><br></p>`;
  - tables with Bootstrap classes and no header cells;
  - links with `http://` and `target="_blank"`, and an empty link around a `<br>`;
  - pictures as `<img>` from the Beds24 picture host, with a fixed width and no alternative text.

  The property's slots also carry styles pasted from the control panel itself. Rich text passes a
  sanitiser with a small allowlist.

- **Pictures are not in the API** (checked again on 19 November 2026). `includePictures=true`
  returns no picture field, and the picture schema is commented out in the OpenAPI file. The control
  panel shows a public URL per picture, built from the property ID and a two-digit number. The files
  load without a token, as PNGs without cache headers or an ETag; a missing number answers 404 with
  an HTML body. An upload of 4080 × 3072 px was stored as 2000 × 1506 px with an alpha channel, 3.6
  MB; older uploads are 1100 px wide or less, around 1 MB. The number is given at upload and carries
  no order.
- **The control panel keeps more per picture than the URL:** an ID such as `P<property ID>-19`, a
  position that orders the gallery without changing the number, a resize setting, a caption per
  language and tags. The API sends none of it yet.

## The booking page

**Links.** Both are plain GETs on a fresh session:

- The calendar:
  `https://beds24.com/booking2.php?propid=…&checkin=YYYY-MM-DD&numnight=7&numadult=2&lang=de`.
- The guest form directly:
  `booking2.php?propid=…&page=book3&checkin_hide=YYYY-MM-DD&numnight=7&numadult=2&br1-<roomId>=Book`.

**Behaviour of the guest form:**

- **It shows** a summary (week price with the multiplier, the tourist tax line, the grand total)
  beside twelve fields. Title, first name, surname, e-mail and country are required.
- **`lang`** translates the form and the tax label. The listing name and the room type text stay as
  written in Beds24.
- **It does not refuse an unbookable week:** the form renders with "Sold" and a total of 0.00. The
  site must link bookable weeks only.
- **Session:** the ID is in a `booking` cookie without a `SameSite` attribute, and also in a hidden
  field and in the page's links. The form posts to the same page.
- **Labels:** no field has a `<label>`; each input is named by an `aria-label` only.
- **Back buttons** are links to the Beds24 calendar (`book_bookingback`, `book_bookingbackright`).
  No parameter for a return address exists.
- **An unpublished page** answers "Online booking isn't available for this property yet"; so does a
  page whose payment gateways are all disabled. The control panel issues a `b24preview` cookie that
  opens it for about an hour.

**Embedding** (checked in headless Chromium at 1280 px and as an iPhone 13, through a local proxy
that injected what the settings below would carry):

- **The frame is allowed:** no `X-Frame-Options` and no frame policy.
- **Restyling** goes through two booking engine settings: "Custom CSS", and "Insert in HTML
  <BODY> bottom" for a script. About 60 lines of CSS hide the back buttons, the "Book
  <property>" strip, the secure logo and the "powered by" line, and restyle panels, fields and
  the confirm button. The hooks are stable IDs and classes (`b24-guestdetails`,
  `b24-bookingdetails`, `book_confirmbookingbut`, …) on Bootstrap 3 markup.
- **The page sends nothing to its parent.** The injected script reports the content height (914 px
  on desktop, 1821 px on the phone) and the step shown (guest form, calendar, other) through
  `postMessage`.
- **Scrollbars:** removing the container's padding makes Bootstrap's rows overflow by 15 px and
  produces both scrollbars. Use a negative margin on `#bookingpage`, `overflow: hidden` on the
  framed document and `scrolling="no"` on the iframe.
- **Phone:** the summary stacks above the form; fields at 16 px avoid the iOS focus zoom.

**After "Confirm Booking"** (2026-11-26, in Chromium, Firefox and Playwright's WebKit, the guest
form framed by a page on another site):

- **The booking exists before the payment:** the submit saves it as `cancelled` and opens a payment
  page ("Payment Required", Stripe's card field, a "Cancel Booking" button) that repeats every
  field. A booking abandoned there stays cancelled and never blocks the week. A paid one gets a
  payment item (`type: payment`, `subType` 203, status `Paid`) and the info items `CARDTOSTRIPE` and
  `STRIPEPAYMENT`.
- **The framed form posts without its cookie.** Chromium and WebKit refuse the `booking` cookie in a
  frame on another site, where a cookie without `SameSite` counts as `Lax`; Firefox keeps it,
  partitioned. The post still reaches the payment page, because the session travels in the hidden
  field.
- **The payment page breaks out of the frame** with
  `if (top != self) top.location.replace(location)` while "Open in New Window" is set to its frame
  killer. In Chromium and WebKit that loads the form's address at top level as a new request: a new
  session and an empty form, the guest's details gone. Firefox blocks the navigation, and the
  payment page stays in the frame. With the frame killer off: not tried.
- **On a trial account** the submit answers a bare page reading "An error has occured" and creates
  no booking.
- **"Booking Return URL" and "Booking Failed URL"** redirect to the site's own pages (settings read
  in the control panel, not tried). The return carries the booking as query parameters: `bookid`,
  `propid`, `roomid`, `roomname`, `propname`, `status` (1 or 2 confirmed, 3 on request),
  `firstnight`, `lastnight`, `checkout`, `numnight`, `numadult`, `numchild`, `lang`, `price`, `qty`,
  `pricenum`, `referer`, `ratedesc`, and the guest's `guestname`, `guestfirstname`, `guesttitle`,
  `guestemail` and `guestphone`. They are unsigned.
- **"Booking Redirect"** (a setting, not tried) sends a visitor of the booking page to another
  address, immediately or when "Book" is pressed, with the stay in template variables such as
  `[ROOMID]`, `[FIRSTNIGHTYYYY-MM-DD]`, `[NUMADULT]` and `[GUESTLANGUAGE]`.
- **Also there:** guest verification (captcha, e-mail code) and "Confirmation Page Insert in HTML
  <HEAD>".

## Booking through the API

Checked on 2026-11-26 with a token holding the five scopes above, on both rooms of the account.

- **`POST /bookings`** takes an array and answers per item. A new booking with `status: new`, the
  stay, `numAdult`, the guest's name, e-mail, `country2` and `lang` is saved with `referer: API`,
  `price: 0` and no invoice items: Beds24 prices nothing. The site sends `price` and the invoice
  items (`type: charge`, `description`, `qty`, `amount`) itself. Without `price` Beds24 shows 0
  beside the items.
- **A `new` booking blocks the week** at once: `calendar` shows `numAvail` 0 and `offers` returns no
  offer for it.
- **An overlapping booking is saved without complaint,** unless the item carries
  `actions: { checkAvailability: true }`. Then Beds24 refuses it and saves nothing. The answer is
  still 201, its item
  `{ "success": false, "errors": [{ "action": "new booking", "field": "no availability", "message": "invalid" }] }`,
  for 1.1 credits (recorded on 2026-11-27 for a week taken on every night).
- **`actions: { notifyGuest: true }`** sends Beds24's guest confirmation, also for an existing
  booking. With the account's settings at the time, an API booking without it got no e-mail. The
  confirmation lists the invoice items' descriptions word for word.
- **An update** goes through the same call with the booking's `id`: a status (`confirmed`,
  `cancelled`), invoice items to add, any guest field. An unknown `id` answers 201 with
  `{ "success": false, "errors": [{ "action": "modify booking", "message": "access denied" }] }`.
- **A payment** is an invoice item with `type: payment` and a positive `amount`. Beds24 keeps it as
  a negative line (`subType` 204) and shows the outstanding amount as 0.
- **A booking saved with a warning answers `success: false`.** An unknown `country2` (`XX`) was
  dropped and the booking saved without a country; its item carried `success: false`, the `new`
  booking with its `id` and `warnings: [{ "field": "country2", "message": "invalid value" }]`. The
  booking holds its week like any other, so an answer is read by its `new.id`, not by `success`.
- **`POST /channels/stripe`** (marked Alpha) has an action `createStripeSession` for a booking. On
  this account, whose Stripe gateway is set up with API keys, it answered `[{"success":false}]` for
  a valid booking whatever the parameters, and "access denied" for an unknown one. Its documentation
  describes sessions on Beds24's Stripe Connect platform, with a live publishable key; not tried
  further. Its action `addPaymentMethod` takes raw card numbers.

## Booking questions

Checked on 2026-11-27 on two properties set up for it, with the token above; every booking tried was
cancelled at once.

- **`properties` returns `bookingQuestions`** per property, without an `include*` parameter: for
  each of 16 standard guest fields (`guestTitle`, `guestFirstName`, `guestLastName`, `guestEmail`,
  `guestPhone`, `guestMobile`, `guestFax`, `guestCompany`, `guestAddress`, `guestCity`,
  `guestState`, `guestPostcode`, `guestCountryText`, `guestCountrySelect`, `guestArrivalTime`,
  `guestComments`) a `usage` and an `order`, and the same for `customQuestion1` to
  `customQuestion10` with a `type`.
- **`usage`** is `notUsed`, `optional`, `compulsory`, `compulsoryBookingPage` or `internal`. The
  control panel's help: `optional` is asked on the booking page, `compulsoryBookingPage` must be
  answered there, `compulsory` also in the control panel's booking wizard, `internal` only in the
  control panel, `notUsed` nowhere.
- **`order`** sorts standard and custom questions together, as the control panel's question order
  lists them; a question moved there changes its number. A question that is not used may carry
  `null`.
- **`type`** is `singleLineField`, `multiLineField`, `multipleSelect`, `multipleList`, `tickBox` or
  `dateSelector`. On Beds24's booking page `multipleSelect` is a dropdown and `multipleList` a group
  of radio buttons; both take one choice.
- **A custom question's text** comes per language in the property's texts as `customQuestion1` to
  `customQuestion10`. A choice question carries its options in square brackets after the question,
  in each language: `Arrival by [Car][Train][Plane]`. A text can be missing in a language. The
  standard fields come without any label.
- **`POST /bookings` stores the answers** as `custom1` to `custom10` and the standard fields under
  their own names (`title`, `phone`, `mobile`, `country2`, `arrivalTime`, `comments`, …). A choice
  is the option's text; a ticked box is `"1"`, which the control panel shows as ticked. Any other
  text is stored too: `Car, Plane` for a single choice showed in the control panel as one more
  option. A date is `YYYY-MM-DD`: `2027-01-03` sent through the API showed as such, and the control
  panel's date picker, which displays a long date while it is open, saves the same form.
- **The API enforces no `usage`.** A booking without a `compulsory` phone, and one without a
  `compulsory` tick box, were saved.
- **Nor does it check a value's form:** an e-mail `not-an-email` and a phone `abc` were stored. Only
  an unknown `country2` was refused, with the warning above.
- **`paymentCollection`** on the property holds the booking page's deposits: `depositPayment1` and
  `depositPayment2`, each a `fixedAmount` and a `variableAmount` (`type: percentage`,
  `percentageValue`), and `depositNonPayment` (what happens to an unpaid booking, `cancel`).
- **`bookingRules`** on the property holds how the booking page takes a booking: `bookingType`, one
  of `autoConfirmed`, `requestWithManualConfirmation`, `requestWithCreditCard`,
  `confirmedWithCreditCard`, `confirmedWithDepositCollection1`, `confirmedWithDepositCollection2`
  and `blackoutPeriod`; the same choice as `bookingNearType` for arrivals within
  `bookingNearTypeDays` days (`null` when off), and as `bookingExceptionalType` between
  `bookingExceptionalTypeStart` and `bookingExceptionalTypeEnd`. "Confirmed with deposit collection
  1" with deposit 1 at 100 % and deposit 2 at 0 describes what the site does: the guest pays the
  full price to confirm. Both settings apply to Beds24's own booking page and gateway, not to a
  booking made through the API.

## Paying through Stripe Checkout

Checked on 2026-11-26 in Chromium with the business's own Stripe account in test mode. The site
talks to Stripe directly; Beds24 is told afterwards.

- **A restricted key** allowed only "Checkout Sessions" creates, reads and lists sessions;
  customers, charges and the balance answer "Permission denied". It belongs to the same Stripe
  account as Beds24's gateway, so both kinds of payment arrive in one place.
- **A session** carries one line with the total in cents, `customer_email`, the booking ID in
  `client_reference_id` and `metadata`, `locale`, `payment_method_types[0]=card`, an `expires_at` 30
  minutes ahead and a `success_url` with `{CHECKOUT_SESSION_ID}`. Its `url` opens Stripe's page in
  the same tab, in the language asked for.
- **Without `payment_method_types`** the page offers whatever the account has switched on; the test
  account had Klarna, Bancontact and EPS beside cards. Such methods can complete after the guest has
  returned.
- **After the payment** Stripe redirects to `success_url` with the session's ID. Reading the session
  gives `status: complete`, `payment_status: paid`, `amount_total` and the metadata. A plain test
  card and a 3-D Secure test card, its challenge passed, both worked. From the booking to
  `confirmed` in Beds24 took about ten seconds.

## What follows for the site

- **One process with an in-memory cache is enough**, refreshed on a timer, with the last good
  responses on disk: listings come from Beds24, so a start without it would show an empty site.
- **The grid is built from `calendar` and `properties`** by the rules above, and a test compares it
  with `offers`, edge of the lead time included.
- **The content files keep what the API lacks:** per listing the room ID, a slug and the pictures
  with alternative texts. The site converts and serves its own copies of the pictures.
- **The booking step is the site's own form** (ADR 18). The server checks the offer, creates the
  booking with `checkAvailability`, the price and invoice items in the guest's language, and sends
  the guest to Stripe Checkout. On the return it reads the session, records the payment, confirms
  the booking and has Beds24 send the confirmation. The site stores none of it.
- **The form asks what Beds24's booking questions ask** (ADR 19): Beds24 decides which fields and
  questions are shown, which are required and in which order; the site labels the standard fields,
  validates every answer itself, and books a property only when its booking rules ask for one
  payment of the full price.
- **One token does everything,** with the five scopes above, renewed from a refresh token. It can
  change any booking, so Beds24's IP allowlist limits it to the server's address.
- **The simulator's surface is small:** `authentication/details` and the token refresh,
  `properties`, `calendar`, `offers`, `POST /bookings`, and Stripe's Checkout Sessions with a fake
  checkout page. Its data includes a week with unequal daily prices, a taken week and a week inside
  the lead time.

## Not verified

- **The framed guest form with the frame killer off,** and in Safari on a real device. ADR 18 no
  longer needs either.
- **`createStripeSession` on Beds24's Stripe Connect,** which needs a Stripe account approved for
  live payments.
- **Stripe in live mode:** live keys, wallets, and a real card's 3-D Secure.
- **Stripe's cancel return and a session left to expire:** documented by Stripe, not run.
- **Whether a Beds24 auto action** fires for a booking made through the API.
- **The time zone of the lead time's days,** near midnight.
- **Whether the override reaches the channels** as closed to arrival and departure.
- **A property with several rooms:** known from the API's structure only.
- **The form of a title:** `Mr` was stored as sent; what Beds24's own booking page offers and writes
  is not checked.
- **The language of a choice:** whether Beds24's booking page stores the option's text in the
  guest's language or in the first one.
