# ADR 12: The CI check runs in parallel jobs

Status: accepted, 2026-11-20. Group: process.

## Context

The `check` job ran everything in one job of about 9.5 minutes: about 1.5 minutes of setup and build
(the container 19 s, `npm ci` 53 s, format, lint and unit tests 26 s, the build 24 s) and the e2e
suite for 8.8 minutes, 343 tests on two workers. Each pull request waited that long, a change of
documentation included.

A runner takes no more than two workers: with four, tests timed out and scroll measurements failed
as the runner overloaded (#142). Larger runners cost money. Standard runners cost nothing for a
public repository, and up to 20 jobs run at once.

## Decision

1. **The e2e suite runs in four jobs, one engine each and WebKit over two**
   (`--project webkit-phone --shard=n/2`), each in the Playwright image (ADR 9) with two workers.
   Amended on 2026-11-20 (#198): three shards of the whole suite came first, and the one that held
   almost all of WebKit was the longest every time.
2. **The suite is `fullyParallel`,** so a shard splits by test, not by file, and no worker runs a
   long file alone at the end. The tests were found to stand alone: in Chromium and Firefox each
   shard passed on its own, and in all three projects the whole suite passed in a shuffled order
   (`--shuffle 7`; WebKit in the Playwright image).
3. **Format, lint and unit tests run in a job of their own** on the plain runner, beside the e2e
   jobs.
4. **`node_modules` is restored from a cache keyed by `package.json` and the lock file,** and
   `npm ci` runs only when one of them changes. The cache is saved straight after `npm ci`, so the
   build's picture cache (ADR 10), kept inside `node_modules`, never enters it.
5. **A job named `check` sums up the others,** so the images and the deployment wait for one name,
   whatever the layout before it.

## Options

<!-- prettier-ignore -->
| Option | For | Against | Result |
|---|---|---|---|
| Leave it | Nothing to change. | Every pull request waits about 9.5 minutes. | Rejected. |
| More workers on one runner | One job. | The runner overloads at four (#142). | Rejected. |
| Larger runners | One job, more cores. | Paid, for a portfolio project. | Rejected. |
| One job per browser | Easy to read in the run. | Uneven: WebKit took about 40 % of the test time. | Rejected. |
| Shards of the whole suite | Parts of one count of tests; the count of shards can follow the suite. | The parts follow the projects' order, so one holds almost all of WebKit: its e2e step took 252–255 s against 129–181 s for the others. | Chosen first, with three; replaced on 2026-11-20. Start to `check`, warm cache: 262 and 303 s with 343 tests (#193), 298 and 317 s with the 361 tests of the replacement's time. |
| One job per engine, WebKit over two | Even parts by cost, not by count; a failure's job names its engine. | A fourth job's setup; the parts are set by hand as the suite grows. | Chosen on 2026-11-20. Start to `check`, warm cache, 361 tests: 244 and 273 s, about 49 s less than three shards on the same suite. The slowest step 195 and 216 s, now Chromium or Firefox. |
| A build job whose output the e2e jobs download | The build once. | A job in series before them, and an artifact to pass; the build is 24 s. | Rejected. |

## Consequences

- **A pull request's check takes about as long as its slowest e2e job,** now Chromium's or
  Firefox's.
- **A failure's report is in its job's artifact,** `playwright-report-<part>`, such as
  `playwright-report-webkit-1`.
- **A test must not depend on the order of tests or on state another test leaves,** in a worker or
  in the browser, as its job, its worker and its neighbours change with the layout. A test that does
  fails in some layouts only.
- **A change of `package.json` or the lock file pays `npm ci` once per job** and fills the cache for
  the next run.
- **A pull request that changes only documentation** (Markdown and `docs/`) runs the static checks
  alone. The e2e jobs are skipped and `check` accepts that; the stack check is skipped as well,
  which nothing before the images waits for. A push to `main` always runs everything.
