# Site map

The site's pages and their addresses, what the header and footer hold, and the sections of the home
page. It fixes structure only: the look comes from the design round, and each slice builds its part
of what is listed here. The addresses are the demo's, in German and English; another deployment
translates the fixed parts into its own two languages.

## Pages

Every page sits under a language prefix. A fixed part of an address is translated; an apartment's
slug is the same in both languages and comes from the deployment's content.

<!-- prettier-ignore -->
| Page | German | English |
|---|---|---|
| Home | `/de` | `/en` |
| An apartment | `/de/wohnungen/<slug>` | `/en/apartments/<slug>` |
| Booking step | `/de/wohnungen/<slug>/buchen` | `/en/apartments/<slug>/book` |
| An apartment's own page | `/de/wohnungen/<slug>/<path>` | `/en/apartments/<slug>/<path>` |
| Zirbe's way there, with a map | `/de/wohnungen/zirbe/anfahrt` | `/en/apartments/zirbe/getting-here` |
| Zirbe's guide, unlisted | `/de/wohnungen/zirbe/wohnungsmappe` | `/en/apartments/zirbe/guide` |
| Booking confirmation | `/de/buchungsbestaetigung` | `/en/booking-confirmation` |
| FAQ | `/de/haeufige-fragen` | `/en/faq` |
| Company, with contact | `/de/ueber-uns` | `/en/about` |
| Parking, with a map | `/de/parken` | `/en/parking` |
| Imprint | `/de/impressum` | `/en/imprint` |
| Privacy | `/de/datenschutz` | `/en/privacy` |
| Rental terms | `/de/agb` | `/en/terms` |
| Picture credits | `/de/bildnachweis` | `/en/picture-credits` |

- **The application's own pages** are the home page, an apartment's page, the booking step, the
  confirmation and the picture credits. Every other page is a content page: its key, address and
  text come from the deployment's content ([`content.md`](content.md)). The demo's are the FAQ, the
  company page, parking, the imprint, the privacy page and the rental terms. A content page may end
  with a map of its own places.
- **The demo's apartments** have the slugs `zirbe`, `laerche` and `ahorn`.
- **The address without a prefix** (`/`) redirects to the home page in the browser's language if the
  deployment has it, and in the deployment's first language otherwise.
- **The guests** are chosen once for every apartment and kept as `?adults=4&children=2` on the home
  page, an apartment's page and every link between the pages; two adults without children, the
  default, leave the address bare. A value beyond what any apartment takes is held to it, in the
  page and the address.
- **The booking step** belongs to one apartment and takes the stay as query parameters, which are
  not translated. The stay is in the address so that a reload or a shared link keeps it. Opened
  without a stay, or with one that is not free, it redirects to the apartment's page and its stay
  picker.
- **The confirmation** has one address per language, because Stripe returns the guest to it.
- **An apartment's own pages** are content pages that belong to it, below its address. Its page
  links them from folds of its own under "Good to know", after Beds24's, each with an icon, a title
  and a text the content gives.
- **Public or unlisted:** a site page is public when the header or the footer links it, an
  apartment's page when a fold under "Good to know" does; a fold's link to a site page does not make
  it public. A public page is indexed. Any other is unlisted: it carries `noindex`, no navigation
  links to it, and a guest reaches it by its address, such as a QR code in the apartment. Anyone
  with the address can read it, so no door's or key box's code is written on a page.
- **A guide** is a content page: one for every apartment is a page of the site, one that differs by
  apartment is a page of each. A part every guide shares, such as how waste is sorted, is written
  into each one's file. The FAQ is one page for all apartments.
- **A printed address stays:** a page a QR code points to, such as the FAQ or a guide, keeps its
  address once the code is printed.
- **The rental terms** are the business's own conditions for a stay: payment, cancellation and the
  house's rules. Who receives a guest's data (Beds24, the payment provider) is said on the privacy
  page.

## Header

Sticky on every page. From 66rem, with a pointer that hovers, its items stand in one line; below,
and on a touch screen, all but the wordmark and the season switch fold into a sheet.

- **The wordmark,** linking to the home page.
- **Links to the home page's sections:** free weeks, apartments, where it is. On another page they
  lead to the home page and its section.
- **The apartments entry opens a menu:** the section on the home page first, then each apartment's
  page.
- **The content pages `site.json` lists in `header`,** after them, in their order. The demo's: the
  company page and the FAQ. The page shown is marked as the current one.
- **The language switch,** a globe with the language's code ("EN"), and its name ("English") from
  72rem. Its menu ticks the page's language and leads to the same page in the other one. Its name
  for a screen reader is "Language: English".
- **The season switch,** if the deployment has more than one season.

## Footer

On every page:

- Contact: the business's name, address, telephone number and e-mail address.
- The links `site.json` lists in `footer`, in their order. The demo's: parking, the imprint, the
  privacy page, the terms and the picture credits. A page the header links to is not repeated here.

## Home page

Top to bottom. Each section other than the hero has an anchor that the header links to. Who the
business is, is told on the company page, which the header lists in the demo.

<!-- prettier-ignore -->
| Section | German anchor | English anchor |
|---|---|---|
| Hero | | |
| Free weeks | `#freie-wochen` | `#free-weeks` |
| The apartments | `#wohnungen` | `#apartments` |
| Where it is | `#lage` | `#location` |

1. **Hero:** a season photo edge to edge, a headline that says what and where, three features with
   icons, and a button to the free weeks. It fills the first screen, with the header over its top.
2. **Free weeks:** the list of one dated season ("Winter 2026/27") with a price per apartment, and
   buttons to the previous and the next season where there is one. The list's season and the
   header's season switch are one state: changing either changes the list and the theme.
3. **The apartments:** a teaser each, with a link to the apartment's page and a link to its free
   weeks in the list.
4. **Where it is:** a map with marked places, and the same places as a list.

An apartment's page ends with the same map, under the same anchor, with that apartment alone and
always chosen: its routes drawn and their distances in the list. Its address in the facts below the
name leads there.

## Layout rules

- **Height:** every section other than the hero is as tall as its content.
- **Width:** the hero and the map run edge to edge up to a maximum width; text and the list of free
  weeks sit in a centred column.
- **Jumps:** a jump from the header's links lands below the sticky header, not under it.
- **Scrolling:** no scroll snapping.
