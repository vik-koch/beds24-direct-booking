# Site map

The site's pages and their addresses, what the header and footer hold, and the sections of the
home page. It fixes structure only: the look comes from the design round, and each slice builds
its part of what is listed here. The addresses are the demo's, in German and English; another
deployment translates the fixed parts into its own two languages.

## Pages

Every page sits under a language prefix. A fixed part of an address is translated; an
apartment's slug is the same in both languages and comes from the deployment's content.

<!-- prettier-ignore -->
| Page | German | English |
|---|---|---|
| Home | `/de` | `/en` |
| An apartment | `/de/wohnungen/<slug>` | `/en/apartments/<slug>` |
| Booking step | `/de/wohnungen/<slug>/buchen` | `/en/apartments/<slug>/book` |
| Booking confirmation | `/de/buchungsbestaetigung` | `/en/booking-confirmation` |
| FAQ | `/de/haeufige-fragen` | `/en/faq` |
| Company, with contact | `/de/ueber-uns` | `/en/about` |
| Imprint | `/de/impressum` | `/en/imprint` |
| Privacy | `/de/datenschutz` | `/en/privacy` |
| Rental terms | `/de/agb` | `/en/terms` |
| Picture credits | `/de/bildnachweis` | `/en/picture-credits` |

- **The demo's apartments** have the slugs `zirbe`, `laerche` and `ahorn`.
- **The address without a prefix** (`/`) redirects to the home page in the browser's language
  if the deployment has it, and in the deployment's first language otherwise.
- **The booking step** belongs to one apartment and takes the stay as query parameters, which
  are not translated. The stay is in the address so that a reload or a shared link keeps it.
  Opened without a stay, or with one that is not free, it redirects to the apartment's page
  and its stay picker.
- **The confirmation** has one address per language, because Beds24 returns the guest to it.
- **The FAQ** is one page for all apartments and keeps its address once it is published, so a
  printed QR code can point to it. Further guest guides (self check-in, waste) get their
  addresses when their shape is decided: a guide may differ by apartment.
- **The rental terms** are the business's own conditions for a stay: payment, cancellation and
  the house's rules. Who receives a guest's data (Beds24, the payment provider) is said on the
  privacy page.

## Header

Sticky on every page. How its items are arranged, and what folds into a menu on a narrow
screen, is decided in the design round.

- **The wordmark,** linking to the home page.
- **Links to the home page's sections:** free weeks, apartments, where it is, who we are. On
  another page they lead to the home page and its section.
- **The apartments entry opens a menu:** the section on the home page first, then each
  apartment's page.
- **The season switch,** if the deployment has more than one season.
- **The language switch,** leading to the same page in the other language.

## Footer

On every page:

- Contact: the business's name, address, telephone number and e-mail address.
- A link to the FAQ.
- Links to the imprint, the privacy page and the terms.
- A link to the picture credits.

## Home page

Top to bottom. Each section other than the hero has an anchor that the header links to.

<!-- prettier-ignore -->
| Section | German anchor | English anchor |
|---|---|---|
| Hero | | |
| Free weeks | `#freie-wochen` | `#free-weeks` |
| The apartments | `#wohnungen` | `#apartments` |
| Where it is | `#lage` | `#location` |
| Who we are | `#ueber-uns` | `#about` |

1. **Hero:** a season photo edge to edge, a headline that says what and where, three features
   with icons, and a button to the free weeks. It fills the first screen, with the header over
   its top.
2. **Free weeks:** the list of one dated season ("Winter 2026/27") with a price per apartment,
   and buttons to the previous and the next season where there is one. The list's season and
   the header's season switch are one state: changing either changes the list and the theme.
3. **The apartments:** a teaser each, with a link to the apartment's page and a link to its
   free weeks in the list.
4. **Where it is:** a map with marked places, and the same places as a list.
5. **Who we are:** a short text with contact, and a link to the company page.

## Layout rules

- **Height:** every section other than the hero is as tall as its content.
- **Width:** the hero and the map run edge to edge up to a maximum width; text and the list of
  free weeks sit in a centred column.
- **Jumps:** a jump from the header's links lands below the sticky header, not under it.
- **Scrolling:** no scroll snapping.
