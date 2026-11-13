# ADR 5: The simulator

Status: accepted, 2026-11-13. Group: stack.

## Context

The brief decides that a small server of our own stands in for Beds24: it is the demo's backend,
because the demo has no Beds24 account, and the e2e tests' backend. ADR 4 left the simulator's
own choices to its issue. What weighs on them:

- **The public repository cannot hold the recordings.** They contain a real account's data and
  stay private as the reference; `docs/beds24-findings.md` describes the shapes.
- **The demo runs unattended.** Nobody adds bookings or prices to it as the months pass.
- **It ships as its own container** on the demo and is started by the e2e suite, so what it
  needs to run should be little.
- **Its surface is small:** two calls now, one more and a simulated booking page later.

## Decision

1. **TypeScript on Node's own `http` module, run directly by Node 24.** No framework, no build
   step and no dependency of its own.
2. **The calendar is computed, not stored:** availability and prices are a function of the room
   and the date. Bookings are drawn from a hash of the room and the week's start date; prices
   follow yearly periods.
3. **The business is one JSON file,** `sim/data.json`, checked against the simulator's types by
   the compiler. Code turns it into the wire shapes.
4. **The wire shape is reproduced as far as the findings name it,** with its oddities (unused
   slots, bare entries, empty strings). Blocks the site never reads are left out.
5. **Nothing is configurable:** a fixed port and a fixed token. A setting enters when a
   deployment needs one.

## How it runs: options

<!-- prettier-ignore -->
| Option | For | Against | Result |
|---|---|---|---|
| Express, as the app's server uses | Known, with routing and query parsing. | Two routes need neither. The simulator's image would carry the app's dependencies or a second install. | Rejected. |
| TypeScript compiled to JavaScript | Runs on any Node version. | A build step and an output folder for four files, in development, in CI and in the image. | Rejected. |
| TypeScript run directly by Node | One command, nothing to build; the image is Node and one folder. | Only syntax that can be erased (no enums, no parameter properties), and imports name the `.ts` file. Tied to the Node version the project requires anyway. | Chosen. |

## Where the calendar comes from: options

<!-- prettier-ignore -->
| Option | For | Against | Result |
|---|---|---|---|
| Scrubbed recordings as fixtures | The exact wire. | Their dates pass: after the last recorded week the demo shows an empty calendar. Scrubbing a real account's data is a risk taken for every new recording. | Rejected. |
| A list of bookings and prices by date in the data file | Readable, and a test knows each week. | Runs out in the same way, or has to be extended by hand. | Rejected. |
| A pattern counted from today | Never runs out. | The pattern moves with the day: a week that is booked today is free tomorrow. | Rejected. |
| A function of room and date | Never runs out, and a week keeps its state for good. No clock in the simulator, so a test fixes a date range and nothing else. | The bookings are not a list anyone can read. A test finds a state by the bookable-week rules, not at a date it knows. | Chosen. |

## What this rests on

- **Verified by running it:** Node 24.18 starts the TypeScript files as they are on the
  developer's machine, and the JSON file is type-checked on import. CI runs the simulator's
  tests through Vitest and does not start it with Node yet; the e2e suite will, once the app
  reads from it.
- **Taken from `docs/beds24-findings.md`:** the response shapes, the 401 body and the rate limit
  headers.
- **Not checked on the wire:** what Beds24 answers when only some `include*` parameters are
  passed, and its errors other than the 401. `sim/README.md` lists where the simulator answers
  on its own account.

## Consequences

- **The simulator's image needs Node and the `sim` folder,** nothing from the app.
- **A booking that changes the calendar,** which the simulated booking page will bring, is kept
  in memory on top of the function and is gone after a restart.
- **A new apartment or text is an edit of the JSON file;** a missing field fails the type check.
- **The simulator stays a subset.** A field the site starts to read is added here first, in the
  shape the findings give.
