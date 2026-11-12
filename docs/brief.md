# Project brief

Status: the working brief, last revised 2026-11-12. A decision that shapes the code also gets a
short ADR in `docs/adr/`.

## What it is

A direct-booking website for a small business that rents holiday apartments by the week in a
mountain resort: two apartments now, four soon. Today the apartments are bookable on Booking.com
only. The website offers the same weeks at a lower price, because no commission is paid.

Beds24 is the property management system: it holds availability, prices and bookings, connects
the channels (Booking.com now, Airbnb next), and takes the booking and the payment. The website
shows what Beds24 knows and hands over to it for checkout.

The repository is public as a portfolio piece and carries a fictional demo only: apartments in an
Austrian alpine village, in German and English. The real business (another country, its own two languages)
is a private deployment that uses only what the public repository publishes. Nothing about the
real business goes into the public repository.

## Goals

1. A visitor finds a free week, sees its price and books it directly, on a phone as easily as on
   a desktop.
2. The site is the business's official page: who they are, where the apartments are, how to get
   in touch.
3. Guests find the practical guides there (self check-in, waste, FAQ), linked by QR code from
   printed sheets in the apartments.
4. The site is found: search engines get complete, fast, well-structured pages in both languages.
5. The legal pages a business in its country needs are complete.

## Non-goals in phase 1

- No database and no content editor: content comes from files in the repository.
- No own checkout or payment: Beds24 does both.
- No accounts, no guest messaging, no own reviews.
- No second environment: one deployment per site.

## Decisions so far

