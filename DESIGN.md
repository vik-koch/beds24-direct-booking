---
name: beds24-direct-booking
description:
  A light, roomy look for a small business's holiday apartments, with one muted colour per season.
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
    height: '2.75rem'
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

The mock-up this describes is `design/home.html` with `design/home.css`; its tokens are the custom
properties at the top of that stylesheet. Where this file and the stylesheet disagree, the
stylesheet is right and this file is stale.

## Overview

**Creative North Star: "Stube"**

The site looks like the living room of the apartment it rents: light walls, pale wood, soft
furniture and space between things. A visitor planning a week away should feel that the place is
calm and looked after before reading a word. The free weeks and their prices are the point, so the
list is the quietest, clearest thing on the page.

Two things are kept apart. The **design language** is shared by every deployment: the shapes, the
spacing, the type scale, how controls behave and how a season changes the page. The **theme**
belongs to one deployment and is content: its colours and its typeface. The values in this file are
the demo's theme. Another site keeps the language and sets its own.

Dark grounds, heavy type, hard corners on controls and bright, saturated accents were tried and
rejected.

**Key Characteristics:**

- Light grey ground, white surfaces, a little pale oak.
- One muted accent, and it is the season: navy in winter, emerald in summer.
- Regular and medium weights only.
- Round controls and cards, but a photo keeps its straight edges.
- Few lines: space separates, a hairline only between the rows of a list, and a light ground behind
  every other group of rows.

## Colors

A neutral, slightly warm light palette with a single accent that changes with the season.

### Primary

