# beds24-direct-booking

`beds24-direct-booking` is a direct-booking website for weekly holiday apartments. Beds24 is the
property management system: it holds availability, prices and listing texts, and takes the
booking and the payment. The site shows what Beds24 knows and hands over to its guest form.

The repository is public as a portfolio piece and carries a fictional demo only. **Nothing about
the real business** (its name, place, country, languages, IDs) goes into it: that is a private
deployment built from a public tag plus its own content. The demo is a deployment, never a mode.

## Where things are

- **What and why:** `docs/brief.md`; every decision with its alternatives in `docs/adr/`,
  indexed by product, stack and process in its `README.md`.
- **How we build, test and review, in full:** `docs/working-agreements.md`.
- **What Beds24 really does:** `docs/beds24-findings.md`. Trust it over the Beds24 documentation
  and the OpenAPI file, and extend it when the wire shows something new.
- **The app:** `src/`. **Beds24 client and mapping:** `src/beds24/`, the only place that knows
  wire shapes. **The simulator:** `sim/`, the demo's and the tests' Beds24.
- **The reviewer agent:** its guidelines are `AGENTS.md`, its command `scripts/review.mjs`.
- **A deployment's content:** `content/<deployment>/`, validated by one schema at build time.

## How we work

1. Viktor writes an issue's intent: what, why, what counts as done. Claude adds the plan to the
   issue and waits for a go on anything that changes scope or a decision.
2. Claude branches (`feat/12-week-grid`), commits with a co-author trailer, and opens a pull
   request with the screenshot matrix for UI work. On GitHub Claude writes as the developer
   agent's App, and names its tool and model in the last line of what it posts:
   `token=$(node scripts/app-token.mjs) && GH_TOKEN=$token gh …`.
3. Viktor starts the reviewer agent, which runs on another model and reviews in the pull
   request. Claude answers or fixes there.
4. Viktor accepts in the browser, reviews what carries risk, and merges. A merge deploys the
   demo; a tag is a release.

Small batches: one issue, one branch, one pull request. Every bug and every piece of debt is its
own issue, however small; nothing rides along on another branch.

Viktor owns scope, the design language, anything about the real business, and merging. Ask
before adding a dependency, a route, a content key or an environment variable.

## Rules for every change

- A slice is cut by capability and is done when lint, unit tests and the e2e suite pass, its
  edge states (empty, partial, unavailable, Beds24 unreachable) are handled, and it works at
  320 px, by keyboard, in both languages and both seasons.
- A decision that shapes the code gets a short ADR in the same pull request, with its group
  and a line in the index.
- Wording, pictures and theme values are content, never code. A picture without an alternative
  text fails the build.
- The Beds24 token stays on the server. Guest data from the return URL is shown, then dropped:
  never logged, never stored.
- **Touching old code is the moment to question it.** Simplify what the change makes awkward,
  in the same pull request if it stays small and in a commit of its own. If it does not stay
  small, open a `debt` issue and name it in the pull request. Never leave a known wart unsaid.

## Style

- **Compact code.** The smallest thing that does the job: no abstraction for one caller, no
  option nobody sets, no defensive branch for a state that cannot occur. Fewer lines over
  cleverness; a reader should not need a second file to follow one function.
- **Few comments.** Only a trap, an ordering constraint or an invariant the code cannot show,
  in one line. No restating, no history, no section banners. If a comment explains what the
  code does, rewrite the code.
- Names in code are US English; prose is British. Pull requests and commits say what changed
  and why in a few lines.

This file stays short: a rule enters when a problem has shown it is needed.
