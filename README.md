# beds24-direct-booking

A direct-booking website for holiday apartments that are rented by the week. Beds24 is the
property management system: it holds availability, prices and listing texts, and takes the
booking and the payment. The site shows the free weeks with their prices and hands over to the
Beds24 guest form.

**Status:** the application is an empty shell with its checks; the first slices come next. This repository carries a fictional
demo only: apartments in an Austrian alpine village, in German and English.

## Documents

- [docs/brief.md](docs/brief.md): goals, non-goals, and every decision with its reason.
- [docs/beds24-findings.md](docs/beds24-findings.md): what the Beds24 API and booking page
  really do, from a spike against a real account.
- [docs/working-agreements.md](docs/working-agreements.md): how the project is built, tested
  and reviewed.
- [CLAUDE.md](CLAUDE.md): the instructions the coding agent works under.

## Running it

Node 24 and npm. After `npm ci`:

<!-- prettier-ignore -->
| Command | What it does |
|---|---|
| `npm start` | The development server on `localhost:4200`. |
| `npm run lint` and `npm run format:check` | ESLint and Prettier. `npm run format` rewrites. |
| `npm test` | The unit tests, once. |
| `npm run e2e` | Builds, starts the built server and runs the e2e suite on Chromium, WebKit with an iPhone device and Firefox. The browsers are installed once with `npx playwright install --with-deps`. |
| `npm run build`, then `npm run serve` | The built server on `localhost:4000`. It answers only for the hosts in `NG_ALLOWED_HOSTS`, for example `NG_ALLOWED_HOSTS=localhost`. |

## How it is built

The site is written by an AI coding agent (Claude Code) and directed by me. I write each
issue's intent, the agent plans in the issue, commits and opens the pull request, a second agent
on another model reviews it there, and I accept and merge. Issues, pull requests and reviews are
public on purpose: the process is part of what this project shows.

## Licence

The code and the documents of this repository are under the [MIT licence](LICENSE). The agent
skills in `.claude/skills/` and `.agents/skills/` are third-party files and keep their own
licences.
