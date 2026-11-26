# ADR 18: The booking step: an own form, the Beds24 API and Stripe Checkout

Status: accepted, 2026-11-26. Group: product. Replaces the booking step of ADR 1.

## Context

ADR 1 chose a hand-over to the Beds24 guest form, framed on the site, and rejected an own checkout
because it would bring payments, personal data and stored bookings into our code. It left the
payment, the return to the site and the frame in Safari open, and named an own checkout as the
remaining option if the hand-over failed.

A spike on 2026-11-26 tried both, against the business's Beds24 account, which could now take
bookings, and its Stripe account in test mode. The results are in `../beds24-findings.md`. What
weighs:

- **The frame breaks at the payment.** Beds24's guest form posts without its cookie, but its payment
  page reloads itself at top level while the frame killer is set. In Chromium and WebKit that starts
  a new session and shows an empty form. Firefox blocks it.
- **The guest form stays Beds24's** even where it works: twelve fields whose names are only
  `aria-label`s, a required free-text title, a payment page that repeats every field, and a look
  that custom CSS on Bootstrap 3 markup only partly changes.
- **The API can do the booking.** `POST /bookings` holds a week the moment it is saved, refuses a
  taken week with `checkAvailability`, and sends Beds24's guest confirmation with `notifyGuest`.
- **Stripe can hold the payment without us.** Stripe Checkout takes the card on Stripe's page, so no
  card data reaches the site, and a key restricted to Checkout Sessions can do nothing else.
- **The volume is small:** a few dozen bookings a year.

## Decision

1. **The booking step is the site's own form:** the stay, the guest's details, the rental terms and
   one button that says booking means paying.
2. **The server books the week in Beds24** with status `new`, the price and invoice items in the
   guest's language, and `checkAvailability`, so the week is held while the guest pays and Beds24
   refuses one taken in the meantime.
3. **The guest pays on Stripe Checkout,** reached by a redirect in the same tab. The session belongs
   to the business's Stripe account, is created with a key restricted to Checkout Sessions, carries
   the booking's ID, accepts cards, and expires after 30 minutes. If Stripe refuses the session, the
   booking is cancelled at once.
4. **The return proves nothing by itself.** The server reads the session from Stripe and trusts only
   what its own key set when it created the session: the booking's ID in the metadata and the
   amount. A session paid in full, and not yet marked, is recorded in three steps: a payment item
   and `confirmed` in Beds24, then a mark in the session's metadata, then Beds24's confirmation to
   the guest.
5. **A timer settles the rest.** Every few minutes the server lists the sessions whose expiry time
   passed more than ten minutes ago: one paid and not marked is recorded as on the return, one
   unpaid has its booking cancelled. A guest can pay only before the expiry time and is sent back
   straight after paying, so the margin keeps the timer away from a return still at work.
6. **Failures the site cannot settle go to the host.** The server logs what the host needs to find
   the booking in Beds24, never guest data, and the host settles it there by hand:
   - Beds24's answer to a new booking is lost: the room and the stay. A `new` booking from the API
     without a payment, older than an hour, is such a hold, and is cancelled.
   - Stripe's answer to a new session is lost: the booking's ID. Its session, if it exists, is
     settled by the timer; otherwise the booking is cancelled.
   - Beds24 took the payment, but marking the session failed: the timer records it again, and the
     second payment item is removed.
   - The session is marked, but Beds24's confirmation was not sent: the booking's ID, and the host
     sends the confirmation from Beds24.
7. **The site stores nothing.** Beds24 holds the booking, Stripe the payment. Guest data passes
   through the server and is never logged.
8. **One Beds24 token** with write on bookings, guest data and finances and read on inventory and
   properties, renewed from a refresh token and limited to the server's address by Beds24's IP
   allowlist.
9. **Beds24's own booking page redirects to the site,** so its form is not used on its own.

## Options