<!-- prettier-ignore -->
| Topic | Decision | Why |
|---|---|---|
| PMS | Beds24 | Strongest API for the price at this size. |
| Framework | Angular with SSR, content pages prerendered | Known framework; the new things are the workflow and the UI. |
| Server | One Node process: the SSR server with one availability route and an in-memory cache | The API token stays on the server; Beds24 limits calls to 100 credits per 5 minutes; a refresh costs about 3. No Redis, no separate backend. |
| Booking step | Own week view, then hand over to the Beds24 booking page with apartment and week preselected | Own checkout would bring payments and persistence. The hand-over is an iframe; see the open decisions for what is untested. |
| Primary view | A grid of weeks by apartment with price or "booked" | Stays are Saturday to Saturday; not every week is bookable. A week with any night taken shows as unavailable. |
| Listing | A Beds24 room is the listing (one apartment); a property is the group above it that carries address, coordinates, check-in times and house rules. A property may hold one room or several | The real business uses one property per apartment; the demo can show both shapes. The API keys availability and prices by room, so this costs nothing. |
| Bookable weeks | Derived from Beds24, not hard-coded: a week starts and ends on days without the "no check-in or out" override, has seven free, priced nights, and starts no sooner than the price rule's lead time | Verified in the spike; the weekday and the lead time stay Beds24 settings. The calendar does not apply the lead time, so the site does. |
| Week price | The sum of the daily prices from the calendar call times the property's booking page multiplier (a string such as `*0.9`); cleaning is part of the daily price | Matches `offers` and the Beds24 form, which apply the multiplier; `calendar` does not. One call for the whole grid, checked against `offers` in a test. |
| Pictures | The content file lists each listing's pictures: a source (a Beds24 picture URL or a local file), alternative texts per language and an optional season. Only listed pictures are shown, in the order of the list; a picture with a season shows in that season only. The site converts and serves its own copies | The API returns no pictures yet (announced). The Beds24 gallery also holds pictures of both seasons for the channels, so the list selects and tags. The files are 1 MB PNGs without cache headers, so linking them directly is out. Technical debt: the list moves to the API when it can. |
| Tourist tax | Shown beside the week price as its own line, from the property's obligatory upsell item (amount per adult per night); the total with tax appears once the guest count is chosen | The Beds24 form adds it the same way: week price plus amount × adults × nights. |
| Cache | In memory, refreshed on a timer, with the last good responses also written to disk | Listings come from Beds24 now, so a start while it is unreachable would show an empty site. |
| Other stay lengths | A contact address, no UI. Whole multiples of a week can be allowed in Beds24 through the maximum stay | Rare, and usually longer than a week. |
| Content | Beds24 holds what describes and prices a listing: availability, prices, capacity, size, sleeping layout and feature codes, check-in times, coordinates, tourist tax, and the listing's texts per language. The content files hold what Beds24 cannot: per listing a room ID, a slug and the pictures; and the site itself: its wording, season content, guides, company and legal pages | The business edits a listing in one place and it shows after the next cache refresh, without a deployment. Pictures are not in the API. Rich text from Beds24 passes a sanitiser. |
| Languages | Two per deployment, language in the URL (`/de/…`, `/en/…`), an explicit switch | One domain keeps the search ranking together. |
| Seasons | A content dimension, switched like a colour scheme: both seasons' content is in the HTML, one attribute selects, the default follows the date. A deployment lists its seasons; one season means no switch. Phase 1: hero pictures, activity texts, accent colours, which weeks open first | A visitor looking at a July week should see summer. The distinctive feature, at a small cost. The restyled map waits. |
| Page structure | One scrolling home page (hero, weeks, apartments, map, reviews, FAQ teaser); own routes for each apartment, the guides, the company page and the legal pages | Seamless browsing, and a URL per apartment for search. |
| Map | An open map (MapLibre with open tiles is the candidate), restyled per season | No consent banner, no billing key. |
| Reviews | Score, count and a quiet link to the listing; no review texts | Booking.com forbids publishing texts retrieved by its API. |
| Tracking | None that needs consent | Goal: no cookie banner. |
| UI | Tailwind with copy-in headless primitives (spartan/ui is the candidate) and one SVG icon set | No self-built components; two custom themes stay easy. |
| Repo shape | One Angular app, no workspace tool, no libraries; the simulator in a second folder | The code is small. |
| Beds24 simulator | Small own server that answers in the recorded response shapes from fictional data; it is the demo's runtime backend and the e2e tests' backend, and includes a fake booking page | The demo has no real Beds24 account or token; the booking flow needs state. The real recordings stay private as the reference. |
| Name | Repository `beds24-direct-booking`; the demo at `beds24.vikkoch.com`, not indexed, its booking page plainly marked as simulated | Says what it is and is findable. The seasons go into the tagline: "seasonal rental" means something else. |
| Beds24 coupling | The site talks to Beds24 directly: one `beds24` module with the client and the mapping into the site's own week and apartment types. No provider interface | One provider is the truth at this size; a second would change the simulator and the hand-over too. The mapping exists because the wire shapes are awkward, not for swapping. |
| Hosting | One small VM per site (1 GB works with a capped SSR heap and swap, 2 GB is comfortable), images built in CI | The Beds24 production token wants an IP whitelist, so a static address. No database and mostly prerendered pages keep it small. |
| Proxy | Traefik in front, routing by container labels, on every VM | TLS, redirects and headers need a proxy anyway; one compose file then serves the shared demo VM and a site's own VM. |
| Stack | A `web` container (SSR and the availability route); a `sim` container on the demo only | Nothing else is needed. No observability stack on a site's VM: an external uptime check. |
| Demo | Runs on an existing shared VM beside other stacks, under a subdomain of the author's domain | The proxy there discovers stacks by label, so nothing on it changes. |
| Preview lock | Basic auth in the Node server from one environment variable, off when unset | Lets the business review the real site before release and keeps crawlers out; behaves the same on every host. |
| Private site | A private repository builds its own image from a public tag plus its content | Pages are prerendered, so content is needed at build time. Configuration, not a fork. |
| Demo and real site | The demo is a deployment, never a mode: no demo-only features in the app. What differs is content, configuration and the Beds24 address (the simulator) | Keeps one scope and one code path. National differences (imprint, tax wording, registration numbers, mediation) are content and optional fields. |
| Render modes | No client-only routes. Pages that show listings or the week grid (home, apartment) are rendered on the server per request from the cache; guides, company and legal pages are prerendered. The availability route stays for navigation inside the app | Prices and listing texts are in the HTML for search and without a late pop-in; one hydration path. |
| Design first | A design round before the first slice: two or three directions for the home page and the week grid, phone first, both seasons; the chosen one becomes HTML mock-ups on the real Tailwind tokens and the design language | The UI is the new part. |
| Testing | Every e2e test on Chromium desktop, WebKit with an iPhone device and Firefox desktop; details in `working-agreements.md` | Small suite, phone visitors, Safari is where sites break. |
| Accessibility | Built in from the first slice: contrast checked on both season palettes' tokens, axe in the e2e suite, keyboard and focus rules; details in `working-agreements.md` | Cheaper than a pass at the end, and it shapes the palettes and the week grid. |
| Releases | Deployment from `main` only: a merge deploys the demo. No planned increments: issue by issue. A tag marks a state the private site can pin: `0.1.0` when CI/CD runs and the demo is live with the simulator, a `0.x.0` after a slice the private site wants, `1.0.0` when the real site is live | Slices are planned as issues in a milestone, not as versions. |
| Agentic practices | From the start: the reviewer agent, the screenshot matrix (2 languages × 2 seasons × phone and desktop), and hooks for format and lint. Installed skills for Angular and for design work; a project skill of our own when a procedure has been done twice | Three to practise first; more when one has become routine. The list to choose from is in `working-agreements.md`. |
| Working mode | Viktor writes an issue's intent, Claude plans in the issue, commits with co-authorship and opens the pull request; a reviewer agent on another model comments there; Viktor accepts and merges. Details in `working-agreements.md` | Honest authorship, no relaying between agents, and the process itself is part of what the project shows. |