- **Winter Navy** (#3b587c): the accent while the site shows winter. Buttons, the chosen price, free
  prices as text, links that act, the ampersand of the wordmark.
- **Summer Emerald** (#2c7060): the same roles while the site shows summer.

### Neutral

- **Wall Grey** (#f1f1ef): the page's ground.
- **White** (#ffffff): cards, the list's sheet, switches and menus.
- **Pale Oak** (#eadfce): the notice line above the header. Wood is a tint here, never a dark
  surface.
- **Slate Ink** (#27323a): text and headings, and the chosen apartment tab.
- **Soft Ink** (#5a666e): secondary text, column notes, a booked week.
- **Hairline** (#e7e5e0): the line between two rows of a list.
- **Edge** (#7c878f): the outline of a control that has no fill, at 3:1 against the ground.
- **Navy Tint** (#e2e8f0) and **Emerald Tint** (#deede8): the hover behind a price.

### Named Rules

**The One Season Rule.** A page shows one accent, the current season's. The two accents never appear
together except inside the season switch, where the other season is an icon in soft ink.

**The Measured Pair Rule.** Text meets 4.5:1 against what it sits on and a control's edge 3:1, in
both seasons. A theme is measured before it is accepted.

## Typography

**Display and Body Font:** Jost (with system-ui, sans-serif)

**Character:** one geometric sans-serif with open, round forms, used light. Size and space make the
hierarchy; weight barely does.

### Hierarchy

- **Display** (500, clamp(2.125rem, 1.5rem + 3vw, 3.5rem), 1.05): the page's one headline, on the
  hero card.
- **Headline** (500, clamp(1.875rem, 1.5rem + 1.6vw, 2.75rem), 1.1): a section's heading. It may
  carry the season's name in the accent at weight 400, after it or on a second line.
- **Lead** (400, clamp(1.1875rem, 1rem + 0.5vw, 1.375rem), 1.5, ink-soft): the line under the
  display headline on the hero card. The feature icons below it are 1.25rem on a phone and 1.5rem
  from 48rem up, their centre at 0.5 and 0.6 of the cap height above the baseline.
- **Title** (500, 1.1875rem, 1.2): a column's name, a price.
- **Body** (400, 1.125rem, 1.5): running text and list rows. Paragraphs stay under about 45rem.
- **Label** (500, 0.9375rem): switches, small buttons, notes at 0.875rem to 0.9375rem.

### Named Rules

**The Nothing Bold Rule.** No text weight above 500. Emphasis comes from size, colour or position.

**The Figures Rule.** Prices and dates use tabular figures and are right-aligned in a list, so that
amounts can be compared down a column.

## Layout

- **Width:** the layout is measured from 320 px, the narrowest phone it promises. Narrower, as in a
  docked developer tool, the page keeps its 320 px layout and scrolls sideways instead of squeezing.
  The minimum is in px, not rem, so that zoom up to 400% at 1280 px, which leaves 320 CSS px, still
  reflows.
- **Column:** content sits in a centred column of 66rem with a gutter of 1rem on a phone and 2rem
  from 48rem up. The hero photo and, later, the map run edge to edge up to 120rem.
- **Hero:** the photo fills the first screen, the header lying over its top, which fades to the
  ground colour behind the header's text. The text is a white card near the bottom of the screen,
  1rem from the sides on a phone and with its left edge on the column's left edge and a width of up
  to 46rem from 48rem up. The space below it grows with the screen's height, up to 4rem on a phone
  and 10rem from 48rem up, so on a tall screen the card stands clear of the bottom. It scrolls with
  the photo.
- **Rhythm:** 3.5rem above a section on a phone, 5rem from 48rem up; 1.5rem between a heading and
  what follows. More space above a heading than below it. The section after the hero has 2.75rem
  above it, and a jump to it places the section's top at the header's lower edge, so the header
  covers the photo's last strip.
- **Jumps:** a jump within the page scrolls smoothly, at once with reduced motion. An address with a
  section's anchor opens at that section, with no scroll to be seen. Without JavaScript, Chromium
  still scrolls there from the top (#106).
- **Changes of page:** a new page fades in over the old one (the browser's cross-fade, 0.25 s),
  inside the application and on a full load alike; with reduced motion it changes at once.
- **Header:** sticky, a light frosted bar (the ground colour at 72% with a blur). Over the hero at
  the top of the home page it has no ground of its own until the page scrolls or the menu opens.
  Below 64rem, and on a screen without hover such as a tablet, it holds the wordmark, the season
  switch and a menu button that opens a sheet from the right with the links and the languages. From
  64rem up with a pointer that hovers, everything is in one line.
- **List:** from 48rem up one price column per apartment. Below that one apartment at a time, chosen
  with tabs above the list.
- **Low windows:** under 30rem of height, bars that stay in view go back into the page.

## Elevation & Depth

Surfaces are told apart by tone first: white on light grey. A card adds one soft shadow that falls
downwards, so it reads as lying on the page rather than floating.

### Shadow Vocabulary

- **Card** (`box-shadow: 0 1.5rem 3rem -1.5rem rgb(39 50 58 / 0.25)`): the hero card, the list's
  sheet, the booking bar, an open menu.
- **Button hover** (`box-shadow: 0 0.5rem 1.25rem -0.5rem <accent>`): under a primary button while
  the pointer is on it.

## Shapes

- **Controls are pills** (999px): buttons, switches, tabs, a chosen price.
- **Cards have large corners** (1.5rem); an open menu 1rem.
- **Photos keep straight edges** and meet the ground in a plain horizontal line. Not every shape is
  round.
- **Borders are rare:** one pixel in the edge colour around a control without a fill, and a hairline
  between list rows. No frames around cards.
- **Icons** come from one set with round line ends, at 1.375rem beside text: Lucide, the set
  spartan/ui's components use, at its stroke width of 2.

## Components

### Buttons

- **One height for every control:** `--size-control`, 2.75rem (44 px): buttons, tabs, prices, icon
  buttons, menu entries and the season switch. A new control takes it, not a number.
- **Shape:** pill (999px), 1.5rem of padding at the sides.
- **Primary:** accent fill, white text at weight 500.
- **Hover / Focus:** a soft shadow in the accent on hover (underlined instead where the button
  stands on the accent, as in the booking bar); a 2px accent outline, 3px away, on keyboard focus,
  following the control's shape. Every tab stop shows it, on the control or on what it draws for a
  hidden input; an e2e test walks the home page's tab stops and checks each.
- **Text button:** a sentence in the accent with an arrow, underlined on hover. Its focus ring is a
  pill round the label with air at its sides (0.875rem); the label stays in line with the column and
  the ring may reach past it; below 22.5rem the label is at label size, so it keeps one line. Used
  above the list to reach the other season ("Nächste Saison: Sommer 2027 →").

### Cards / Containers

- **Corner Style:** 1.5rem.
- **Background:** white on the grey ground.
- **Shadow Strategy:** the card shadow, see Elevation & Depth.
- **Border:** none.
- **Internal Padding:** 1.5rem 1.25rem on a phone; 2.25rem 2.5rem from 48rem up.

### Season switch

One white pill without an edge, as tall as a menu entry's hover pill beside it (2.75rem). The chosen
season is an accent-filled pill inside it with its icon and its name; the other season shows its
icon only and keeps its name for screen readers. The list does not repeat this switch: it has the
text button.

- **One width:** both names share one hidden cell, so the pill is as wide as the longer name in the
  page's language and does not change when the season does. The accent part is as wide as the chosen
  season's icon and name, so beside the shorter name the white part grows.
- **Icons only below 24rem:** on the narrowest phones both seasons show their icon alone, each in a
  round slot, so the wordmark keeps its size and one line beside it. The names stay the radios'
  names for screen readers. From 24rem up there is room for the chosen season's name, and it says
  what the icon only suggests. With the demo's name the row has 13 px to spare at both 320 px and
  384 px. Nothing limits a site name yet: #107 sets its limit by both widths. A name too long at 384
  px needs a higher breakpoint; one too long at 320 px has no room to gain here, since the icons
  already stand alone.
- **The glide:** on a change the accent part moves to the other side by its two edges, the leading
  edge first and the trailing one 0.09 s later, so it stretches as it goes (0.32 s, ease in and
  out). The accent colour of the whole page fades to the other season's over 0.45 s, the names fade,
  and the hero photos cross-fade over 0.6 s. Nothing moves on a page's first paint, and with reduced
  motion everything changes at once.
- **Winter on the left,** summer on the right, a snowflake and a sun. The icons never move: the
  snowflake sits left of its name, the sun right of its name, each at the outer edge.
- **Semantics:** a labelled radio group; the arrow keys change the season. The focus ring goes round
  the whole switch, which stays still while the chosen side glides.

### Free-weeks list

- **Sheet:** a white card holding the list. No vertical lines; a hairline between the weeks of a
  month. The card and its header row stay in place for every season and every state.
- **Heading:** "Free weeks" and the dated season in the accent at weight 400, on one line where it
  fits and on two where it does not. The text button stands on the heading's last line. Both
  seasons' names, and both of the button's labels, take the space of the longer one, so the heading,
  the button and the card stay where they are on a change of season.
- **Columns:** they share the card's width evenly, none narrower than its content. A column's head
  is the apartment's name with its guests and size below, right-aligned over the prices. On a phone
  the one apartment shown takes the whole header row: its name on the left, its facts on the right.
- **Months:** the weeks are grouped by the month they arrive in (a week from 26 December belongs to
  December). Each group starts with the month's name in soft ink at 0.875rem, with the year where
  the list starts and in January, and every other group lies on a light ground (the page's ground
  mixed 50% into white) that reaches the card's edges; the last month's reaches its lower edge too.
- **Row:** the stay's dates on the left in body text (weekday, day and month in figures, so a row
  fits at 320 px), one cell per apartment on the right. Below 22.5rem the rows leave the weekday
  out, since every week starts on the same one; each price's label still names it. On a phone the
  card has 1.25rem at its sides, room for a chosen price's pill.
- **Free week:** the price in the accent at title size, as a cell of a grid without a visible box.
  Hover puts a soft tint behind it.
- **Chosen week:** an accent-filled pill with white figures.
- **Booked week:** the word in soft ink, no decoration.
- **Keyboard:** the list is one grid, after the WAI-ARIA Authoring Practices' grid pattern. Tab
  enters it once, at the chosen week while it is shown. With nothing chosen it enters at the
  season's first week, booked or free; once the list has been used, where the focus last was, and
  after a change of season or of tab at the first week shown. The arrow keys move by week and
  apartment without choosing, Home and End to the row's first and last apartment, Page Up and Page
  Down to the same place in the month before or after, Ctrl+Home and Ctrl+End to the first and last
  week. Enter or Space chooses a free week or clears the chosen one. A booked week can be reached
  and is announced as booked, but not chosen. On a phone the arrows stay in the one apartment shown.
  The focus ring goes round the price's or the word's pill.
- **Not open yet, or no week free:** a short sentence below the header row, in the card, on the line
  where the first week's dates would be.
- **Below the sheet:** a note in soft ink on what the price includes, and the tourist tax, in line
  with the card; from 48rem up at most 80% of its width.
- **Apartment tabs (narrow):** a pill with an edge per apartment, all of one width and one height,
  in as many lines as their names need. A tab is at least as wide as the longest word in the names,
  up to half the row: three short names share a row at 320 px, three long ones stand two and one,
  and four stand two by two until all four fit in one row, never three and one. A word longer than
  half the row is hyphenated in its tab. The chosen tab is filled with ink, its colours changing
  over 0.2 s like a price's hover tint. A change of tab clears the chosen week. Without the
  application the tabs are not shown and the sheet scrolls sideways instead.
- **The other season:** the text button above the list. The next season's rows slide in from the
  right while the shown ones leave to the left, and back the other way (0.45 s, ease in and out),
  each by the card's whole width; the card, its header row, the heading and the button stay still
  and the button keeps the focus. The header's switch glides with it. A change from the header's
  switch cross-fades the rows over 0.6 s, like the hero photos. When the new season has more rows,
  the card grows while they move; when it has fewer, it shrinks after them (0.25 s), so the leaving
  rows are not cut off. The heading's season name and the button's label cross-fade over 0.2 s. With
  reduced motion the list changes at once.

### Booking bar

Appears once a week is chosen and stays at the lower edge of the screen, but never above the list's
card: an accent-filled card that names the apartment, the stay and the price, with a white button
that leads on and a white cross before it that clears the choice. It takes the accent so that it
stands apart from the white sheet behind it. From 48rem up it is 80% of the card's width, centred.
On a phone it is the full width, with the name on a line of its own, the stay and price below, and
the cross and the button at the two sides, each as far from the bar's edge as the other; below
22.5rem its text is 1rem, so the button keeps one line.

One week is chosen at a time, in either season: choosing another replaces it. The bar belongs to the
chosen week's season, so it is hidden while the other season is shown and returns with its own,
fading in (0.25 s) once the season's colours have changed. A second click on the chosen price, Enter
or Space on it, or the cross clears it; the cross then returns the focus to that price. Pressed with
a pointer, the page stays where it is; by keyboard, it scrolls to the price, so the focus is in
view.

### Navigation

Links in body text at weight 500 without underline; a pill of white behind the one under the
pointer. The apartments entry opens a small white menu with the card shadow, on hover or by
keyboard. In the sheet the apartments are indented under their entry at weight 400.

### Language menu

One entry at the end of the header's line: a globe and the current language's name in its own
language ("Deutsch"). It opens the same small menu as the apartments with the other languages, each
a link to the same page in that language, so it takes any number of them. In the sheet the languages
are indented below a label like the apartments, at weight 400, the current one in the accent. The
label, a globe and "Sprache", is in soft ink at label size, so it does not look like an entry that
can be followed. It is a menu, not a pill, so that the two switches are easy to tell apart.

A change of language keeps the visitor's place: the element at the header's lower edge stays there,
as far scrolled past as before, however long the other language's texts are. A chosen week stays
chosen, and the focus is on the language entry, or the menu button where the header is folded.

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
