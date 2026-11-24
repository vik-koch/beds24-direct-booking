# ADR 17: Content pages are Markdown files, turned into HTML by the content build

Status: accepted, 2026-11-24. Group: stack.

## Context

Besides its own pages (home, apartments, booking step, confirmation, picture credits), a site has
text pages: who the business is, the FAQ, the imprint, the privacy page, the rental terms, guest
guides ([issue 307](https://github.com/vik-koch/beds24-direct-booking/issues/307)). What weighs on
the choice:

- **Which pages a site has differs:** a country asks for its own legal pages, and a business writes
  the guides it needs. A deployment should add a page without a change to the code.
- **The texts are long and structured:** headings, lists, links, a table of cancellation fees,
  questions that fold open. The demo's texts file holds short strings only.
- **They are written and reviewed as files:** in the deployment's repository, with GitHub's preview
  or any editor, and read as diffs in a pull request. A visual editor's HTML export brings the
  styling and nesting [ADR 11](0011-rich-text-sanitised-on-the-server.md) has to strip from Beds24's
  texts.
- **The content checks stop the build** with the file and the key named, and pages without listings
  are prerendered.

## Decision

1. **One Markdown file per page and language,** `pages/<key>.<tag>.md`. `site.json` lists the keys
   in `pages`, and the footer's links in `footer`; each texts file gives each page its address in
   `paths` and its link text in `pages`. The page's title is the `#` heading the file opens with.
2. **The content build turns each file into HTML** with [marked](https://marked.js.org/) (MIT, no
   dependencies of its own), a dev dependency, and writes one module per page and language. A page's
   route loads its own module, as the texts are loaded, so neither the parser nor another page's
   text reaches the browser.
3. **What a page would not style is refused, not dropped:** headings, paragraphs, lists, quotes,
   rules, links to `http`, `https`, `mailto`, `tel`, the site's own paths and an `id` on the page,
   tables, and `<details>` with its `<summary>` and an `id`. Anything else stops the build with the
   file and the reason. The files are the deployment's own, so a mistake is fixed where it was made.
4. **One component shows every content page,** with the description's typography from
   `src/styles.css`. A `<details>` looks like the apartment page's accordion and opens when the
   address names its `id`; a table wider than the column scrolls in a frame of its own.

## Options

<!-- prettier-ignore -->
| Option | For | Against | Result |
|---|---|---|---|
| Markdown, converted with marked | Plain text that GitHub previews; readable diffs; no dependencies of its own; GFM tables; HTML blocks such as `<details>` pass through | One more package in the build | Chosen. |
| Markdown, converted with markdown-it | Strict CommonMark, plugins for heading ids and attributes | Six dependencies of its own | Rejected. |
| HTML files, sanitised like Beds24's texts | No parser | Harder to write and review; an editor's export brings styling to strip, and stripping hides the mistake | Rejected. |
| Texts in the texts files' JSON | No new file kind | Long texts with structure as JSON strings; no preview | Rejected. |
| A headless CMS | Editing in a browser | A service, accounts and a data flow for a few pages; the brief has no content editor in phase 1 | Rejected. |

## Consequences

- **A page a deployment adds** is a key in `site.json`, its address and link text in each texts
  file, and its files; the routes, the prerendering and the language switch follow from them.
- **Markdown inside an HTML block needs a blank line before it,** as CommonMark has it. The build
  names text that stays bare, such as an answer written right after `<summary>`.
- **A new element** is added to the list in `scripts/content.mjs` together with its style.
