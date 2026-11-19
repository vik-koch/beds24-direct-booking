# ADR 11: Beds24's rich text is sanitised on the server with sanitize-html

Status: accepted, 2026-11-19. Group: stack.

## Context

An apartment's description is Beds24's "Room Description 1", rich text written in the control
panel's Summernote editor and stored as written ([findings](../beds24-findings.md#listing-data)):
headings and tables nested inside paragraphs, bold as `<b>` or as a styled `<span>`, `<font>`
elements, inline styles and classes, U+FEFF characters, `<p><br></p>` as spacing and as an empty
text, links with `target="_blank"`, and pictures from Beds24's host without alternative text. The
page shows it in the site's own typography, so most of that has to go, and none of it may run as
script. What weighs on the choice:

- **The rules are agreed:** keep paragraphs, line breaks, lists, quotes, rules, `sup`, `sub` and
  links to `http`, `https`, `mailto` and `tel` without a target; turn bold into `strong`, italic
  into `em` and every heading into one level; unwrap spans, fonts, underlines, strikes, `pre` and
  tables; drop pictures, video, frames, scripts and styles; strip styles, classes, U+FEFF, empty
  paragraphs and empty links.
- **The text arrives on the server,** with the Beds24 answer, and reaches the browser in the page's
  HTML and its transfer state ([ADR 6](0006-beds24-data-in-a-page.md)).
- **Angular sanitises `[innerHTML]` as well,** but only for safety: it keeps elements such as
  `<font>` and tables, and it does not reshape the text.
- **Each dependency is one more to keep current,** and the server bundle carries it.

## Decision

1. **`src/beds24/rich-text.ts` reduces the text when the Beds24 answer is mapped,** so the cache,
   the transfer state and the page hold only the clean form, and an empty text becomes `''`.
2. **It uses [sanitize-html](https://github.com/apostrophecms/sanitize-html)** (MIT) with an
   allowlist of tags, of `href` on links and of the four link schemes, and transforms for bold,
   italic, headings and table rows. A table's cells are joined with a dash, its rows become
   paragraphs.
3. **A unit test per rule** runs against Summernote's shapes as the findings record them.

## Options

<!-- prettier-ignore -->
| Option | For | Against | Result |
|---|---|---|---|
| sanitize-html on the server | Built for an allowlist with transforms; parses with htmlparser2, which also closes a paragraph before a heading as a browser does; no DOM needed. Widely used and maintained. | A dependency with six of its own, among them PostCSS, in the server bundle. | Chosen. |
| A hand-written allowlist over a parser | No new dependency beyond a parser. | A sanitiser is easy to get wrong, and the parser is a dependency too; transforms and the empty-element rules would be ours to keep. | Rejected. |
| DOMPurify with a server DOM (jsdom or linkedom) | The reference for safety in the browser. | Needs a DOM on the server, a larger dependency; the reshaping (bold spans, headings, tables) is hooks of our own. | Rejected. |
| Angular's own sanitising only | Nothing to add. | Keeps Summernote's styling and nesting; strips without reshaping. | Rejected. |

## Consequences

- **The page styles a small, known set of elements,** so a description looks like the site whatever
  was pasted into the control panel.
- **A tag the rules do not name is unwrapped,** its text kept: a new editor feature shows as plain
  text until the rules take it in.
- **The same function serves the property's rich texts** when a page needs them.
