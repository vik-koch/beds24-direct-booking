# Design mock-ups

Static pages that try the site's look before the application is built. They are not part of
the application: nothing here is built, deployed or tested. Open a page straight from the
folder in a browser.

<!-- prettier-ignore -->
| Page | Direction |
|---|---|
| `a.html` | A, "Hüttenbuch": the hut's guest book and the summit stamp. Larch wood as ground, the list on the book's page, stamps as controls. |
| `b.html` | B, "Preistafel": the price board at a lift's valley station. A slate board in a larch frame on pale stone, the list as the board's grid. |
| `c.html` | C, "Stube": the apartment's own living room. A light grey ground, white surfaces, pale oak, round corners; the season is one muted colour, navy or emerald. |

All pages show the home page's first screen and the free-weeks list from `docs/site-map.md`,
in German. The weeks and prices in `mock.js` are invented.

## Trying the states

- **Season:** the switch in the header or the buttons above the list; `?season=summer` opens
  in summer.
- **A season that is not open yet:** `?season=summer&state=closed`.
- **Selected and focused:** click a price, or move through the prices with the arrow keys.
  `?pick=3` opens with the fourth price selected.
- **Narrow form:** below 768 px the list shows one apartment at a time.

## Tokens

Each direction's stylesheet starts with its tokens as custom properties, named as Tailwind's
theme names them (`--color-*`, `--font-*`, `--radius-*`). The season changes the accent only.

## Fonts

Self-hosted in `fonts/`, all under the SIL Open Font License 1.1:

- Archivo, © 2020 The Archivo Project Authors, <https://github.com/Omnibus-Type/Archivo>.
- Barlow and Barlow Condensed, © 2017 The Barlow Project Authors,
  <https://github.com/jpt/barlow>.
- Jost, © 2020 The Jost Project Authors, <https://github.com/indestructible-type/Jost>.

## Icons

Direction C uses icons from [Phosphor](https://phosphoricons.com) in the regular weight, under
the MIT licence, copied into the page.

## Pictures

The two hero photographs in `pictures/` come from Wikimedia Commons, scaled down to 2000 px
width. They are not covered by this repository's licence.

<!-- prettier-ignore -->
| File | Title on Commons | Author | Licence |
|---|---|---|---|
| `hero-winter.jpg` | [Saalbach (8450786397).jpg](<https://commons.wikimedia.org/wiki/File:Saalbach_(8450786397).jpg>) | Ian Gratton | [CC BY 2.0](https://creativecommons.org/licenses/by/2.0) |
| `hero-summer.jpg` | [Saalbach, 2014 (02).JPG](<https://commons.wikimedia.org/wiki/File:Saalbach,_2014_(02).JPG>) | Bahnfrend | [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0) |
