# beds24-direct-booking

A direct-booking website for holiday apartments that are rented by the week. Beds24 is the property
management system: it holds availability, prices, listing texts and the bookings. The site shows the
free weeks with their prices. The booking step planned for 0.8.0 is its own form, which books the
chosen week through the Beds24 API; the guest pays on Stripe Checkout.

**Status:** `0.6.0` is the current release. The home page shows the two seasons, each with its hero
picture and tab icon, the free weeks of every apartment with their prices from Beds24, and each
apartment as a card. Every apartment has its own page with its pictures, the facts and texts of its
Beds24 listing, its registration number, and a booking panel to choose a week and the guests. An
apartment with a floor plan shows it in its gallery: each picture's room is framed on the plan, and
a room chosen on the plan opens its pictures. The home page and every apartment page show a map of
the place from the site's own tiles, with walking routes from the apartments to the places guests
look for; a weekly workflow proposes newer map data as a pull request. The content pages, such as
the company page, the FAQ and the legal pages, are Markdown files in both languages, with icons,
pictures and an optional map of their own places; an apartment can have pages of its own, such as
how to get there, linked from its "Good to know" or reached by a QR code in the apartment. The
header, the footer and the demo notice come from a deployment's [content folder](docs/content.md)
too. A site of its own is deployed from a release, also beside another one on the same machine and
closed with a password while it is under test. The demo is live at <https://beds24.vikkoch.com/> and
follows `main`. This repository carries a fictional demo only: _Firn & Farn_, an invented business
in Saalbach in Austria, in German and English. Its Beds24 is a [simulator](sim/README.md).

## Documents

- [docs/brief.md](docs/brief.md): goals, non-goals, and every decision with its reason.
- [docs/site-map.md](docs/site-map.md): the pages and their addresses, the header and footer, and
  the sections of the home page.
- [docs/content.md](docs/content.md): a site's content folder: wording, languages, theme, map.
- [docs/beds24-findings.md](docs/beds24-findings.md): what the Beds24 API and booking page really
  do, from a spike against a real account.
- [docs/working-agreements.md](docs/working-agreements.md): how the project is built, tested and
  reviewed.
- [docs/deploying-a-site.md](docs/deploying-a-site.md): from an empty machine to a live site of its
  own, built in a private repository from a release.
- [CLAUDE.md](CLAUDE.md): the instructions the coding agent works under.

## Running it

Node 24 and npm. After `npm ci`:

<!-- prettier-ignore -->
| Command | What it does |
|---|---|
| `npm run sim` | The Beds24 simulator on `localhost:4300`. The app needs it running. |
| `npm start` | The development server on `localhost:4200`, pointed at the simulator unless `BEDS24_URL` and `BEDS24_TOKEN` are set. |
| `npm run lint` and `npm run format:check` | ESLint and Prettier. `npm run format` rewrites. |
| `npm test` | The unit tests, once. |
| `npm run e2e` | Builds, starts the simulator and the built server and runs the e2e suite on Chromium, WebKit with an iPhone device and Firefox. The browsers are installed once with `npx playwright install --with-deps`. |
| `npm run e2e:webkit` | Builds and runs the e2e suite's WebKit project in the Playwright image CI uses, through Docker, for a machine whose own WebKit lacks its system libraries. Arguments go to Playwright, after `--`: `npm run e2e:webkit -- e2e/apartment.spec.ts`. |
| `npm run build`, then `npm run serve` | The built server on `localhost:4000`. It answers only for the hosts in `NG_ALLOWED_HOSTS`, for example `NG_ALLOWED_HOSTS=localhost`. It reads the Beds24 address and token from `BEDS24_URL` and `BEDS24_TOKEN`; for the simulator these are `http://localhost:4300/v2` and `simulator`. |

## Running it in containers

`compose.yml` is one site: the app behind the machine's Traefik proxy, with the simulator beside it
where the `sim` profile is set. Its settings are listed in [`.env.example`](.env.example). With
Docker, `scripts/check-stack.sh` builds both images, starts the stack behind a throwaway proxy on
`https://localhost:8443` and checks the page and its response headers.

## Delivery

A merge to `main` builds the two images and deploys the demo with
[`scripts/deploy.sh`](scripts/deploy.sh); a `v*.*.*` tag names the images of its commit as a
release. Once a week [`scripts/prune-images.mjs`](scripts/prune-images.mjs) removes the images of
old commits from the registry and keeps the releases. [ADR 7](docs/adr/0007-hosting-and-delivery.md)
has the reasons and lists what a deployment needs.

## How it is built

The site is written by an AI coding agent (Claude Code) and directed by me. I write each issue's
intent, the agent plans in the issue, commits and opens the pull request, a second agent on another
model reviews it there, and I accept and merge. Issues, pull requests and reviews are public on
purpose: the process is part of what this project shows.

## Licence

The code and the documents of this repository are under the [MIT licence](LICENSE). The agent skills
in `.claude/skills/` and `.agents/skills/` are third-party files and keep their own licences, as do
the icons, the font and the photographs of the mock-up in `design/`. The licence texts of the
skills, the icons and the font are in [`licenses/`](licenses/README.md); the photographs are
credited in [`design/README.md`](design/README.md).
