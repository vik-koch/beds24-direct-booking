# ADR 6: How Beds24 data reaches a page

Status: accepted, 2026-11-13. Group: stack.

## Context

The brief renders every page that shows listings or stays on the server, per request, and keeps
the Beds24 token on the server. The home page is the first such page: it lists the apartments.
Every later page that shows Beds24 data will get it the same way, so the way is decided once.
What weighs on it:

- **The token and the client that sends it stay on the server.** Nothing of `src/beds24/`
  beyond its types belongs in the browser bundle.
- **The HTML carries the data,** for search engines and without a late pop-in, and the browser
  must not ask again for what the server just rendered.
- **A failure has to show in the status code,** not only on the page: a proxy, an uptime check
  and a search engine read the status.

## Decision

1. **A route resolver supplies the data.** On the server it calls a loading function; in the
   browser it reads what the server resolved.
2. **The loading function is an injection token that only the server's configuration
   provides.** The browser's configuration never imports the Beds24 client.
3. **The result travels in Angular's transfer state,** written by the resolver on the server
   and read by it in the browser.
4. **When loading fails, the resolver sets the response status to 503** and resolves to
   nothing, which the page renders as its unavailable state. The error goes to the server's log.
5. **The server reads the Beds24 address and token from `BEDS24_URL` and `BEDS24_TOKEN`** when
   a call is made. The demo, the tests and development point them at the simulator.

## Options

<!-- prettier-ignore -->
| Option | For | Against | Result |
|---|---|---|---|
| The page asks the site's own availability route through `HttpClient`, on the server and in the browser | One path for both sides; Angular caches the server's answer for the browser by itself. | While rendering, the server would call itself over HTTP, and needs its own address for that. The route does not exist yet: the brief wants it for navigation inside the app. | Rejected for the first render. |
| The component loads the data itself and asks the platform where it runs | No resolver. | The Beds24 client is imported by browser code, so it is bundled or needs a dynamic import behind a platform check. The status can only be set after rendering has begun. | Rejected. |
| A resolver with a loading function provided on the server only | The client stays out of the browser bundle by construction. The data is there before the component is created, so the page has no loading state, and the status is set before anything is sent. | The browser has only what the server put into the transfer state: a navigation inside the app to such a page needs the availability route, which comes with the first slice that navigates. | Chosen. |

## What this rests on

- **Verified by the e2e suite against the simulator:** the served HTML contains the apartments,
  a refused token gives a 503 without them, and the built browser bundle does not contain the
  token's variable name.
- **Verified by unit tests:** the resolver's three paths and the client's mapping.
- **Not built yet:** the cache between the resolver and Beds24, and the availability route.

## Consequences

- **Every page view is a call to Beds24 until the cache exists,** so the site runs against the
  simulator only until the slice that brings it.
- **A new kind of Beds24 data is a function in `src/beds24/`,** a token for it in the server's
  configuration and a resolver.
- **A page with such a resolver is rendered per request,** and is listed so in the server's
  routes; everything else stays prerendered.
- **A deployment must set the two variables.** Without them the pages answer 503.
