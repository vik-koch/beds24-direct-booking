# ADR 13: The booking panel's view in a cookie

Status: accepted, 2026-11-22. Group: stack.

## Context

The booking panel on an apartment page shows the free weeks as a list or as a calendar. The view
first travelled in the address as `?view=calendar`, and every link that did not add it, such as the
footer's, dropped it. It is a personal preference, like the season, and a shared link should not
force the sender's view on the receiver. What weighs on it:

- **The panel renders one view at a time.** With Zirbe's five months, its page is 86 kB of HTML with
  the list and 116 kB with the calendar.
- **The panel is painted long before the application starts.** Measured in Chromium on 2026-11-22,
  on a first visit with the cache off: with no throttling the panel paints after 0.1–0.5 s and the
  application starts 0.2 s later. On slow 4G (1.6 Mbit/s, 150 ms) with the CPU slowed four times,
  the panel paints after 1.1–1.3 s and the application starts after 6.0–6.4 s, at 390 px and at 1280
  px alike.
- **Apartment pages are rendered per request,** because they show Beds24's live weeks, and no
  response sets a cache lifetime. The view exists only on those pages.

## Decision

1. **The view lives in a cookie,** `view=calendar` with `Path=/`, `SameSite=Lax` and a `Max-Age` of
   30 days, the season's time limit, counted from the last choice. Choosing the calendar sets it.
   Choosing the list, the default, removes it. A page the browser restores from its back/forward
   cache reads the cookie again.
2. **The server reads the cookie** from the request and renders that view, so the first paint is
   right at any network speed. Apartment pages answer with `Vary: Cookie`; the others do not depend
   on it.
3. **The address carries no view,** and the site's links add none. `?view=` was never in a release.

## Options

<!-- prettier-ignore -->
| Option | For | Against | Result |
|---|---|---|---|
| The view in the address | A shared link shows the same view. | Every link must carry it, and a shared link forces the sender's preference on the receiver. | Replaced. |
| Local storage, and the application switches once it starts | No new mechanism. | The list shows for up to five seconds on a slow phone, then changes. | Rejected. |
| Local storage, and the panel hidden until the application starts | No wrong view is painted. | The panel is empty for up to five seconds. | Rejected. |
| Local storage, both views in the page, a head script picks one, as for the season (ADR 8) | One mechanism for both preferences. | Each apartment page carries the list's markup and the calendar's, more than either alone, and both grids are hydrated and kept in step on every choice. | Rejected. |
| A cookie, read by the server | The server renders the remembered view: no second grid, no head script. | A cookie beside the season's local storage, and the view depends on the page being rendered per request. | Chosen. |

ADR 8 rejected a cookie for the season because it would make prerendered pages and shared caches
vary by visitor. The view is not on a prerendered page.

## What this rests on

- **Verified by the e2e suite:** the calendar chosen on one apartment shows on others reached
  through the footer, the header and the home page, with no view in any address. The cookie is set
  to last 30 days, and a new browser context with it shows the calendar at the first paint with the
  application held back. A restored page takes a choice made since. Choosing the list removes the
  cookie. Only apartment pages vary by the cookie.
- **Documented, not verified:** Safari caps a persistent cookie written by `document.cookie` at
  seven days from the write
  ([ITP 2.1](https://webkit.org/blog/8613/intelligent-tracking-prevention-2-1/)), so there the
  calendar is kept for seven days, not 30. The season's local storage falls under a separate rule:
  Safari deletes it after seven days of Safari use without a click, tap or key press on the site
  ([WebKit, 2020](https://webkit.org/blog/10218/full-third-party-cookie-blocking-and-more/)). A
  visitor who returns after eight days without opening Safari may therefore find the list with their
  chosen season. A cookie the server sets is not capped by that rule, but it would need a request on
  every change of view.
- **Not checked by an engine:** a real return from the back/forward cache; Playwright's browsers do
  not use it, so the test sends the browser's `pageshow` event itself.
- **Not checked:** whether the cookie needs a consent prompt in the real site's country. The reading
  is the same as ADR 8's for the season: it is stored only on the visitor's action and only for that
  purpose, and it belongs on the privacy page.

## Consequences

- **If apartment pages are ever prerendered or cached in a shared cache,** this decision must be
  revisited, for example with both views in the page as the season does.
- **The cookie goes with every request to the site,** a few bytes, and only after the visitor chose
  the calendar.