<!-- prettier-ignore -->
| Option | For | Against | Result |
|---|---|---|---|
| The Beds24 guest form in a frame (ADR 1) | Beds24 collects the guest's data and takes the payment; nothing of it is ours. | The payment page leaves the frame and loses the guest's details in Chromium and WebKit. With the frame killer off, and in Safari, it is untried. Its fields, labels and look stay Beds24's. | Rejected. |
| The Beds24 guest form as a full page | No frame. Nothing of it is ours. | The guest leaves the site for a form that looks and reads as Beds24 allows, with the accessibility limits above. | Rejected. |
| An own form, with the payment through Beds24's `createStripeSession` | Beds24 would link the payment to the booking itself. | Marked Alpha. On an account whose Stripe gateway uses API keys it answered `success: false` without a reason. Documented for Beds24's Stripe Connect, which needs a Stripe account approved for live payments, so it could not be tried. | Not pursued now. It could later replace the own Stripe call. |
| An own form, with the payment through the business's own Stripe Checkout | The form, its wording and its accessibility are ours. Card data stays on Stripe's page. Tried end to end in test mode. | A Stripe key and a write token on the server, guest data passing through it, and keeping Beds24 and Stripe in step is ours. | Chosen. |

Within the chosen option:

<!-- prettier-ignore -->
| Option | For | Against | Result |
|---|---|---|---|
| Checkout as a redirect to Stripe's page | No script of Stripe's on the site; Stripe handles 3-D Secure. | The guest sees Stripe's page, with the business's name and logo, for one step. | Chosen. |
| Checkout embedded in the site's page | The guest stays on the site. | Stripe's script on the site, an entry in its content policy, and Stripe's fraud cookies. | Rejected for now; its own issue if the redirect feels foreign. |
| A Stripe webhook for payments that never return | Immediate. | A public endpoint, a second secret, and a sender the simulator and the tests must fake. | Rejected. |
| A timer that lists recent sessions | No endpoint and no further secret; the restricted key may list sessions. | A paid booking without its guest's return is confirmed only ten minutes after the session's expiry time, up to about 45 minutes later. | Chosen. |

## What this rests on

- **Verified in the spike** (2026-11-26, Stripe in test mode): the framed form's behaviour in
  Chromium, Firefox and Playwright's WebKit; `POST /bookings` with and without `checkAvailability`;
  `notifyGuest` sending the confirmation; a token with only the five scopes running the whole flow
  and failing to read a booking; a Checkout session paid with a plain test card and with a 3-D
  Secure test card, read back on the server, and recorded in Beds24 as a payment and `confirmed`.
- **Also verified:** the restricted key lists sessions; the invite code's exchange and the refresh
  of an access token.
- **Taken from documentation:** that an unpaid session expires at its `expires_at`, at the earliest
  30 minutes after it is created; that a refresh token lives while it is used within 30 days;
  Beds24's description of `createStripeSession`.
- **Not checked:** Stripe in live mode, wallets and a real card's 3-D Secure; Stripe Checkout in
  Safari on a real iPhone; the cancel return and an expired session; any of the failures in decision
  6, and whether its cases are all there are; the IP allowlist; refunds.

## Consequences

- **Keeping Beds24 and Stripe in step is ours.** The booking exists before the payment and is
  confirmed after it, and every step must survive a reload or a closed tab. A failed or lost call
  between the two services is rare at a few dozen bookings a year; the site logs it and the host
  settles it by hand (decision 6), rather than the site carrying a store of its own to settle it
  alone.
- **The site carries two secrets:** the Beds24 token, which can change any booking, and the Stripe
  key. Both stay on the server and out of logs.
- **Guest data passes through the site** on its way to Beds24 and Stripe, so the privacy page says
  so.
- **The site sends the price.** Beds24 prices nothing booked through the API, so the server takes
  the week's price from `offers` and the tourist tax as Beds24 has it, and words the invoice items
  the guest will read in Beds24's confirmation.
- **Refunds and cancellations are made by hand,** in Stripe and in Beds24.
- **Live payments need Stripe's approval,** which reviews the public site. A deployment therefore
  goes public before its booking does.
- **The simulator takes bookings and plays Stripe Checkout,** so the demo and the e2e tests can book
  and pay without either service.
- **The form's accessibility and wording are ours,** the button's included.
