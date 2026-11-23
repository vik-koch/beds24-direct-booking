# A site's content

Everything a deployment says and how it looks, apart from what Beds24 holds, is one folder of
content. The application has no wording, no colour and no typeface of its own. The demo's folder is
[`content/demo/`](../content/demo/); a site of its own keeps its folder in its own repository.

## The folder

<!-- prettier-ignore -->
| File | What it holds |
|---|---|
| `site.json` | The site's name, its languages in order as language tags, the apartments' slugs in their order, the seasons, the hero's features, the apartment page's rooms and amenities, the age up to which a guest is a child, and the contact. |
| `apartments/<slug>.json` | One apartment: its Beds24 room ID, its name and its pictures. One file for each slug `site.json` lists, and no other. |
| `texts.<tag>.json` | Everything one language says: the wording, the address parts and the anchors. One file per language listed in `site.json`, such as `texts.en-GB.json`. |
| `theme.css` | The palette and the typeface as custom properties on `:root`, and the typeface's `@font-face`. |
| `fonts/` | Optional: the font files `theme.css` refers to, as `fonts/<file>`. |
| `pictures/` | The pictures `site.json` names, such as each season's hero photo. |
| `map/` | With a map: its tiles, walking routes and lifts, written by the three map scripts and committed. |

- **Fonts are served at `/fonts/<file>`** under their own names, and every page preloads each
  `.woff2` file, so the font arrives with the stylesheet instead of after it. Browsers keep them for
  a year: give a changed font file a new name.
- **`font-display: fallback`** in the `@font-face` rule, as the demo has it: the text waits up to
  100 ms for the preloaded font instead of being painted in the fallback font first, and a slow
  connection still gets the fallback. `swap` makes the text change its font on every first visit.

- **A language is a BCP 47 tag** in its canonical form, such as `de-AT` or `en-GB`. The page's
  `lang` and its `hreflang` links use the tag, so dates and numbers follow the region. The address
  prefix is the tag's language (`/de`, `/en`), so two tags with the same language are refused. The
  language menu names each language in its own language, taken from the tag ("Deutsch", "English").
- **The first language** is the one the bare address leads to when the browser asks for none of the
  site's languages.
- **The address parts** (`paths` in a texts file) are the translated fixed parts of
  [`site-map.md`](site-map.md)'s addresses, such as `wohnungen` for `apartments`; `anchors` are the
  home page's section anchors, never `top`, which is the page's top. An apartment's slug is the same
  in every language.
- **An apartment** is a file of its own, named by its slug: `site.json` lists
  `"apartments": ["zirbe", "laerche"]`, and `apartments/zirbe.json` holds

  ```json
  {
    "roomId": 9001011,
    "name": "Zirbe",
    "pictures": [{ "file": "pictures/zirbe-1.webp", "alt": { "de-AT": "…", "en-GB": "…" } }]
  }
  ```

  The room ID is the Beds24 room the apartment is, and the name is how the site calls it in every
  language.

- **An apartment's pictures** (`pictures` in its file) are listed in the order the site shows them,
  at least one, each a `file` and its alternative text `alt` in each of the site's languages by tag.
  A picture is landscape or square, from 1:1 to 2:1 with 1% to spare either way. The file is in
  `pictures/` or is an `https` address, such as a Beds24 picture's. The build converts each to WebP
  at quality 80 in widths of 480, 960, 1440 and 1920 px, none wider than the source, and serves only
  those, at `/pictures/apartments/` under names that change with the picture
  ([ADR 10](adr/0010-pictures-converted-at-build-time.md)). Give the build sources of at least 1920
  px where there are any: Beds24 keeps an upload at up to 2000 px. A local run keeps its downloads
  and conversions in `node_modules/.cache/pictures`; delete it to fetch the addresses again. A
  picture made by an image model is marked `"generated": true`, and the page puts a label on it in
  the words of `apartment.generated`, such as "AI image": an image model's terms may ask for a
  disclosure no viewer could miss.
- **The apartment page** (`apartment` in a texts file) is the page's wording: its headings, the
  facts line (`guests` and `bedrooms` take `{count}`, with a `one` and an `other` form), and the
  arrival and departure times as Beds24's `HH:MM`: `checkIn.both` takes `{from}` and `{until}`,
  `checkIn.from` and `checkIn.until` serve a property that sets only one bound, and `checkOut` takes
  `{until}`. The name and the pictures come from the apartment's file. The guests, size, address,
  times, description and house rules come from Beds24, in the page's language by its address prefix,
  such as `de`.
