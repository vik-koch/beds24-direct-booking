# ADR 14: The map

Status: accepted, 2026-11-22. Group: stack.

## Context

The home page's "Where it is" section and every apartment page show a map. It marks the apartments
and a few places, at least the gondolas and later the tourist office or a supermarket, and gives the
walking distance from an apartment to each place along streets and paths, not as the crow flies. A
place carries a text per season: a gondola serves skiers in winter and mountain bikers or hikers in
summer. What weighs on it:

- **No consent prompt.** A map service run by a third party receives every visitor's IP address with
  its tiles, a font CDN the same. A map that loads nothing from elsewhere needs no prompt.
- **One small town.** A site covers one resort, a few square kilometres. Visitors need not pan
  beyond it.
- **The places change rarely.** Apartments and gondolas move perhaps once a year, so their routes
  need not be computed per visit.
- **The theme and the season.** The map should take the theme's colours and change with the season,
  as the brief planned.
- **The bundle.** The first load is at its alarm of 720 kB (#202). The map must not add to it.

A spike (#254, branch `spike/254-map`, not merged) tried the decision below in the demo town.

## Decision

1. **MapLibre GL JS renders the map,** loaded with `@defer (on viewport)` when the section comes
   into view. Its worker and stylesheet are served as files of the site.
2. **The tiles are the site's own files.** A script cuts the tiles inside the town's box, zoom 12 to
   15, out of a Protomaps planet build and writes them as `z/x/y.mvt` files that the server serves
   as any other file. The map is held to that box. MapLibre enlarges zoom 15 for closer views.
3. **The style comes from `@protomaps/basemaps`,** whose layers take a set of colours and a label
   language. The site builds that set from the theme's colour variables when the map starts and
   again on a change of season, and passes the page's language. Labels use the theme's own font file
   through the style's `font-faces`, so no glyph files are needed.
4. **Routes are computed by a script, not per visit.** It takes every apartment's and place's
   coordinates from content, asks a foot router for each pair once, and writes the lines with their
   distance and walking time to a generated file that is committed. A visitor's browser asks no
   routing service.
5. **The places are content:** the coordinates of an apartment in its file, the places in
   `site.json` with a name per language, a kind, and a text per season. The gondolas show by
   default, the others behind one switch.
6. **A list beside the map carries the same facts** for keyboard and screen reader users and for a
   browser that cannot draw the map. The map adds to the list; it never replaces it.
7. **The attribution stays visible,** "© OpenStreetMap · Protomaps", with a link to OpenStreetMap's
   copyright page. It is the only link out, and nothing is fetched from there unless it is followed.

## Options

<!-- prettier-ignore -->
| Option | For | Against | Result |
|---|---|---|---|
| A hosted tile service (OpenFreeMap, OpenStreetMap's tile servers, a commercial one) | No files to cut or serve. | Every visitor's IP address goes to a third party, which needs a legal basis and probably a prompt; some need a key or have usage rules. | Rejected. |
| MapLibre with tiles cut from a Protomaps build and served by the site | Nothing leaves the site; one set of files per town; vector tiles take any colours. | A script to run when the map should show newer data; MapLibre is a large chunk. | Chosen. |
| A PMTiles archive read by the browser through range requests | One file instead of a few hundred. | Another library in the browser; static files serve the same tiles with no code. | Rejected. |
| Leaflet with raster tiles | A small library. | Raster tiles of our own must be rendered per colour scheme and season; restyling means re-rendering. | Rejected. |
| A hand-written style | No style dependency. | The spike's first hand-written layers drew streams, which the tiles store as lines, as filled polygons; every layer kind has such details. | Rejected. |
| A routing engine run per visit | Any route on demand. | A server process beside the site on a 1 GB machine, for routes that change once a year. | Rejected. |

## What this rests on

- **Verified in the spike, 2026-11-22,** on the demo town (Saalbach) and the planet build of that
  day (Protomaps format 4.15.2, zoom 0 to 15):
  - The town's box at zoom 12 to 15 is 62 tiles, 773 kB raw, 592 kB gzipped. A phone's first view
    fetched 41 kB of tiles.
  - MapLibre 6.19.0 is a lazy chunk of 1.06 MB raw, 241 kB compressed, plus its worker (551 kB raw,
    157 kB gzipped) and stylesheet (72 kB raw, 10 kB gzipped). The map component with the style and
    the spike's routes is 65 kB raw, 10 kB compressed. The first load grows by 8.7 kB, Angular's
    `@defer` viewport trigger; no map code or data is in it.
  - Every request goes to the site itself; no cookie is set.
  - The tiles' points of interest name restaurants, cafés, bars and supermarkets, shown in a small
    label from zoom 16. Points of interest and village names carry only their local name; country
    and city names carry translations such as `name:en`. Gondola lines, stations and ski pistes are
    not in the tiles, so the gondolas are our own pins.
  - Labels in the theme's font through `font-faces` (a WOFF2 file) render in Chromium and WebKit.
  - The colours follow the season once the page's colour transition has ended; read earlier, they
    are the old season's.
  - The foot router of routing.openstreetmap.de returned all twelve routes between three apartments
    and four places, 220 m to 1,730 m, 1.2 to 2.3 times the straight distance.
  - In the CI image (`mcr.microsoft.com/playwright:v1.65.0-resolute`), headless Chromium and WebKit
    have WebGL 2 and draw the map; headless Firefox has no WebGL, also with `webgl.force-enabled`,
    and the map's constructor throws.
- **Documented, not verified:** OpenStreetMap data is under the ODbL, which asks for the attribution
  above; MapLibre, `pmtiles` and `@protomaps/basemaps` are under the BSD 3-Clause licence (their
  package files).
- **Not checked:** the foot router's usage policy for a script run a few times a year; whether the
  computed routes take paths that are closed or groomed for skiing in winter; points of interest in
  the private deployment's town; the reading that a map loading nothing from a third party needs no
  consent prompt in the EU, which is ours, not a lawyer's.

## Consequences

- **The production server does not compress its responses today,** so the map's chunk and tiles
  would travel at their raw sizes until it does.
- **Newer map data is a script run:** cut the tiles from a later build and commit them. Routes are
  computed again when a pin moves.
- **Firefox's e2e tests see no map,** so they cover the list and the page without the map; the map
  itself is tested in Chromium and WebKit.
- **The map's chunk is large,** but loaded only by visitors who scroll to it.
