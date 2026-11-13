# The Beds24 simulator

A small server that answers like the Beds24 API, from invented data. It is the demo's Beds24
and the e2e tests' Beds24; the site itself never knows the difference. The wire shapes follow
[`docs/beds24-findings.md`](../docs/beds24-findings.md).

```sh
npm run sim   # http://localhost:4300/v2, header "token: simulator"
```

Node runs the TypeScript files directly, so there is no build step and no dependency.

## What it answers

<!-- prettier-ignore -->
| Call | Answer |
|---|---|
| `GET /v2/properties` | The two houses with their three apartments. Rooms, texts, price rules and upsell items appear when their `include*` parameter is passed; `id` filters. |
| `GET /v2/inventory/rooms/calendar` | Per room the compressed date ranges between `startDate` and `endDate`, with the fields whose `include*` parameter is passed; `roomId` and `propertyId` filter. |

A call without the token answers 401 `Token not valid`, in the body Beds24 sends. Every answer
carries the three rate limit headers; the budget is counted and never enforced.

## The data

_Firn & Farn_ does not exist. Saalbach and the two lifts named in the texts are real; the
houses, their addresses and positions, the prices and the tourist tax are invented.

The calendar is a function of the room and the date, so a week that is booked stays booked as
the days pass:

- **Stays** run from Saturday to Saturday: every other day is closed to arrival and departure.
- **Prices** follow yearly periods that change on a Saturday. Between the seasons there are
  none. Where two priced periods meet, the arrival day keeps the old price.
- **Bookings** are drawn from the room and the week: about a third of the weeks are taken, more
  in the peak periods, and some weeks have single nights taken.
- **Apartment Zirbe** is booked out every winter.
- **The lead time** is seven days, so the nearest Saturday is always inside it.

## What differs from Beds24

- **Left out:** the blocks of a property the site never reads (payment gateways, booking
  questions, vouchers, units and the like), every other call, and the booking page.
- **Not recorded on the wire, so the simulator's own:** what `properties` returns when only
  some `include*` parameters are passed, the calendar's answer without any, and every error
  other than the 401.