- **The gallery** (`gallery` in a texts file) is the wording of the pictures' mosaic and viewer:
  `name` for both, `position` such as "Picture {index} of {count}", `previous` and `next` for the
  viewer's buttons, and `more` for the last cell of the mosaic when pictures follow beyond it,
  taking `{count}` with a `one` and an `other` form. The mosaic shows 8, 5 or 3 cells, or the first
  picture alone, by the number of pictures; the viewer shows each picture whole with its alternative
  text below it.
- **The amenities** (`amenities` in `site.json`) sort Beds24's feature codes into areas for the
  apartment page, in their order:
  `{ "area": "kitchen", "icon": "cooking-pot", "codes": ["KITCHEN", "DISHWASHER"] }`, or a code
  standing alone with its own icon: `{ "code": "PETS_NOT_ALLOWED", "icon": "paw-print" }`. A code is
  listed once. The property's codes and the room's, a room's fittings included, are merged; a code
  listed nowhere is not shown. A texts file names each area under `amenities.areas` and labels each
  listed code under `amenities.codes`.
- **The rooms** (`rooms` in `site.json`) are the codes that open a Beds24 room group, such as
  `BEDROOM`, each with an icon: `{ "code": "BEDROOM", "icon": "bed-double" }`. The page lists each
  such group in Beds24's order, numbered where a room comes more than once. A texts file names each
  listed room under `amenities.rooms` and labels its beds and fittings, such as `BED_DOUBLE`, under
  `amenities.codes`; a bed without a label is left out. A group whose code is not listed is no room:
  its codes count as amenities.
- **The booking panel** (`panel` in a texts file) is the wording of the apartment page's panel: the
  week, the guests, the total and the way on to booking. The same counts stand above the free-weeks
  list. The optional `guestsNote` says who counts as a child and how babies are counted, and an
  asterisk beside the children's count points to it: Beds24 knows no age, and where a child ends
  depends on the place, usually on its tourist tax. Where no apartment asks Beds24 for children, the
  counts ask only for guests. `small` (`{name}`, `{guests}`) says how many an apartment too small
  for the chosen guests takes. The tax line takes `{guests}`, `{nights}` and `{amount}`; `adults`
  has a `one` and an `other` form for it.
- **The notice** (`notice` in a texts file) is an optional line above the header, with an optional
  link. Left out, no line is shown. A link within the site is a path from its root, such as
  `/en/apartments/ahorn`, which then carries the visitor's guests; any other is a full `https://`
  address.
