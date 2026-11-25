# Decisions

Every decision that shapes the project, with the options that were weighed. The ADRs are numbered in
the order they were written and grouped here by what they are about. A new ADR gets its line in this
index in the same pull request.

## Product

What is built, for whom, and where its boundaries are.

<!-- prettier-ignore -->
| ADR | Decision | Status |
|---|---|---|
| [1](0001-beds24-and-an-own-website.md) | Beds24 holds the bookings, an own website shows them | Accepted |
| [16](0016-the-floor-plan.md) | The floor plan: one drawing without text shown as a picture, its zones and their names in the apartment's file | Accepted |

## Stack

The technology the site is built with and runs on.

<!-- prettier-ignore -->
| ADR | Decision | Status |
|---|---|---|
| [4](0004-the-stack.md) | The stack: Angular with server rendering, keyed text files, spartan/ui and Tailwind | Accepted |
| [5](0005-the-simulator.md) | The simulator: TypeScript run by Node, a computed calendar, the business as one JSON file | Accepted |
| [6](0006-beds24-data-in-a-page.md) | Beds24 data reaches a page through a resolver whose source exists on the server only | Accepted |
| [7](0007-hosting-and-delivery.md) | Hosting and delivery: CI builds the images and pushes the demo over SSH; a tag names a release | Accepted |
| [8](0008-the-season-in-the-page.md) | The season in the page: both seasons in the HTML, an inline script picks one before the first paint, local storage remembers a choice | Accepted |
| [10](0010-pictures-converted-at-build-time.md) | Apartment pictures are converted to WebP in several widths at build time, with sharp | Accepted |
| [11](0011-rich-text-sanitised-on-the-server.md) | Beds24's rich text is sanitised on the server with sanitize-html, to a small allowlist | Accepted |
| [13](0013-the-booking-view-in-a-cookie.md) | The booking panel's view in a cookie that the server reads, so the remembered view is rendered at the first paint | Accepted |
| [14](0014-the-map.md) | The map: MapLibre with the town's tiles served by the site, a Protomaps style in the theme's colours, walking routes computed by a script | Accepted |
| [17](0017-content-pages-in-markdown.md) | Content pages are Markdown files per language, turned into HTML by the content build with marked; what a page would not style is refused; an apartment may have its own; a page no navigation links is unlisted | Accepted |

## Process

How the project is developed, reviewed and released.

<!-- prettier-ignore -->
| ADR | Decision | Status |
|---|---|---|
| [2](0002-reviewer-agent.md) | The reviewer agent is a local command | Accepted |
| [3](0003-agent-identities.md) | Each agent has its own identity on GitHub | Accepted |
| [9](0009-ci-in-the-playwright-image.md) | The CI check runs in the Playwright image, whose tag must match the installed package | Accepted |
| [12](0012-ci-in-parallel-jobs.md) | The CI check runs in parallel jobs: the e2e suite one engine per job and WebKit over two, the static checks beside them | Accepted |
| [15](0015-map-data-in-a-weekly-pull-request.md) | Fresh map data comes as a weekly pull request from a workflow of its own; the deployment never fetches it | Accepted |
