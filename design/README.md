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
apartments' pictures; [`generated/`](generated/) holds the 14 generated pictures with a note per
apartment. They are AI-generated, see [`licenses/README.md`](../licenses/README.md).
