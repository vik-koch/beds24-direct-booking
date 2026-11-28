# A site's content

Everything a deployment says and how it looks, apart from what Beds24 holds, is one folder of
content. The application has no wording, no colour and no typeface of its own. The demo's folder is
[`content/demo/`](../content/demo/); a site of its own keeps its folder in its own repository.

## The folder

<!-- prettier-ignore -->
| File | What it holds |
|---|---|
| `site.json` | The site's name and address, its languages in order as language tags, the apartments' slugs in their order, the seasons, the hero's features, the apartment page's rooms and amenities, the age up to which a guest is a child, the contact, the credits of the pages' pictures, the content pages and the header's and the footer's links. |
| `apartments/<slug>.json` | One apartment: its Beds24 room ID, its name, its pictures and optionally its floor plan and its own pages. One file for each slug `site.json` lists, and no other. |
| `texts.<tag>.json` | Everything one language says: the wording, the address parts and the anchors. One file per language listed in `site.json`, such as `texts.en-GB.json`. |
| `pages/<key>.<tag>.md` | A content page in one language, such as `pages/faq.en-GB.md`: one file for each page and language `site.json` lists, and no other. |
| `pages/<slug>/<key>.<tag>.md` | One of an apartment's own pages in one language, such as `pages/zirbe/arrival.en-GB.md`: one file for each page its file lists and each language, and no other. |
| `pages/<key>.map.json`, `pages/<slug>/<key>.map.json` | Optional, with a map: the map that ends that page, with its title and its places' names in every language. |
| `theme.css` | The palette, the typeface and its two weights as custom properties on `:root`, and the typeface's `@font-face`. |
| `fonts/` | Optional: the font files `theme.css` refers to, as `fonts/<file>`. |
| `pictures/` | The pictures `site.json` names, such as each season's hero photo, and the apartments' pictures and plans. |
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
  home page's section anchors, also on an apartment's page for its map, never `top`, which is the
  page's top, nor an id the pages hold (`content`, `booking`, `booking-title`, `booking-season`,
  `guests-note`, `description`, `amenities`, `map-more`, `month-…`). An apartment's slug is the same
  in every language. Each content page has its address there too, by its key; no two pages share
  one, and no two of the apartments' pages share one with each other or with `book`. A page whose
  address a QR code prints, such as a guide's, keeps it: changing `paths.<key>` breaks every code
  already printed.
