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
| Booking step | `/de/buchen` | `/en/book` |
| Booking confirmation | `/de/buchen/bestaetigung` | `/en/book/confirmation` |
| Guide: self check-in | `/de/gaesteinfo/self-check-in` | `/en/guest-guide/self-check-in` |
| Guide: waste | `/de/gaesteinfo/muell` | `/en/guest-guide/waste` |
| Guide: FAQ | `/de/gaesteinfo/haeufige-fragen` | `/en/guest-guide/faq` |
| Company, with contact | `/de/ueber-uns` | `/en/about` |
| Imprint | `/de/impressum` | `/en/imprint` |
| Privacy | `/de/datenschutz` | `/en/privacy` |
| Terms | `/de/agb` | `/en/terms` |
| Picture credits | `/de/bildnachweis` | `/en/picture-credits` |

- **The demo's apartments** have the slugs `zirbe`, `laerche` and `ahorn`.
- **The address without a prefix** (`/`) redirects to the home page in the browser's language
  if the deployment has it, and in the deployment's first language otherwise.
- **The booking step** takes the apartment and the stay as query parameters, which are not
  translated.
- **A guide keeps its address** once it is published, because printed QR codes in the
  apartments point to it. A code points to one language; the language switch leads to the
  other.

## Header

Sticky on every page, in this order:

1. The wordmark, linking to the home page.
2. Links to the home page's sections: free weeks, apartments, where it is, who we are. On
   another page they lead to the home page and its section.
3. The season switch, if the deployment has more than one season.
4. The language switch, leading to the same page in the other language.

## Footer

On every page:

- Contact: the business's name, address, telephone number and e-mail address.
- Links to the guest guides.
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
   with icons, and a button to the free weeks. Sized by the screen but shorter than it, so the
   next section shows.
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
