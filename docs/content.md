# A site's content

Everything a deployment says and how it looks, apart from what Beds24 holds, is one folder of
content. The application has no wording, no colour and no typeface of its own. The demo's
folder is [`content/demo/`](../content/demo/); a site of its own keeps its folder in its own
repository.

## The folder

<!-- prettier-ignore -->
| File | What it holds |
|---|---|
| `site.json` | The site's name, its languages in order as language tags, the apartments (slug, Beds24 room ID, name), the seasons and the contact. |
| `texts.<tag>.json` | Everything one language says: the wording, the address parts and the anchors. One file per language listed in `site.json`, such as `texts.en-GB.json`. |
| `theme.css` | The palette and the typeface as custom properties on `:root`, and the typeface's `@font-face`. |
| `fonts/` | Optional: the font files `theme.css` refers to, as `fonts/<file>`. |
| `pictures/` | The pictures `site.json` names, such as each season's hero photo. |

- **Fonts are served at `/fonts/<file>`** under their own names, and every page preloads each
  `.woff2` file, so the font arrives with the stylesheet instead of after it. Browsers keep them
  for a year: give a changed font file a new name.
- **`font-display: fallback`** in the `@font-face` rule, as the demo has it: the text waits up
  to 100 ms for the preloaded font instead of being painted in the fallback font first, and a
  slow connection still gets the fallback. `swap` makes the text change its font on every
  first visit.

- **A language is a BCP 47 tag** in its canonical form, such as `de-AT` or `en-GB`. The page's
  `lang` and its `hreflang` links use the tag, so dates and numbers follow the region. The
  address prefix is the tag's language (`/de`, `/en`), so two tags with the same language are
  refused. The language menu names each language in its own language, taken from the tag
  ("Deutsch", "English").
- **The first language** is the one the bare address leads to when the browser asks for none
  of the site's languages.
- **The address parts** (`paths` in a texts file) are the translated fixed parts of
  [`site-map.md`](site-map.md)'s addresses, such as `wohnungen` for `apartments`; `anchors`
  are the home page's section anchors. An apartment's slug is the same in every language.
- **The notice** (`notice` in a texts file) is an optional line above the header, with an
  optional link. Left out, no line is shown.
- **The seasons** (`seasons` in `site.json`) are `winter`, `summer` or both, each with its hero
  photo. With both, each names the day it starts as `MM-DD` and lasts until the other starts; 29
  February cannot be a start. A single season has no start and the site shows no switch. A texts
  file names exactly the listed seasons in `seasons` (the switch's label and each name) and in
  `hero` (each photo's alternative text), beside the hero's lead, up to five features and its
  button. A feature's icon is any [Lucide](https://lucide.dev/icons) icon by its name there,
  such as `calendar-days`; only the icons the texts name go into the build. How the page picks
  its season is [ADR 8](adr/0008-the-season-in-the-page.md).
- **A picture** is a file in `pictures/` with an optional `credit`: its title, author, source
  address and licence with its address, and optionally what was changed: `changes` lists
  `cropped`, `scaled` or both, and each language's texts name them under `credits.changes`.
  The picture credits page lists every credited picture, with the changes in parentheses
  after its title. Pictures are served at `/pictures/<file>` as they are and kept by browsers
  for a year, like the fonts: give a changed picture a new name. WebP keeps a photo smaller
  than JPEG at the same quality; the demo's hero photos are 2000 px wide WebP files at quality 80.
- **The contact** in `site.json` lists any of a name, address lines, a phone number and an
  email address. The footer shows what is listed, and no contact column without `contact`, so
  a site can keep its footer short and give the full details on its imprint page.
- **The season's colours:** `theme.css` sets one season's accents on `:root` and, with two
  seasons, the other's under its attribute, as the demo does with
  `[data-season='summer'] { --color-accent: …; --color-accent-soft: …; }`.
- **The theme's names** are the ones in [`DESIGN.md`](../DESIGN.md): `--font-sans` and the
  `--color-*` properties of `content/demo/theme.css`. Every pair of text and ground is
  measured before a theme is used.

## How it is checked

`scripts/content.mjs` validates the folder against the schema in
[`src/content/schema.ts`](../src/content/schema.ts) and writes it into
`src/content/generated/`, which is not committed. It runs before every `start`, `build`, `test`
and `lint`. A key that is missing in one language, a key the schema does not know, a missing
texts file, a tag that is not canonical, two tags with one language each, a season named in
the texts but not in `site.json` or the other way round, and a missing picture stop the build
with the file and the key named.
The schema, not the demo's files, defines the keys, so the compiler checks every template
against the same keys for every site.

## Another folder

The variable `CONTENT_DIR` names the folder; without it the demo's is used.

- **Locally,** for example with a site's own content beside this repository, against the
  simulator (`npm run sim`) or, with both Beds24 variables set, against the real Beds24:

  ```sh
  CONTENT_DIR=../my-site/content npm start
  CONTENT_DIR=../my-site/content BEDS24_URL=https://api.beds24.com/v2 BEDS24_TOKEN=<token> npm start
  ```

  Run `npm start` without the variable to go back to the demo.

- **In an image,** the folder must be inside the build context: `docker build --build-arg
CONTENT_DIR=content/site .` with the folder copied there first, as
  [`infra/site-deploy.yml`](../infra/site-deploy.yml) does.
- **In the tests,** [`e2e/content/`](../e2e/content/) is a second site with two other languages,
  no notice, no font of its own, other colours and a single season without credits. The e2e
  suite builds it on port 4002.
