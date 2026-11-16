---
name: beds24-direct-booking
description: A light, roomy look for a small business's holiday apartments, with one muted colour per season.
colors:
  ground: '#f1f1ef'
  surface: '#ffffff'
  oak: '#eadfce'
  ink: '#27323a'
  ink-soft: '#5a666e'
  line: '#e7e5e0'
  edge: '#7c878f'
  winter: '#3b587c'
  winter-soft: '#e2e8f0'
  summer: '#2c7060'
  summer-soft: '#deede8'
  on-accent: '#ffffff'
typography:
  display:
    fontFamily: 'Jost, system-ui, sans-serif'
    fontSize: 'clamp(2.125rem, 1.5rem + 3vw, 3.5rem)'
    fontWeight: 500
    lineHeight: 1.05
    letterSpacing: '-0.025em'
  headline:
    fontFamily: 'Jost, system-ui, sans-serif'
    fontSize: 'clamp(1.875rem, 1.5rem + 1.6vw, 2.75rem)'
    fontWeight: 500
    lineHeight: 1.1
    letterSpacing: '-0.02em'
  title:
    fontFamily: 'Jost, system-ui, sans-serif'
    fontSize: '1.1875rem'
    fontWeight: 500
    lineHeight: 1.2
  body:
    fontFamily: 'Jost, system-ui, sans-serif'
    fontSize: '1.125rem'
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: 'Jost, system-ui, sans-serif'
    fontSize: '0.9375rem'
    fontWeight: 500
    lineHeight: 1.5
rounded:
  control: '999px'
  card: '1.5rem'
  menu: '1rem'
spacing:
  gutter: '1rem'
  gutter-wide: '2rem'
  section: '3.5rem'
  section-wide: '5rem'
components:
  button-primary:
    backgroundColor: '{colors.winter}'
    textColor: '{colors.on-accent}'
    rounded: '{rounded.control}'
    height: '3rem'
    padding: '0 1.5rem'
  card:
    backgroundColor: '{colors.surface}'
    textColor: '{colors.ink}'
    rounded: '{rounded.card}'
    padding: '2.25rem 2.5rem 2.5rem'
  price:
    textColor: '{colors.winter}'
    rounded: '{rounded.control}'
    height: '2.75rem'
    padding: '0 0.75rem'
  price-hover:
    backgroundColor: '{colors.winter-soft}'
    textColor: '{colors.winter}'
  price-selected:
    backgroundColor: '{colors.winter}'
    textColor: '{colors.on-accent}'
  season-switch:
    backgroundColor: '{colors.surface}'
    textColor: '{colors.ink-soft}'
    rounded: '{rounded.control}'
  season-switch-selected:
    backgroundColor: '{colors.winter}'
    textColor: '{colors.on-accent}'
  booking-bar:
    backgroundColor: '{colors.winter}'
    textColor: '{colors.on-accent}'
    rounded: '{rounded.card}'
---

# Design System: beds24-direct-booking

The mock-up this describes is `design/home.html` with `design/home.css`; its tokens are the
custom properties at the top of that stylesheet. Where this file and the stylesheet disagree,
the stylesheet is right and this file is stale.

## Overview

**Creative North Star: "Stube"**

The site looks like the living room of the apartment it rents: light walls, pale wood, soft
furniture and space between things. A visitor planning a week away should feel that the place
is calm and looked after before reading a word. The free weeks and their prices are the point,
so the list is the quietest, clearest thing on the page.

Two things are kept apart. The **design language** is shared by every deployment: the shapes,
the spacing, the type scale, how controls behave and how a season changes the page. The
**theme** belongs to one deployment and is content: its colours and its typeface. The values
in this file are the demo's theme. Another site keeps the language and sets its own.

Dark grounds, heavy type, hard corners on controls and bright, saturated accents were tried
and rejected.

**Key Characteristics:**

- Light grey ground, white surfaces, a little pale oak.
- One muted accent, and it is the season: navy in winter, emerald in summer.
- Regular and medium weights only.
- Round controls and cards, but a photo keeps its straight edges.
- Few lines: space separates, a hairline only between the rows of a list.

## Colors

A neutral, slightly warm light palette with a single accent that changes with the season.

### Primary

