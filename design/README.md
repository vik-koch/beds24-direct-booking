# Design mock-up

A static page that tries the site's look before the application is built. It is not part of the
application: nothing here is built, deployed or tested. Open `home.html` straight from the folder in
a browser.

The page shows the home page's first screen and the free-weeks list from `docs/site-map.md`, in
German: a light grey ground, white surfaces and pale oak, round controls and room to breathe, with
one muted accent per season, navy in winter and emerald in summer. The weeks and prices in `mock.js`
are invented.

## Trying the states

- **Season:** the switch in the header or the sentence above the list; `?season=summer` opens in
  summer.
- **A season that is not open yet:** `?season=summer&state=closed`.
- **Selected and focused:** click a price, or move through the prices with the arrow keys. `?pick=3`
  opens with the fourth price selected.
- **Narrow form:** below 768 px the list shows one apartment at a time.

## The apartment page

`apartment.html` is one apartment's page and its booking step, from the simulator's texts and the
demo's pictures, with `apartment.css` on top of `home.css`; the weeks and prices are the free-weeks
list's invented ones. `home.html` has the apartments' teasers below the free weeks.

The page's column is 72rem, wider than the home page's 66rem: the gallery and the content take the
left of it and the booking panel the right, from the gallery's top down. The map runs below at full
width; the address in the facts line leads to it.

- **Apartment:** `?apartment=zirbe`, `laerche` (the default) or `ahorn`.
- **Season:** the switch in the header or the panel's text button; `?season=summer` opens in summer.
- **A chosen week:** pick one in the list or the calendar; `?week=3` opens with the fourth week of
  the season chosen, `&view=calendar` in the calendar.
- **Pictures:** `?pictures=1`, `3`, `5` or `20` shows that many: the first picture is always 4:3,
  with two beside it from 3, four from 5, and two beside it and five below from 8, the last of them
  counting the rest. `?viewer=1` opens the viewer at the second picture. Each generated picture
  carries a label that says so.
- **Booking step:** `?step=book&week=3`, the stay beside a stand-in for Beds24's form.
- **States:** `?state=no-text` (no headline, no description), `?state=booked` (every week booked),
  `?state=unreachable` (Beds24 does not answer), and with Ahorn `?state=sofa` (a sofa bed in the
  living room, so up to 8 guests in 3 bedrooms).
- **Shorter page:** each feature area shows its first three entries, and a button opens all; on a
  phone the entries of an area are one line, and a long description shows six lines with "Mehr
  lesen".
- **Narrow form:** below 64rem the panel follows the features and a bar at the screen's foot leads
  to it; below 48rem the pictures are a strip to swipe instead of a mosaic.

The sheets `screenshots/apartment-*.jpg` and `screenshots/teaser.jpg` show it at 320, 768 and 1280
px in both seasons.

## Tokens

The stylesheet starts with its tokens as custom properties, named as Tailwind's theme names them
(`--color-*`, `--font-*`, `--radius-*`). The season changes the accent only. Colours and the
typeface are a deployment's theme: another site keeps the shapes and the spacing and sets its own.

## Font

Jost, self-hosted in `fonts/`, © 2020 The Jost Project Authors,
<https://github.com/indestructible-type/Jost>, under the SIL Open Font License 1.1. The licence text
is in [`licenses/jost/OFL.txt`](../licenses/jost/OFL.txt).

## Icons

From [Lucide](https://lucide.dev), © Lucide Icons and Contributors, under the ISC licence (and MIT
for the icons derived from Feather), copied into the page. The licence text is in
[`licenses/lucide/LICENSE`](../licenses/lucide/LICENSE).

## Pictures

The hero photographs are the demo's, in [`content/demo/pictures/`](../content/demo/pictures/); their
credits are in [`content/demo/site.json`](../content/demo/site.json) and on the site's picture
credits page.

The sheets in `screenshots/` show the page on a phone and on a desktop, in both seasons.

## Apartment pictures

[`apartment-pictures.md`](apartment-pictures.md) is the shot list and the prompts for the demo
apartments' pictures; [`generated/`](generated/) holds a note per apartment on its generated
pictures, which are in [`content/demo/pictures/`](../content/demo/pictures/). They are AI-generated,
see [`licenses/README.md`](../licenses/README.md).
