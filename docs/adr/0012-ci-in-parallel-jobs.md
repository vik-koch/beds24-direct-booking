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

1. **The e2e suite runs in three shards,** a matrix of jobs with `--shard=n/3`, each in the
   Playwright image (ADR 9) with two workers.
2. **The suite is `fullyParallel`,** so the shards split by test, not by file, and no worker runs a
   long file alone at the end. Tests found standing alone in Chromium and Firefox: each shard passed
   on its own, and the whole suite passed in a shuffled order (`--shuffle 7`).
3. **Format, lint and unit tests run in a job of their own** on the plain runner, beside the shards.
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
| Shards of the whole suite | Parts of one count of tests; the count of shards can follow the suite. | The setup is paid once per shard; a failure's report is split over the shards; the parts follow the projects' order, so the WebKit shard is the longest. | Chosen, starting with three; more shards, or WebKit split over two jobs, are measured when the suite grows. |
| A build job whose output the shards download | The build once. | A job in series before the shards, and an artifact to pass; the build is 24 s. | Rejected. |

## Consequences

- **A pull request's check takes about as long as one shard,** its setup plus a third of the suite.
- **A failure's report is in its shard's artifact,** `playwright-report-<n>`.
- **A test must not depend on another one's state,** as any test may run in any shard and on any
  worker. A test that does fails in some layouts only.
- **A change of `package.json` or the lock file pays `npm ci` once per job** and fills the cache for
  the next run.