- **A content page** is a page of text the deployment adds, such as the FAQ, the imprint or a guest
  guide: `site.json` lists its key in `pages`, each texts file gives its address under `paths.<key>`
  and the text of a link to it under `pages.<key>`, and `pages/<key>.<tag>.md` holds it in each
  language. A key is not one of the application's own pages: `home`, `apartment`, `apartments`,
  `book`, `confirmation`, `credits`. The file opens with its title as a `#` heading, which the page
  and its tab show; the link text can be shorter, such as "FAQ". It may hold `##` to `####`
  headings, paragraphs, lists, quotes, rules, **bold** and _italic_, tables, and links to `http`,
  `https`, `mailto` and `tel` addresses and to the site's own paths, such as `/en/faq`. A `##`
  heading takes an `id` from its text, its letters and digits without accents joined by hyphens:
  "Getting here" becomes `getting-here`, "Über uns" `uber-uns`, "5. Cancellation" `5-cancellation`.
  Only the letters a to z and the digits stay, so "Łódź" gives `odz`, and a heading written wholly
  in another script, such as Greek, gives no `id` and stops the build. A link to an `id` on the same
  page is written with the `#` alone, `[Getting here](#getting-here)`, and leads there at the page's
  address; a list of such links at the top leads to the page's groups. Another page's heading is
  linked by its path, `/en/terms#5-cancellation`, which the build does not check. A question that
  folds open is written as HTML, with a blank line after the `<summary>` line and before
  `</details>`:

  ```markdown
  <details id="check-in">
  <summary>How do I get into the apartment?</summary>

  The answer, in **Markdown**.

  </details>
  ```

  Its `id` is lower-case words joined by hyphens, once on the page beside the questions' and the
  headings' ids and not one the pages hold (see the address parts), and kept the same in every
  language. The page's address with it, `/en/faq#check-in`, opens the question: printed in a QR
  code, it must not change. The address names its language, so a code opens the page in that
  language; the page in another language holds the same `id` at its own path, and the language
  switch does not carry the `id` along. A table wider than the column scrolls on its own. A note to
  the page's editors is an HTML comment, `<!-- TODO: the opening hours -->`, anywhere in the file,
  also above the title: it stays in the file and never reaches the page. How a page is built is
  [ADR 17](adr/0017-content-pages-in-markdown.md).

  A `##` or `###` heading, a question's `<summary>` and a quote may open with an icon: its Lucide
  name as [lucide.dev](https://lucide.dev/icons) shows it, between colons and followed by a space,
  such as `## :key-round: Arrival`, `<summary>:door-open: How do I get in?</summary>` or
  `> :info: Made up.`. The build checks the name and stops on one Lucide lacks, and draws the icon
  into the page, where a screen reader passes over it. A `##` heading's `id` comes from the text
  after it, so `arrival` here. A quote that opens with an icon is a note, a card with the icon
  beside its text, and a question's answer starts below its text, as an apartment's "Good to know"
  rows do. Anywhere else, such as in the title, a `####` heading or a paragraph, `:key-round:` stays
  text.

  A picture stands in a paragraph of its own, written with its alternative text in the page's
  language: `![The village in summer, seen from a trail above it](pictures/saalbach-summer.webp)`.
  It is a file in `pictures/`, from square to 2:1 like an apartment's, and the build converts it the
  same way, once for all pages, at `/pictures/pages/`. The page shows it across the column. Who to
  credit for it is said once for every language, in `site.json`:

  ```json
  "pictures": [{ "file": "pictures/saalbach-summer.webp", "credit": { "title": "…", … } }]
  ```

  with the credit as a hero's (see a picture below). A picture that needs no credit is not listed;
  one listed that no page shows stops the build. A picture made by an image model belongs to an
  apartment's pictures, which label it: a page has no such label.

  A small picture, such as a partner's logo, is shown at a set width instead, from 48 to 720 px, in
  an `<img>` of its own:
  `<img src="pictures/skischule-musterberg.webp" alt="Skischule Musterberg" width="160">`. It keeps
  its own shape, and the build converts it at that width and at twice it, so its file has to be at
  least twice as wide. A picture may be a link, written `[![alt](pictures/….webp)](https://…)` or
  `<a href="https://…"><img …></a>`, alone in its paragraph. Its alternative text is then the link's
  name, so it says where the link leads, such as the partner's name, rather than what the picture
  shows.

- **An apartment's own pages** (`pages` in its file, optional) are content pages that belong to it,
  such as how its heating works or how to reach it: `"pages": ["arrival", "guide"]`, each in
  `pages/<slug>/<key>.<tag>.md` and written like any content page. Each is served below the
  apartment's address, `/en/apartments/zirbe/getting-here`, with its address part from `paths.<key>`
  and its link text from `pages.<key>`, as a site page's: a key that several apartments list shares
  both, so `arrival` is the same word under every apartment. A key is a site page's or the
  apartments', not both. Nothing links to one by itself: a fold under "Good to know" does.
- **An apartment's folds** (`goodToKnow` in its file, optional) follow Beds24's arrival times and
  house rules under "Good to know", in their order. Each has a Lucide icon by its name, and its
  title and text in each of the site's languages by tag, as a picture's `alt`:

  ```json
  "goodToKnow": [
    {
      "icon": "map-pinned",
      "title": { "de-AT": "Anfahrt", "en-GB": "Getting here" },
      "text": { "de-AT": "…: [Anfahrt zur Zirbe](/de/wohnungen/zirbe/anfahrt).", "en-GB": "…" }
    }
  ]
  ```

  The text is Markdown with paragraphs, lists, **bold**, _italic_ and links, which lead where a
  content page's may; a link to an apartment's page must name one it has. The folds show while
  Beds24 cannot be reached, and the pages they link are built with the site.

- **A page's map** ends a content page, after its text, when a file beside the page's files holds
  its title and places: `pages/parking.map.json` for a site page, `pages/zirbe/arrival.map.json` for
  an apartment's. It is the home map in its look, with the page's places instead of `site.json`'s;
  on an apartment's page it walks from that apartment alone, on a site page from the apartment the
  visitor chooses. Its `title`, in each of the site's languages, heads the map as the apartment
  page's location heads its map. Its places are written as those of `site.json`'s map, below, with
  their texts and waypoints, and lie inside its box:

  ```json
  {
    "title": { "de-AT": "Von der Haltestelle", "en-GB": "From the bus stop" },
    "places": [
      {
        "key": "bus-stop",
        "icon": "bus",
        "lat": 47.387771,
        "lon": 12.647203,
        "name": { "de-AT": "Haltestelle Ronachgrund", "en-GB": "Ronachgrund bus stop" }
      }
    ]
  }
  ```

  The author picks the places, such as the nearest bins or car parks; the map searches for none. A
  place's point is the one OpenStreetMap has for it, so that the tiles' own icon for it gives way to
  the pin. A map with one place opens with it chosen, its way drawn, as an apartment's page opens
  with its apartment.

- **Public or unlisted:** a content page the site's navigation links is public: for a site page the
  header or the footer, for an apartment's page a fold under "Good to know" of any apartment, in any
  language; a fold's link to a site page does not make it public. Any other is unlisted: the page
  tells search engines not to index it (`noindex`), and a guest reaches it by its address, such as a
  QR code in the apartment. Unlisted is not secret: anyone with the address can read it, so a door's
  or a key box's code goes in Beds24's messages to the guest, never on a page.
- **The site's address** (`url` in `site.json`) is `https://` and the host alone, such as
  `https://beds24.vikkoch.com`: the host `APP_DOMAIN` names in the deployment. Every page's
  canonical link, its link preview's address and picture and the sitemap name it, also on a test
  deployment at another host, which so points search engines to the real site.
- **A page's description** (`descriptions` in a texts file) is what a search result and a link's
  preview say of it, up to 160 characters, the site's own limit: a search result cuts its text by
  the screen's width. Every public page has one by its key, such as `faq`, `credits` and `home`, an
  apartment's own page as `<slug>/<key>`, such as `zirbe/arrival`; an unlisted page may. An
  apartment's page takes its headline from Beds24 instead, and has none in a language its room has
  no headline in. The same text goes into the page's `description` and `og:description`, so write it
  for both: what the page holds, in a sentence. Search engines may show a text of their own instead.
- **A link's preview picture** is the season's hero, or on an apartment's pages the first picture of
  its gallery in that season, cut from the middle to 1,200 × 630 and served as a JPEG at
  `/pictures/previews/`. A prerendered page names the season of the day it was built.
- **The header's links** (`header` in `site.json`) are up to two content pages, in their order,
  after the header's own links to the free weeks, the apartments and the location. The page shown is
  marked there, and the footer does not link to it again.
- **The footer's links** (`footer` in `site.json`) are content pages or `credits`, the picture
  credits page, in their order.
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
- **An apartment's floor plan** (`plan` in its file, optional) is a drawing and the zones a visitor
  chooses on it ([ADR 16](adr/0016-the-floor-plan.md)):

  ```json
  "plan": {
    "file": "pictures/laerche-plan.svg",
    "alt": { "de-AT": "…", "en-GB": "…" },
    "zones": [
      {
        "key": "kitchen",
        "name": { "de-AT": "Küche", "en-GB": "Kitchen" },
        "points": [[0, 0], [325, 0], [325, 110], [0, 110]],
        "label": [160, 55]
      }
    ]
  }
  ```

  The drawing is one SVG file in `pictures/` per apartment, shared by all languages, with a
  `viewBox`: it has no text, since the page writes the zones' names in the theme's typeface, no
  script and no reference to another file. It styles itself with attributes or a `<style>` element
  inside it, never with an `<?xml-stylesheet?>` line, which the build refuses. Its background is
  transparent, and its colours are its own, not the theme's. An apartment on two floors draws them
  side by side. `alt` says in each language what the plan shows. Each zone has a key, its `name` in
  each language, its polygon's corners as `[x, y]` pairs, at least three, and the `label` point
  `[x, y]` its name is centred on, both in the drawing's coordinates and inside its `viewBox`. A
  picture names the zones it is a picture of, `"zones": ["kitchen", "dining"]`, or none, not a zone
  seen only through a door or at its edge, since choosing a zone shows its pictures; in each season
  the site lists, every zone is shown by at least one picture, and a picture without a season counts
  in every season. The drawing is served at `/pictures/apartments/` under a name that changes with
  it.

- **The apartment page** (`apartment` in a texts file) is the page's wording: its headings, the
  facts line (`guests` and `bedrooms` take `{count}`, with a `one` and an `other` form), and the
  arrival and departure times as Beds24's `HH:MM`: `checkIn.both` takes `{from}` and `{until}`,
  `checkIn.from` and `checkIn.until` serve a property that sets only one bound, and `checkOut` takes
  `{until}`. `permit` takes `{number}` exactly once, the property's registration number, and is
  shown only where Beds24 has one. The name and the pictures come from the apartment's file. The
  guests, size, address, registration number, times, description and house rules come from Beds24,
  in the page's language by its address prefix, such as `de`.
- **The gallery** (`gallery` in a texts file) is the wording of the pictures' mosaic and viewer:
  `name` for both, `position` such as "Picture {index} of {count}", `previous` and `next` for the
  viewer's buttons, and `more` for the last cell of the mosaic when pictures follow beyond it,
  taking `{count}` with a `one` and an `other` form. The mosaic shows 8, 5 or 3 cells, or the first
  picture alone, by the number of pictures; the viewer shows each picture whole with its alternative
  text below it. With a floor plan, `plan` names it on its cell and its view and `photos` names the
  pictures' view; the plan takes the mosaic's top right cell.
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
- **The booking step** (`book` in a texts file) labels Beds24's 16 guest fields under `fields`, each
  with the error for a field left empty (`missing`) and, for the first name, the surname, the e-mail
  and the phone, mobile and fax numbers, one for an answer of the wrong form (`invalid`): a name
  with a digit, or a number its country does not have, which the error asks for with its country
  code. Every field has its label in every language, whether a property asks it or not, so a field
  switched on in Beds24 never lacks one. A property's own questions are worded in Beds24; their
  errors come from `custom`, with `{question}` for the question's text. The summary beside the form
  names the days of `arrival` and `departure`, each with the hours Beds24 sets for the property in
  `times` (`both`, `from`, `until`, with `{from}` and `{until}`), and the total's two lines, `rent`
  and `tax`. `terms` is the line above the button, with the rental terms linked in place of
  `{link}`, by a path from the site's root.
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
- **The contact** in `site.json` is the business's details: its address, which every site gives, and
  optionally a name (the site's name without one), a phone number and an email address. The address
  is given in its parts,
  `{ "street": "Musterweg 0", "postalCode": "5753", "locality": "Saalbach", "country": "AT" }`, the
  country as its two-letter ISO 3166-1 code, which search engines take. The footer writes the
  address as three lines, the postal code before the place and the country's name in the page's
  language. The home page describes the business to search engines from the contact; Google requires
  the address. The footer shows the parts `footer` lists, such as `"footer": ["name", "email"]`, or
  all of them without it, and no contact column with `"footer": []`, so a site can keep its footer
  short and give the full details on its imprint page while search engines still get the address. A
  site with a map gives an email address of its operator that reaches someone, on its imprint page
  at least: the map's walking routes come from FOSSGIS's routing servers, whose usage policy asks
  for one.
- **Stripe's review** looks at the contact, the rental terms, the privacy page and how prices are
  shown before it activates payments: [`stripe-review.md`](stripe-review.md) lists what it asks for
  and how the demo meets it.
- **The map** (`map` in `site.json`) is optional. Its `box` is the area the map covers, as
  `{ "west": 12.6, "south": 47.375, "east": 12.67, "north": 47.405 }` in degrees, and its `places`
  are what it marks, in their order:
  `{ "key": "supermarket", "icon": "shopping-cart", "lat": 47.3887, "lon": 12.6454, "name": { "de-AT": "Supermarkt", "en-GB": "Supermarket" } }`.
  The icon is any Lucide icon and shows the place's kind; a place with `"more": true` is shown only
  once the map's list of more places is unfolded, so at least one place is not, a map's only place
  among them. Its `name` is given in each of the site's languages by tag, as a picture's `alt`, and
  optionally a text for each season the site lists, `winter` and `summer`, by tag too, such as
  `"winter": { "de-AT": "Gondel ins Skigebiet", "en-GB": "Gondola to the slopes" }`. With a map,
  every apartment's file gives `lat` and `lon`, the point where a guest leaves the house; without
  one, none does. An apartment whose name would cover a neighbour's pin can give
  `"mapLabel": "left"` to show it left of its pin. Every point lies inside the box. Pins of points
  close together, such as two apartments 50 m apart, may overlap in the map's first view on a phone:
  each pin's tip still marks its point, a chosen pin lies over the others, and zooming in separates
  them. How the map is built is [ADR 14](adr/0014-the-map.md).
- **The map's wording** (`map` in a texts file): `label` names the map for screen readers; `from`
  heads the panel's choice of apartment and `more` labels its switch. The page writes each walk's
  distance in its own language, such as "900 m" or "1,4 km". `zoomIn`, `zoomOut`, `reset` (back to
  the view of the choices) and `attribution` name the map's buttons, `report` labels the
  attribution's link to report an error in the map, as plain text, and `gestures` holds the hints
  the map shows when a scroll without Ctrl (`windows`) or ⌘ (`mac`), or one finger (`touch`), would
  move it. The map writes its labels in the theme's typeface: the first `.woff2` file in `fonts/`
  that `theme.css` names, which a site with a map must have.
- **The map's tiles** are `map/tiles/<build>/`, cut out of a
  [Protomaps](https://maps.protomaps.com/builds/) planet build of OpenStreetMap at zoom 12 to 15
  inside the box, with `map/tiles.json` naming the build, the box and the number of tiles. They are
  served at `/map/tiles/<build>/`, so tiles cut again get new addresses although browsers keep files
  for a year. Cut them when the map gets a box, when the box changes, or when the map should show
  newer data: `node scripts/map-tiles.mjs` takes the latest build,
  `node scripts/map-tiles.mjs 20261122` that day's. The old tiles stay until every new one has
  arrived, and keep their build when the newer build's tiles are the same. The demo's box is 62
  tiles, 773 kB.
- **The walking routes** are `map/routes.json`: one line from each apartment to each place, and from
  each apartment a page's map walks from to each of its places, with its metres and minutes on foot,
  from Valhalla's pedestrian costing on FOSSGIS's server, which had built its data the same day when
  checked on 2026-11-25. Compute them with `node scripts/map-routes.mjs` when a point is added,
  moved or removed; it asks for one route a second, as the service asks. The routes follow
  OpenStreetMap's ways, which do not say what is closed or a piste in winter: walk them before a
  site shows them.
- **A route's waypoints** lead it the way people walk where the router takes another, such as a road
  around the centre: a place's `via` gives, by an apartment's slug, the points the route from that
  apartment goes through, in their order, as the demo's tourist office does:
  `"via": { "zirbe": [{ "lat": 47.38938, "lon": 12.64275 }] }`. A page's place takes them too, from
  an apartment its page walks from. The metres shown are the route's through them. Try them first on
  [valhalla.openstreetmap.de](https://valhalla.openstreetmap.de/) with the profile set to
  pedestrian: a right click on the map adds a via point, and the address lists the points as
  `wps=lon,lat,lon,lat,…`, longitude first. The router moves a point to the nearest way and never
  turns back at it, so put it on the path itself, away from a junction, or the route takes a detour
  to pass it. No waypoint leads a route along a way OpenStreetMap lacks or keeps walkers off: map or
  tag it there first; once Valhalla's data has the edit, a weekly run proposes the changed route.
- **The lifts** are `map/lifts.json`: OpenStreetMap's aerial lifts inside the box, gondolas, cable
  cars, chairlifts and drag lifts, each with its kind and its local name, taken through the
  [Overpass API](https://overpass-api.de/) with the box they were taken for. Take them with
  `node scripts/map-lifts.mjs` when the box changes or a lift is built or removed; the content build
  refuses a file taken for another box. Magic carpets, zip lines and goods lifts are left out, and a
  lift's name is the one OpenStreetMap has, in the local language on every page.
- **The three scripts** read the folder `CONTENT_DIR` names, the demo's without it, and write into
  its `map/`; commit what they write. A site that drops its map deletes the folder.
- **Fresh map data every week:** the map data workflow runs the three scripts every Monday and
  proposes any change in a pull request whose description names the tiles' build and each changed
  route and lift ([ADR 15](adr/0015-map-data-in-a-weekly-pull-request.md)). Walk a changed route, or
  check it on the map, before merging. A site of its own sets it up as
  [`deploying-a-site.md`](deploying-a-site.md) says.
- **The season's colours:** `theme.css` sets one season's accents on `:root` and, with two seasons,
  the other's under its attribute, as the demo does with
  `[data-season='summer'] { --color-accent: …; --color-accent-soft: …; }`.
- **The theme's names** are the ones in [`DESIGN.md`](../DESIGN.md): `--font-sans` and the
  `--color-*` properties of `content/demo/theme.css`. `--font-weight-normal` and
  `--font-weight-medium` are the typeface's regular and medium weights, which every text uses and
  the content build requires: the demo's Jost at 400 and 500, another typeface perhaps at 350 and
  600 for the same look. A site with a map also names the map's own colours, which the content build
  requires: `--color-water`, `--color-trail`, `--color-pitch`, and the colours of the places' icons,
  `--color-poi-food`, `-shop`, `-transport`, `-service` and `-culture`. Every pair of text and
  ground is measured before a theme is used.

## Its boundaries

What varies with a deployment's content, and how far the layout is built and tested for it. A folder
beyond a limit fails its build, with the limit named.

<!-- prettier-ignore -->
| Varies | Limit | Why | Enforced by |
|---|---|---|---|
| Site name | 15 characters | The narrow header keeps one row at 320 px: the name shrinks from 24 px where its room runs short, to about 15.5 px for 15 letters | The schema; an e2e test puts a 15-letter name into the demo's header |
| The header's links | Up to 2 pages, their text beside the name, the language's code and the season switch on one line from 66rem | From 66rem, with a pointer that hovers, the header shows its links in one line; below, they are in the menu's sheet. The demo's German links fit there with the name at full size, and from 72rem with the language's name too. A longer text or another page shrinks the name | The schema counts the pages; the text's width is not the build's: a deployment checks its header at 1,056 and 1,152 px in each language, and keeps a link's text short, such as "FAQ" |
| Apartments | 1 to 4 | From 48rem the free-weeks list has a column for each, and four fill the card | The schema; the e2e test site has four |
| Apartment name | 20 characters | The list's column headers and the phone's tabs | The schema; the e2e test site's names |
| Languages | Exactly 2 | The language menu and the address prefixes have not been tried with a third | The schema |
| Seasons | 1 or 2 | Winter and summer, one each | The schema |
| A page's description | 160 characters | A search result shows a sentence or two, cut by the screen's width | The schema |
| The contact's address | A street, a postal code before the place, and a country | The footer's lines; an address written the other way round, as in the United Kingdom, is not supported | The schema |
| A room's guests in Beds24 | `maxAdult` empty or equal to `maxPeople`; `maxChildren` empty, 0 or at least `maxPeople − 1` | The site takes a room by its total: any guest may be an adult, and with one adult required the children's limit never applies on its own | Not the build: the server logs a warning when it loads a room beyond this, and treats it by its total |
| Booking questions in Beds24 | The 16 guest fields, and custom questions of the six kinds Beds24 offers, each with its text, and a choice its options in brackets, in every language of the site; the full price taken at booking | The booking form asks them as [ADR 19](adr/0019-the-booking-form-asks-what-beds24-asks.md) says | Not the build: the server logs an optional question it cannot ask and leaves it out, and closes the property's booking for a required one or other booking rules |
| Hero features | Up to 5 | The hero's card | The schema |
| An apartment's picture | Square to 2:1, landscape, with 1% to spare | The gallery's frames; tested with 1:1, 4:3 and 3:2 | The content script; the demo has 3:2, the e2e test site 1:1 and 4:3 |
| An apartment's floor plan | One drawing, all floors in it | The gallery shows one plan | The schema |
| A content page | Its title, then headings, paragraphs, lists, quotes, rules, links, tables, folded questions and pictures; an icon only at the start of a `##` or `###` heading, a question or a quote | The elements the page styles | The content script |
| A content page's title | A word as wide as the column at 300 px, or one with a soft hyphen (`&shy;`) where it may break, as the demo's `Geschäfts&shy;bedingungen` | Headlines are not hyphenated, and the layout holds down to 300 px (DESIGN.md): a longer word would make the page scroll sideways | Not checked: a deployment looks at its titles at 300 px |
| The map's box | At most 0.1° each way, within 85° of latitude | The tiles grow with the area, and the repository and the image carry them; the demo's 0.07° by 0.03° is 773 kB | The schema |
| The map's places | 1 to 10 | One route for each apartment and place, and the map's list of places | The schema |
| A place's name | Two lines beside its pin at 320 px, about 30 characters | A chosen place's name stands beside its pin, 120 px wide at most at 320 px so that it clears the zoom buttons; a longer name takes a third line | Not the build: an e2e test puts 28 letters into the label at 320 and 768 px |
| A page's map | One, after the page's text, with 1 to 10 places | A map within the text would split the page around a block that loads late; the routes and the list as the home map's | The schema and the content script |
| The map's error link (`map.report`) | 32 characters | The opened attribution keeps to two lines at 320 px, below the gesture hint; 55 characters still did | The schema; an e2e test puts 32 wide letters into it at every width |

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
2:1 or lacks its alternative text in a language, a plan's drawing that is no SVG document, has no
`viewBox`, has text, a script or a reference to another file, a zone or its label outside the
`viewBox`, a zone no picture shows or a picture's zone the plan lacks, a plan's or a zone's text
missing in a language, an apartment without its file or a file in `apartments/` that `site.json`
does not list, a point outside the map's box or an apartment's point without a map, a waypoint from
an apartment the map does not walk from, a place's name or text missing in a language or a text for
a season the site does not list, tiles cut for another box or a tile missing, a `map/` folder
without a map, a map without a `.woff2` font in `theme.css`, a route missing, left over or computed
before a point moved, a content page without its file, address or link text in a language, a page
file `site.json` or its apartment does not list, a page's map for a site without a map, without its
title in a language or with a place outside the box, a page key the site lists too, a fold without
its title or text in a language, with an icon that is not Lucide's, an element its text does not
show or a link to no apartment's page, a header or footer link to no page, a footer link the header
has, two pages at one address, a page that does not open with its title or holds an element, an
attribute, a link or a question's `id` the pages do not take, a `##` heading whose text gives no
`id` or one the page has already, a `#` link to no `id` on its page, an icon Lucide lacks, a page's
picture without its file or alternative text or beside other text, a credited picture no page shows,
a public page without its description or a description of no page, and a part beyond its boundary
stop the build with the file and the key named; for the tiles and the routes, with the script to
run. The schema, not the demo's files, defines the keys, so the compiler checks every template
against the same keys for every site. Every language has the same keys, so every language renders
the same elements and a change of language finds the reader's place.

## Another folder

The variable `CONTENT_DIR` names the folder; without it the demo's is used.

- **Locally,** for example with a site's own content beside this repository, against the simulator
  (`npm run sim`) or, with both Beds24 variables set, against the real Beds24:

  ```sh
  CONTENT_DIR=../my-site/content npm start
  CONTENT_DIR=../my-site/content BEDS24_URL=https://api.beds24.com/v2 BEDS24_REFRESH_TOKEN=<refresh token> npm start
  ```

  Run `npm start` without the variable to go back to the demo.

- **In an image,** the folder must be inside the build context:
  `docker build --build-arg CONTENT_DIR=content/site .` with the folder copied there first, as
  [`infra/site-deploy.yml`](../infra/site-deploy.yml) does.
- **In the tests,** [`e2e/content/`](../e2e/content/) is a second site with two other languages, no
  notice, no font of its own, other colours and a single season without credits. The e2e suite
  builds it on port 4002.
