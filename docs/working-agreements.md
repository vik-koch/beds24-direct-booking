# Working agreements

How the project is built, tested and reviewed. The rules an agent needs in every session are in
`CLAUDE.md`; what is built and why is in `brief.md`.

## Roles

- **Viktor** writes each issue's intent and owns scope and what is left out, the design round and
  the design language, acceptance, the real business and its content, and calls on risk.
  Infrastructure he drives himself, with Claude as the reviewer.
- **Claude,** the developer agent, adds the plan to the issue, branches, commits with a co-author
  trailer and opens the pull request, with the screenshot matrix for UI work.
- **A reviewer agent** comments in the pull request: correctness first, then simplification. It runs
  on another model than the author, so the two do not share blind spots. Claude answers or fixes
  there; nobody copies text between agents.
- **Acceptance** is trying the result in the browser and reading what carries risk (the booking
  seam, guest data from the return URL, the token), not every line.

The process is part of what the project shows: issues, pull requests and agent reviews are public.

## Batches and debt

- **One issue, one branch, one pull request.** Every bug and every piece of debt is its own issue. A
  small pull request costs little with an agent committing and a fast suite.
- **The history of `main` is one line.** A branch is rebased onto `main` right before it is merged,
  so each pull request shows as its commits followed by one merge commit and no two branches run
  side by side. Claude rebases when asked or when `main` has moved; with several pull requests open,
  they are merged one at a time.
- **Touching old code is the moment to question it.** Refactor in the same pull request if it stays
  small; otherwise open a `debt` issue.
- **Debt is recorded in issues,** where it is public and can be planned, not in an agent's memory.

## Identities on GitHub

- **Each agent has a GitHub App as its identity,** without a webhook and installed on this
  repository only, so that every comment shows who wrote it. Why, and what was left out, is in
  ADR 3.
- **The developer agent** opens pull requests, answers reviews and comments on issues as its App,
  which may write pull requests and issues and nothing else:
  `token=$(node scripts/app-token.mjs) && GH_TOKEN=$token gh …`. The `&&` matters: with an empty
  token the GitHub CLI falls back to the login it has stored, which is Viktor's. `DEVELOPER_APP_ID`
  holds the App's ID and `DEVELOPER_APP_KEY` the path to its private key, outside the repository.
- **What an agent posts names its tool and model in its last line,** since the Apps' names say
  neither.
- **Commits and pushes stay with Viktor's login,** with the agent as co-author. So do the milestone
  and the project board.
- **The reviewer agent** posts as its own App, see below.

## Reviews

- **A pull request needs one approval before it can be merged,** by a rule on `main`. The approval
  is Viktor's, after the reviewer agent's rounds and his own look at what carries risk. He can give
  it because the developer agent opens the pull requests.
- **The reviewer agent's verdict is the state of its review:** it requests changes or approves.
  GitHub shows the verdict and does not count it, because the reviewer's App cannot write code: it
  neither holds a merge nor replaces Viktor's approval.
- **Viktor starts a review** when a pull request is ready for one, and again after changes:
  `node scripts/review.mjs <pull request> --model <model> --effort <effort>`. The reviewer reads the
  whole pull request at its head, with the issue, the earlier discussion and the results of its
  checks, and posts one review. It runs nothing itself, so a review is best started when CI has
  finished.
- **A single question** goes the same way with `--ask "<question>"`; the answer replaces the full
  review.
- **The reviewer's guidelines** are `AGENTS.md`. What it should look for is changed there, not in
  the command.
- **The reviewer's tool** is the Codex CLI, logged in on the machine that runs the command. The
  values for model and effort are that tool's; the review names them. Why it is a local command, and
  what replacing the tool takes, is in ADR 2.
- **The reviewer's identity** is an App that may write pull requests and nothing else.
  `REVIEWER_APP_ID` holds its ID and `REVIEWER_APP_KEY` the path to its private key, which is kept
  outside the repository. Without them the command prints the review.

## What the site supports

The normal visit is what the work and the reviews take care of: a current browser on an ordinary
phone or computer. Accessibility always counts. A rare condition outside this is not a finding, and
nothing is built or tested for it.

- **Browsers:** current Chrome, Edge and Firefox, plus current Safari on iOS and macOS, with
  JavaScript on and an ordinary connection.