- **The seasons** (`seasons` in `site.json`) are `winter`, `summer` or both, each with its hero
  photo and its `icon`: an SVG file in UTF-8 in `pictures/` that the browser's tab shows while the
  season is shown. It has no alternative text; the page's title stands beside it. The demo's are a
  Lucide icon in white on a circle of the season's accent, which reads on light and dark tabs alike.
  With both, each names the day it starts as `MM-DD` and lasts until the other starts; 29 February
  cannot be a start. A single season has no start and the site shows no switch. A texts file names
  exactly the listed seasons in `seasons` (the switch's label and each name) and in `hero` (each
  photo's alternative text), beside the hero's lead, its features and its button. How the page picks
  its season is [ADR 8](adr/0008-the-season-in-the-page.md).
- **The hero's features** (`features` in `site.json`) are up to five, or none, in their order, each
  a key and an icon: `{ "key": "no-commission", "icon": "tag" }`. The icon is any
  [Lucide](https://lucide.dev/icons) icon by its name there, such as `calendar-days`; only the icons
  `site.json` names go into the build. A texts file gives each key's text under `hero.features`,
  such as `"no-commission": "No booking site commission"`, and no other key.
- **The free weeks** (`weeks` in a texts file) are the list's wording. Its sentences take `{season}`
  (a dated season such as "Winter 2026/27"), `{count}` (the guests, with a `one` and an `other`
  form) and `{amount}` (the tourist tax as money). `note` says what the week's price includes, since
  that is how a deployment sets up its Beds24 prices; the tax follows it as `tax.night` or
  `tax.stay`, by Beds24's upsell item. `small` stands in the cells of an apartment too small for the
  chosen guests and in place of the price in a chosen week's bar, and `smallFor` (`{guests}`) on its
  card. `gone` stands in place of the price in the bar of a chosen week that has been booked or has
  passed since. The apartments' order in the list is their order in `site.json`; their guests, size,
  prices and tax come from Beds24.
- **A picture** is a file in `pictures/` with an optional `credit`: its title, author, source
  address and licence with its address, and optionally what was changed: `changes` lists `cropped`,
  `scaled` or both, and each language's texts name them under `credits.changes`. The picture credits
  page lists every credited picture, with the changes in parentheses after its title. A season's
  hero photo is converted like an apartment's pictures, at `/pictures/hero/`, and also as its centre
  crop of 3:4, which a portrait screen shows in its place: the hero covers the screen, so such a
  screen showed only that part of the photo anyway. Keep what matters in the photo's middle, and
  give it at least 1920 px. Other pictures, such as the icons, are served at `/pictures/<file>` as
  they are and kept by browsers for a year, like the fonts: give a changed picture a new name.
- **The contact** in `site.json` lists any of a name, address lines, a phone number and an email
  address. The footer shows what is listed, and no contact column without `contact`, so a site can
  keep its footer short and give the full details on its imprint page.
- **The map** (`map` in `site.json`) is optional. Its `box` is the area the map covers, as
  `{ "west": 12.6, "south": 47.375, "east": 12.67, "north": 47.405 }` in degrees, and its `places`
  are what it marks, in their order:
  `{ "key": "schattberg", "icon": "cable-car", "lat": 47.39031, "lon": 12.63528 }`. The icon is any
  Lucide icon and shows the place's kind; a place with `"more": true` is shown only once the map's
  list of more places is unfolded. With a map, every apartment's file gives `lat` and `lon`, the
  point where a guest leaves the house; without one, none does. Every point lies inside the box.
  Pins of points close together, such as two apartments 50 m apart, may overlap in the map's first
  view on a phone: each pin's tip still marks its point, a chosen pin lies over the others, and
  zooming in separates them. A texts file names each place under `map.places.<key>` with its `name`,
  and optionally a text for each season the site lists, such as `"winter": "Gondola to the slopes"`.
  How the map is built is [ADR 14](adr/0014-the-map.md).
- **The map's wording** (`map` in a texts file, beside `places`): `label` names the map for screen
  readers; `from` heads the panel's choice of apartment and `more` labels its switch. The page
  writes each walk's distance in its own language, such as "900 m" or "1,4 km". `zoomIn`, `zoomOut`
  and `attribution` name the map's buttons, and `gestures` holds the hints the map shows when a
  scroll without Ctrl (`windows`) or ⌘ (`mac`), or one finger (`touch`), would move it. The map
  writes its labels in the theme's typeface: the first `.woff2` file in `fonts/` that `theme.css`
  names, which a site with a map must have.
- **The map's tiles** are `map/tiles/<build>/`, cut out of a
  [Protomaps](https://maps.protomaps.com/builds/) planet build of OpenStreetMap at zoom 12 to 15
  inside the box, with `map/tiles.json` naming the build, the box and the number of tiles. They are
  served at `/map/tiles/<build>/`, so tiles cut again get new addresses although browsers keep files
  for a year. Cut them when the map gets a box, when the box changes, or when the map should show
  newer data: `node scripts/map-tiles.mjs` takes the latest build,
  `node scripts/map-tiles.mjs 20261122` that day's. The old tiles stay until every new one has
  arrived. The demo's box is 62 tiles, 773 kB.
- **The walking routes** are `map/routes.json`: one line from each apartment to each place, with its
  metres and minutes on foot, from OSRM's foot profile on
  [routing.openstreetmap.de](https://routing.openstreetmap.de/). Compute them with
  `node scripts/map-routes.mjs` when a point is added, moved or removed; it asks for one route a
  second, as the service asks. The routes follow OpenStreetMap's ways, which do not say what is
  closed or a piste in winter: walk them before a site shows them.
- **The lifts** are `map/lifts.json`: OpenStreetMap's aerial lifts inside the box, gondolas, cable
  cars, chairlifts and drag lifts, each with its kind and its local name, taken through the
  [Overpass API](https://overpass-api.de/) with the box they were taken for. Take them with
  `node scripts/map-lifts.mjs` when the box changes or a lift is built or removed; the content build
  refuses a file taken for another box. Magic carpets, zip lines and goods lifts are left out, and a
  lift's name is the one OpenStreetMap has, in the local language on every page.
- **The three scripts** read the folder `CONTENT_DIR` names, the demo's without it, and write into
  its `map/`; commit what they write. A site that drops its map deletes the folder.
- **The season's colours:** `theme.css` sets one season's accents on `:root` and, with two seasons,
  the other's under its attribute, as the demo does with
  `[data-season='summer'] { --color-accent: …; --color-accent-soft: …; }`.
- **The theme's names** are the ones in [`DESIGN.md`](../DESIGN.md): `--font-sans` and the
  `--color-*` properties of `content/demo/theme.css`. A site with a map also names the map's own
  colours, which the content build requires: `--color-water`, `--color-trail`, `--color-pitch`, and
  the colours of the places' icons, `--color-poi-food`, `-shop`, `-transport`, `-service` and
  `-culture`. Every pair of text and ground is measured before a theme is used.

## Its boundaries

What varies with a deployment's content, and how far the layout is built and tested for it. A folder
beyond a limit fails its build, with the limit named.

<!-- prettier-ignore -->
| Varies | Limit | Why | Enforced by |
|---|---|---|---|
| Site name | 15 characters | The narrow header keeps one row at 320 px: the name shrinks from 24 px where its room runs short, to about 15.5 px for 15 letters | The schema; an e2e test puts a 15-letter name into the demo's header |
| Apartments | 1 to 4 | From 48rem the free-weeks list has a column for each, and four fill the card | The schema; the e2e test site has four |
| Apartment name | 20 characters | The list's column headers and the phone's tabs | The schema; the e2e test site's names |
| Languages | Exactly 2 | The language menu and the address prefixes have not been tried with a third | The schema |
| Seasons | 1 or 2 | Winter and summer, one each | The schema |
| A room's guests in Beds24 | `maxAdult` empty or equal to `maxPeople`; `maxChildren` empty, 0 or at least `maxPeople − 1` | The site takes a room by its total: any guest may be an adult, and with one adult required the children's limit never applies on its own | Not the build: the server logs a warning when it loads a room beyond this, and treats it by its total |
| Hero features | Up to 5 | The hero's card | The schema |
| An apartment's picture | Square to 2:1, landscape, with 1% to spare | The gallery's frames; tested with 1:1, 4:3 and 3:2 | The content script; the demo has 3:2, the e2e test site 1:1 and 4:3 |
| The map's box | At most 0.1° each way, within 85° of latitude | The tiles grow with the area, and the repository and the image carry them; the demo's 0.07° by 0.03° is 773 kB | The schema |
| The map's places | 1 to 10 | One route for each apartment and place, and the map's list of places | The schema |

**The site name's size comes from its length,** at an assumed 0.55em per letter: the widest
mixed-case average measured in the demo's font (Jost at weight 500: 0.547em in "Wohnen am Wald").
Capitals and other typefaces can be wider: 13 capitals already overflow at 320 px. Not every
typeface, name and width is tested, which is beyond this project: every deployment, in Jost too,
checks its own name at 320 px and, with two seasons, at 384 px, where the switch shows its label, in
each language.

## How it is checked

`scripts/content.mjs` validates the folder against the schema in
[`src/content/schema.ts`](../src/content/schema.ts) and writes it into `src/content/generated/`,
which is not committed. It runs before every `start`, `build`, `test` and `lint`. A key that is
missing in one language, optional ones such as `notice` included, a key the schema does not know, a
missing texts file, a tag that is not canonical, two tags with one language each, a season named in
the texts but not in `site.json` or the other way round, a feature without its text or a text
without its feature, an amenity's or a room's icon that is not Lucide's, a code listed twice, an
area or a room without its name or a name without its area or room, a listed code without its label,
a missing picture, an apartment picture that is not one, does not answer, is portrait or wider than
2:1 or lacks its alternative text in a language, an apartment without its file or a file in
`apartments/` that `site.json` does not list, a point outside the map's box or an apartment's point
without a map, a place without its name or with a text for a season the site does not list, tiles
cut for another box or a tile missing, a `map/` folder without a map, a map without a `.woff2` font
in `theme.css`, a route missing, left over or computed before a point moved, and a part beyond its
boundary stop the build with the file and the key named; for the tiles and the routes, with the
script to run. The schema, not the demo's files, defines the keys, so the compiler checks every
template against the same keys for every site. Every language has the same keys, so every language
renders the same elements and a change of language finds the reader's place.

## Another folder

The variable `CONTENT_DIR` names the folder; without it the demo's is used.

- **Locally,** for example with a site's own content beside this repository, against the simulator
  (`npm run sim`) or, with both Beds24 variables set, against the real Beds24:

  ```sh
  CONTENT_DIR=../my-site/content npm start
  CONTENT_DIR=../my-site/content BEDS24_URL=https://api.beds24.com/v2 BEDS24_TOKEN=<token> npm start
  ```

  Run `npm start` without the variable to go back to the demo.

- **In an image,** the folder must be inside the build context:
  `docker build --build-arg CONTENT_DIR=content/site .` with the folder copied there first, as
  [`infra/site-deploy.yml`](../infra/site-deploy.yml) does.
- **In the tests,** [`e2e/content/`](../e2e/content/) is a second site with two other languages, no
  notice, no font of its own, other colours and a single season without credits. The e2e suite
  builds it on port 4002.