## Open decisions

- **The booking step** (decided as far as a trial account allows): own week grid and guest
  count, then the Beds24 guest form in an iframe by deep link, restyled through the booking
  engine's CSS and script settings, with an own confirmation page behind the return URL.
  Payment may leave the frame for Beds24's page. Untested until the account has paid: the
  confirmation, the payment, the return, and the frame's cookie in Safari (accepted risk).
  Fallbacks: the same link as a full page, then an own form through the API.
- **Token handling in production:** scopes `read:inventory` and `read:properties` only, an IP
  whitelist, and a refresh token exchanged for 24-hour access tokens. To confirm later.
- **Season in the page:** how the default is chosen without a flash on prerendered pages, and
  whether both seasons' content is in the HTML for search.
- **The real site's name, domain and logo.** `.com` as the main domain; the national domain
  redirects to its language.
- **Icon set:** check coverage against the real feature list (ski, bike, family, no smoking, …).
- **The language mechanism:** keyed text files per language read at build time, or Angular's
  built-in i18n with one build per locale. Lean: keyed files. Settled in the stack ADR.
- **The demo's place:** which fictional village, and with it the tourist tax and the texts.

## Later phases

- Airbnb as second channel (business setup, no code).
- Own guest reviews for direct bookings: needs persistence and a backend.
- Local events in the week view from the resort's public feed.
- Review texts, once own reviews exist.

## Rough order

1. Done: the API and booking page spike, in `beds24-findings.md`.
2. The repository: these documents; the first ADRs (why Beds24 and an own site, then the
   stack); the scaffold with lint, tests and CI.
3. The simulator with fictional data in the recorded shapes, and the demo deployed from `main`:
   `0.1.0`.
4. The design round.
5. Slices: shell with languages, seasons and the notice; week grid with hand-over; apartment
   pages; map; guides and FAQ; company and legal pages; SEO, accessibility and performance pass.
6. Once the Beds24 account has paid: the confirmation, the payment and the return URL.
7. The private deployment: real content, legal texts, domain: `1.0.0`.

Beside this runs the business work: the listings' migration to Beds24 and the channel connection.

Estimate: about a month to a live demo; six to eight weeks to the real site, where the calendar
time goes into name, logo, pictures, texts and legal pages.
