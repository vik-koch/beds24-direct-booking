# A site's content

Everything a deployment says and how it looks, apart from what Beds24 holds, is one folder of
content. The application has no wording, no colour and no typeface of its own. The demo's
folder is [`content/demo/`](../content/demo/); a site of its own keeps its folder in its own
repository.

## The folder

<!-- prettier-ignore -->
| File | What it holds |
|---|---|
| `site.json` | The site's name, its languages in order as language tags, the apartments (slug, Beds24 room ID, name) and the contact. |
| `texts.<tag>.json` | Everything one language says: the wording, the address parts and the anchors. One file per language listed in `site.json`, such as `texts.en-GB.json`. |
| `theme.css` | The palette and the typeface as custom properties on `:root`, and the typeface's `@font-face`. |
| `fonts/` | Optional: the font files `theme.css` refers to, as `fonts/<file>`. |

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
- **The theme's names** are the ones in [`DESIGN.md`](../DESIGN.md): `--font-sans` and the
  `--color-*` properties of `content/demo/theme.css`. Every pair of text and ground is
  measured before a theme is used.

## How it is checked

`scripts/content.mjs` validates the folder against the schema in
[`src/content/schema.ts`](../src/content/schema.ts) and writes it into
`src/content/generated/`, which is not committed. It runs before every `start`, `build`, `test`
and `lint`. A key that is missing in one language, a key the schema does not know, a missing
texts file, a tag that is not canonical and two tags with one language each stop the build
with the file and the key named.
The schema, not the demo's files, defines the keys, so the compiler checks every template
against the same keys for every site.

## Another folder

The variable `CONTENT_DIR` names the folder; without it the demo's is used.

- **Locally,** for example against the real Beds24 with a site's own content beside this
  repository:

  ```sh
  CONTENT_DIR=../my-site/content npm run content
  BEDS24_URL=https://api.beds24.com/v2 BEDS24_TOKEN=<token> NG_ALLOWED_HOSTS=localhost npx ng serve
  ```

  `npm start` would write the demo's content again and point at the simulator. Run
  `npm run content` without the variable to go back to the demo.

- **In an image,** the folder must be inside the build context: `docker build --build-arg
CONTENT_DIR=content/site .` with the folder copied there first, as
  [`infra/site-deploy.yml`](../infra/site-deploy.yml) does.
- **In the tests,** [`e2e/content/`](../e2e/content/) is a second site with two other languages,
  no notice, no font of its own and other colours. The e2e suite builds it on port 4002.
