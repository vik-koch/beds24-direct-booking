# ADR 8: The season in the page

Status: accepted, 2026-11-16. Group: stack.

## Context

The brief makes the season a dimension of the content, switched like a colour scheme: a visitor
looking at a July week should see summer. It left open how the page picks its season without a
flash, and whether both seasons' content is in the HTML. What weighs on it:

- **Most pages are prerendered,** so the HTML was written on the day of the build, not the day of
  the visit. The home page is rendered per request, but by a server that knows nothing about the
  visitor's earlier choice.
- **The season colours the whole page,** header included, so a wrong first paint shows.
- **A visitor who switched should find the same season** when coming back a day later, without a
  consent prompt and without making the server's answers differ per visitor.
- **Only two seasons are shown at a time,** the current one and the next. A deployment has a winter
  and a summer, or one of the two.

## Decision

1. **A deployment lists `winter`, `summer` or both,** each with the day it starts as `MM-DD`. A
   season lasts until the other starts, so the year has no gap and no overlap, and 29 February
   cannot be a start. A single season covers the year and has no switch.
2. **Both seasons' content is in the HTML,** and the attribute `data-season` on `<html>` selects.
   The other season's photo is not displayed, so it is not fetched either.
3. **An inline script in the head sets the attribute before the body is parsed.** Its order of
   precedence: a link's `?season=`, then a stored choice, then today's date in the visitor's time
   zone. The server sets the attribute by its own date first, which is what a visitor without
   JavaScript sees; for them the switch is not shown.
4. **The script is the same function the application and the unit tests use,** written into the page
   with `Function.prototype.toString()`. It must therefore use nothing from outside its own body.
5. **The choice is stored in local storage** as the dated season and the day it was made, such as
   `{"season":"summer-2027","on":"2026-11-16"}`. It is dropped after 30 days, or once that dated
   season is no longer one of the two shown. A switch stores it, and so does a link that names a
   season, so that the site's own links keep the season for the visit.
6. **A switch removes `?season=` from the address,** or a reload would bring the link's season back.

## Options

<!-- prettier-ignore -->
| Option | For | Against | Result |
|---|---|---|---|
| The server decides from a cookie | No script. | Every answer varies by the cookie, so prerendered pages and shared caches no longer work. A cookie is sent with every request for a choice only the browser needs. | Rejected. |
| The application sets the season once it starts | No inline script. | The page is painted in the build day's season first and changes after the application has loaded: the flash the brief wanted to avoid, longer on a slow network. | Rejected. |
| An inline script with the season's logic, and local storage | The first paint is right on every page, prerendered or not. Nothing reaches the server. | The script must stay self-contained, and a stricter content security policy has to allow it. | Chosen. |
| Any number of seasons, each with its icon in the content | An autumn would be possible. | The switch is a toggle between two sides, "the current and the next season" assumes two that alternate, and the dated names assume one season crosses the turn of the year. None of that carries over to three. | Rejected. |
| Each season with a "from" and a "to" day | Closer to how a season is spoken of. | The two periods must be checked against each other, and a winter to 28 February with a summer from 1 March leaves 29 February in no season. | Rejected for start days. |

## What this rests on

- **Verified by unit tests:** both boundary days, the turn of the year, 29 February, the two shown
  seasons and their dated names, the precedence, the 30 days, a stored season no longer shown, a
  single season, and that the script runs on its own.
- **Verified by the e2e suite in Chromium:** the date's season on a server-rendered and a
  prerendered page, the season with the application's scripts held back, switching by click and by
  keyboard, the stored choice across pages and languages, its end, a link's season, that only the
  shown photo is fetched, a single-season site, and axe in both seasons. WebKit and Firefox run in
  CI.
- **Checked by hand:** a first visit with the cache off on a throttled network in Chromium; every
  painted frame was in the right season.
- **Not checked:** whether a stored preference after an explicit choice needs a consent prompt in
  the real site's country. The reading so far is that it does not, because it is stored only on the
  visitor's action and only for that purpose; it belongs on the privacy page, which comes with the
  legal pages.

## Consequences

- **The content security policy** has no `script-src` today. One that is added later must allow this
  script by its hash, as it must Angular's inline event dispatch script.
- **The free-weeks list uses the same state:** its dated season comes from the two shown, and a stay
  belongs to the season of its arrival day.
- **A deployment's theme** sets one season's colours on `:root` and, with two seasons, the other's
  under its attribute, such as `[data-season='summer']`.