- **Accessibility:** WCAG 2.2 AA: keyboard and screen-reader use, 200% zoom, and reflow at 320 CSS
  px, which is a 1,280 px desktop at 400% zoom. The current European standard, EN 301 549 V4.1.1 of
  September 2026, refers to WCAG 2.2 (secondary sources such as AccessibleEU, read on 18 November
  2026). The rules are under [Accessibility](#accessibility).
- **JavaScript is required to choose a week and to book.** Without JavaScript, pages can be read and
  their links work.
- **Outside the boundary:** an outdated system or browser, a stalled or very slow connection,
  controls used before the application has started. A first paint that looks wrong is inside it,
  since every visitor sees it.

## Testing

- **Every e2e test runs on three engines:** Chromium desktop, WebKit with an iPhone device and
  Firefox desktop. The suite is small, the visitors are tourists on phones, and most
  browser-specific breakage is Safari's.
- **A test whose result no engine could change is tagged `@any-engine`** and skips WebKit, whose
  headless frames make every test slow. That is a test of the server's answers, the address, what
  is stored, wording and numbers, or an axe scan at a width the test sets itself. A test stays in
  WebKit when it relies on the phone's own width or its menu sheet, on touch, focus, scrolling,
  motion, layout, date formats or decoding a picture. When in doubt, it stays.
- **The e2e suite runs against the simulator,** never against Beds24.
- **WebKit runs locally before a push,** not only in CI. Where the machine's own WebKit cannot
  start, `npm run e2e:webkit` runs it in the Playwright image CI uses.
- **The screenshot matrix** (2 languages × 2 seasons × phone and desktop) stays on Chromium and the
  WebKit phone, or it is too large to review.
- **Playwright's WebKit is not Safari.** It is a first signal for layout and forms. Cookie blocking
  and wallet payments differ, so anything that depends on them (the booking frame) is confirmed in
  the check on real Apple devices below.
- **A feature's done-when names neither Safari nor VoiceOver.** No feature could meet them: the
  maintainer has no Apple hardware, and no emulator stands in for it. WebKit is the signal for
  Safari's engine, NVDA on Windows the manual screen-reader check. What only Apple devices show is
  checked once, on a real iPhone and a real Mac, before a release guests rely on
  ([issue 100](https://github.com/vik-koch/beds24-direct-booking/issues/100)).

## Accessibility

Built in from the first slice. A slice is not done while one of these fails:

- **Contrast is checked on the tokens, not the pages:** every text and control colour pair of both
  season palettes, in each state (rest, hover, focus, disabled), at 4.5:1 for text and 3:1 for large
  text and control edges. Measured in the design round before a palette is chosen, and again by a
  check in CI when a token changes.
- **axe runs in the e2e suite** on every route, in both languages and both seasons, on phone and
  desktop.
- **Keyboard and focus:** every control reachable and operable by keyboard, a visible focus ring
  that meets contrast on both palettes, a skip link, focus moved sensibly after navigation. The stay
  picker is the hard case: its keyboard model was decided by a spike (ADR 4's conditions).
- **Structure:** one `h1` per page, landmarks, the page language and the language of
  foreign-language fragments, and alternative texts required by the content schema.
- **Motion and zoom:** the season switch and any animation respect reduced motion; pages work at
  200% zoom and 320 px width.
- **The embedded booking form is Beds24's,** so its accessibility is outside our control. The frame
  gets a title, and the accessibility statement names the limit.

## Agentic practices

In use from the start: the reviewer agent, the screenshot matrix, and hooks that run format and lint
after edits. Added when one of these has become routine:

<!-- prettier-ignore -->
| Practice | What it does |
|---|---|
| Design language file | Holds colours per season, type, spacing and component choices, and is loaded before UI work, so the look stays consistent across sessions. |
| Project skills | One skill per repeated procedure (add an apartment, add a guide page, record Beds24 responses), written when the procedure has been done twice. |
| Auditor agents | Narrow agents for accessibility, SEO and performance before a release. |
| Parallel worktrees | Independent slices built side by side, once the shell is stable. |

## Noted for the scaffold and the first slices

The stack, with format, lint, tests and the content schema, is ADR 4. Agreed beside it:

- **One width of 100 columns** for code, Markdown prose and comments. Prettier wraps code and
  Markdown prose, ESLint reports a longer comment in the TypeScript and in `scripts/*.mjs` and a
  longer line of an inline template, except a class list, and CI runs both. Comments elsewhere, in
  shell scripts, CSS and YAML, keep the width by hand.
- **Site notice:** an optional line above the header with an optional link, per language, from the
  deployment's content. It is in the first shell slice, so the demo says it is a demo from day one.
- **Security headers** as Traefik labels in the stack; indexing off unless the flag is set.
- **Cheap CI checks:** licence check, `npm audit`, Angular's bundle budgets, a link check on the
  documents.