- **Winter Navy** (#3b587c): the accent while the site shows winter. Buttons, the chosen
  price, free prices as text, links that act, the ampersand of the wordmark.
- **Summer Emerald** (#2c7060): the same roles while the site shows summer.

### Neutral

- **Wall Grey** (#f1f1ef): the page's ground.
- **White** (#ffffff): cards, the list's sheet, switches and menus.
- **Pale Oak** (#eadfce): the notice line above the header. Wood is a tint here, never a
  dark surface.
- **Slate Ink** (#27323a): text and headings, and the chosen apartment tab.
- **Soft Ink** (#5a666e): secondary text, column notes, a booked week.
- **Hairline** (#e7e5e0): the line between two rows of a list.
- **Edge** (#7c878f): the outline of a control that has no fill, at 3:1 against the ground.
- **Navy Tint** (#e2e8f0) and **Emerald Tint** (#deede8): the hover behind a price.

### Named Rules

**The One Season Rule.** A page shows one accent, the current season's. The two accents never
appear together except inside the season switch, where the other season is an icon in soft
ink.

**The Measured Pair Rule.** Text meets 4.5:1 against what it sits on and a control's edge
3:1, in both seasons. A theme is measured before it is accepted.

## Typography

**Display and Body Font:** Jost (with system-ui, sans-serif)

**Character:** one geometric sans-serif with open, round forms, used light. Size and space
make the hierarchy; weight barely does.

### Hierarchy

- **Display** (500, clamp(2.125rem, 1.5rem + 3vw, 3.5rem), 1.05): the page's one headline,
  on the hero card.
- **Headline** (500, clamp(1.875rem, 1.5rem + 1.6vw, 2.75rem), 1.1): a section's heading. Its
  second line may carry the season's name in the accent at weight 400.
- **Title** (500, 1.1875rem, 1.2): a column's name, a price.
- **Body** (400, 1.125rem, 1.5): running text and list rows. Paragraphs stay under about
  45rem.
- **Label** (500, 0.9375rem): switches, small buttons, notes at 0.875rem to 0.9375rem.

### Named Rules

**The Nothing Bold Rule.** No text weight above 500. Emphasis comes from size, colour or
position.

**The Figures Rule.** Prices and dates use tabular figures and are right-aligned in a list,
so that amounts can be compared down a column.

## Layout

- **Column:** content sits in a centred column of 66rem with a gutter of 1rem on a phone and
  2rem from 48rem up. The hero photo and, later, the map run edge to edge up to 120rem.
- **Hero:** the photo fills the first screen, the header lying over its top, which fades to
  the ground colour behind the header's text. The text is a white card near the bottom of the
  screen, 1rem from the sides on a phone and with its left edge on the column's left edge and
  a width of up to 46rem from 48rem up. The space below it grows with the screen's height, up
  to 4rem on a phone and 10rem from 48rem up, so on a tall screen the card stands clear of the
  bottom. It scrolls with the photo.
- **Rhythm:** 3.5rem above a section on a phone, 5rem from 48rem up; 1.5rem between a heading
  and what follows. More space above a heading than below it. The section after the hero has
  5.5rem above it, so a jump to it places the heading below the header with the photo out of
  view.
- **Header:** sticky, a light frosted bar (the ground colour at 72% with a blur). Over the hero
  at the top of the home page it has no ground of its own until the page scrolls. Below 64rem,
  and on a screen without hover such as a tablet, it holds the wordmark, the season switch and a
  menu button that opens a sheet from the right with the links and the languages. From 64rem up
  with a pointer that hovers, everything is in one line.
- **List:** from 48rem up one price column per apartment. Below that one apartment at a
  time, chosen with three tabs above the list.
- **Low windows:** under 30rem of height, bars that stay in view go back into the page.

## Elevation & Depth

Surfaces are told apart by tone first: white on light grey. A card adds one soft shadow that
falls downwards, so it reads as lying on the page rather than floating.

### Shadow Vocabulary

- **Card** (`box-shadow: 0 1.5rem 3rem -1.5rem rgb(39 50 58 / 0.25)`): the hero card, the
  list's sheet, the booking bar, an open menu.
- **Button hover** (`box-shadow: 0 0.5rem 1.25rem -0.5rem <accent>`): under a primary button
  while the pointer is on it.

## Shapes

- **Controls are pills** (999px): buttons, switches, tabs, a chosen price.
- **Cards have large corners** (1.5rem); an open menu 1rem.
- **Photos keep straight edges** and meet the ground in a plain horizontal line. Not every
  shape is round.
- **Borders are rare:** one pixel in the edge colour around a control without a fill, and a
  hairline between list rows. No frames around cards.
- **Icons** come from one set with round line ends, at 1.375rem beside text: Lucide, the set
  spartan/ui's components use, at its stroke width of 2.

## Components

### Buttons

- **Shape:** pill (999px), 3rem high, 1.5rem of padding at the sides.
- **Primary:** accent fill, white text at weight 500.
- **Hover / Focus:** a soft shadow in the accent on hover; a 2px accent outline, 3px away, on
  keyboard focus.
- **Text button:** a sentence in the accent with an arrow, underlined on hover. Used above
  the list to reach the other season ("Nächste Saison: Sommer 2027 →").

### Cards / Containers

- **Corner Style:** 1.5rem.
- **Background:** white on the grey ground.
- **Shadow Strategy:** the card shadow, see Elevation & Depth.
- **Border:** none.
- **Internal Padding:** 1.5rem 1.25rem on a phone; 2.25rem 2.5rem from 48rem up.

### Season switch

One white pill without an edge, as tall as a menu entry's hover pill beside it (2.75rem). The
chosen season is an accent-filled pill inside it with its
icon and its name; the other season shows its icon only and keeps its name for screen
readers. The list does not repeat this switch: it has the text button.

- **One width:** both names share one hidden cell, so the pill is as wide as the longer name
  in the page's language and does not change when the season does. Below 22.5rem it is a
  little smaller, so the wordmark keeps one line beside it.
- **The glide:** on a change the accent part moves to the other side by its two edges, the
  leading edge first and the trailing one 0.09 s later, so it stretches as it goes (0.32 s,
  ease in and out). The accent colour of the whole page fades to the other season's over
  0.45 s, the names fade, and the hero photos cross-fade over 0.6 s. Nothing moves on a page's
  first paint, and with reduced motion everything changes at once.
- **Winter on the left,** summer on the right, a snowflake and a sun. The icons never move:
  the snowflake sits left of its name, the sun right of its name, each at the outer edge.
- **Semantics:** a labelled radio group; the arrow keys change the season. The focus ring goes
  round the whole switch, which stays still while the chosen side glides.

### Free-weeks list

- **Sheet:** a white card holding a table. No vertical lines; a hairline between rows.
- **Row:** the stay's dates on the left in body text, one cell per apartment on the right.
- **Free week:** the price in the accent at title size, as a radio button without a visible
  box. Hover puts a soft tint behind it.
- **Chosen week:** an accent-filled pill with white figures.
- **Booked week:** the word in soft ink, no decoration.
- **Not open yet:** a short sentence in place of the table.
- **Apartment tabs (narrow):** three pills with an edge; the chosen one is filled with ink.

### Booking bar

Appears once a week is chosen and stays at the lower edge of the screen: an accent-filled
card that names the apartment, the stay and the price, with a white button that leads on. It
takes the accent so that it stands apart from the white sheet behind it.

### Navigation

Links in body text at weight 500 without underline; a pill of white behind the one under the
pointer. The apartments entry opens a small white menu with the card shadow, on hover or by
keyboard. In the sheet the apartments are indented under their entry at weight 400.

### Language menu

One entry at the end of the header's line: a globe and the current language's name in its
own language ("Deutsch"). It opens the same small menu as the apartments with the other
languages, each a link to the same page in that language, so it takes any number of them. In
the sheet the languages are indented below a label like the apartments, at weight 400, the
current one in the accent. The label, a globe and "Sprache", is in soft ink at label size, so it
does not look like an entry that can be followed. It is a
menu, not a pill, so that the two switches are easy to tell apart.

## Do's and Don'ts

### Do:

- **Do** keep the ground light and let white surfaces and space do the separating.
- **Do** use the season's accent for what a visitor can act on, and nothing else.
- **Do** measure every colour pair of a new theme in both seasons before using it.
- **Do** right-align prices and use tabular figures.
- **Do** keep a photo's edges straight and put text on a card in front of it.

### Don't:

- **Don't** use a dark ground or a dark gradient over a photo.
- **Don't** set text heavier than weight 500.
- **Don't** use bright, saturated accents; a season's colour is muted.
- **Don't** draw boxes and rules where space is enough.
- **Don't** give the language switch the season switch's shape; the two must be told apart.
- **Don't** hard-code a colour or a typeface in a component: both come from the theme.
