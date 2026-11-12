# Working agreements

How the project is built, tested and reviewed. The rules an agent needs in every session are in
`CLAUDE.md`; what is built and why is in `brief.md`.

## Roles

- **Viktor** writes each issue's intent and owns scope and what is left out, the design round
  and the design language, acceptance, the real business and its content, and calls on risk.
  Infrastructure he drives himself, with Claude as the reviewer.
- **Claude,** the developer agent, adds the plan to the issue, branches, commits with a
  co-author trailer and opens the pull request, with the screenshot matrix for UI work.
- **A reviewer agent** comments in the pull request: correctness first, then simplification. It
  runs on another model than the author, so the two do not share blind spots. Claude answers or
  fixes there; nobody copies text between agents.
- **Acceptance** is trying the result in the browser and reading what carries risk (the booking
  seam, guest data from the return URL, the token), not every line.

The process is part of what the project shows: issues, pull requests and agent reviews are
public.

## Batches and debt

- **One issue, one branch, one pull request.** Every bug and every piece of debt is its own
  issue. A small pull request costs little with an agent committing and a fast suite.
- **The history of `main` is one line.** A branch is rebased onto `main` right before it is
  merged, so each pull request shows as its commits followed by one merge commit and no two
  branches run side by side. Claude rebases when asked or when `main` has moved; with several
  pull requests open, they are merged one at a time.
- **Touching old code is the moment to question it.** Refactor in the same pull request if it
  stays small; otherwise open a `debt` issue.
- **Debt is recorded in issues,** where it is public and can be planned, not in an agent's
  memory.

## Identities on GitHub

- **Each agent has a GitHub App as its identity,** without a webhook and installed on this
  repository only, so that every comment shows who wrote it. Why, and what was left out, is in
  ADR 3.
- **The developer agent** opens pull requests, answers reviews and comments on issues as its
  App, which may write pull requests and issues and nothing else:
  `token=$(node scripts/app-token.mjs) && GH_TOKEN=$token gh …`. The `&&` matters: with an
  empty token the GitHub CLI falls back to the login it has stored, which is Viktor's.
  `DEVELOPER_APP_ID` holds the App's ID and `DEVELOPER_APP_KEY` the path to its private key,
  outside the repository.
- **What an agent posts names its tool and model in its last line,** since the Apps' names
  say neither.
- **Commits and pushes stay with Viktor's login,** with the agent as co-author. So do the
  milestone and the project board.
- **The reviewer agent** posts as its own App, see below.

## Reviews

- **A pull request needs one approval before it can be merged,** by a rule on `main`. The
  approval is Viktor's, after the reviewer agent's rounds and his own look at what carries
  risk. He can give it because the developer agent opens the pull requests. The reviewer agent
  comments and never approves.
- **Viktor starts a review** when a pull request is ready for one, and again after changes:
  `node scripts/review.mjs <pull request> --model <model> --effort <effort>`. The reviewer
  reads the whole pull request at its head, with the issue and the earlier discussion, and
  posts one review.
- **A single question** goes the same way with `--ask "<question>"`; the answer replaces the
  full review.
- **The reviewer's guidelines** are `AGENTS.md`. What it should look for is changed there, not
  in the command.
- **The reviewer's tool** is the Codex CLI, logged in on the machine that runs the command. The
  values for model and effort are that tool's; the review names them. Why it is a local
  command, and what replacing the tool takes, is in ADR 2.
- **The reviewer's identity** is an App that may write pull requests and nothing else.
  `REVIEWER_APP_ID` holds its ID and
  `REVIEWER_APP_KEY` the path to its private key, which is kept outside the repository.
  Without them the command prints the review.

## Testing

- **Every e2e test runs on three engines:** Chromium desktop, WebKit with an iPhone device and
  Firefox desktop. The suite is small, the visitors are tourists on phones, and most
  browser-specific breakage is Safari's.
- **The e2e suite runs against the simulator,** never against Beds24.
- **The screenshot matrix** (2 languages × 2 seasons × phone and desktop) stays on Chromium and
  the WebKit phone, or it is too large to review.
- **Playwright's WebKit is not Safari.** It is a first signal for layout and forms. Cookie
  blocking and wallet payments differ, so anything that depends on them (the booking frame) is
  confirmed once on a real iPhone.

## Accessibility

Built in from the first slice. A slice is not done while one of these fails:

- **Contrast is checked on the tokens, not the pages:** every text and control colour pair of
  both season palettes, in each state (rest, hover, focus, disabled), at 4.5:1 for text and
  3:1 for large text and control edges. Measured in the design round before a palette is
  chosen, and again by a check in CI when a token changes.
- **axe runs in the e2e suite** on every route, in both languages and both seasons, on phone
  and desktop.
- **Keyboard and focus:** every control reachable and operable by keyboard, a visible focus
  ring that meets contrast on both palettes, a skip link, focus moved sensibly after
  navigation. The week grid is the hard case: its keyboard model is decided in the design round.
- **Structure:** one `h1` per page, landmarks, the page language and the language of
  foreign-language fragments, and alternative texts required by the content schema.
- **Motion and zoom:** the season switch and any animation respect reduced motion; pages work
  at 200% zoom and 320 px width.
- **The embedded booking form is Beds24's,** so its accessibility is outside our control. The
  frame gets a title, and the accessibility statement names the limit.

## Agentic practices

In use from the start: the reviewer agent, the screenshot matrix, and hooks that run format and
lint after edits. Added when one of these has become routine:

<!-- prettier-ignore -->
| Practice | What it does |
|---|---|
| Design language file | Holds colours per season, type, spacing and component choices, and is loaded before UI work, so the look stays consistent across sessions. |
| Project skills | One skill per repeated procedure (add an apartment, add a guide page, record Beds24 responses), written when the procedure has been done twice. |
| Auditor agents | Narrow agents for accessibility, SEO and performance before a release. |
| Parallel worktrees | Independent slices built side by side, once the shell is stable. |

## Noted for the scaffold and the first slices

The stack, with format, lint, tests and the content schema, is ADR 4. Agreed beside it:

- **Site notice:** an optional line above the header with an optional link, per language, from
  the deployment's content. It is in the first shell slice, so the demo says it is a demo from
  day one.
- **Security headers** as Traefik labels in the stack; indexing off unless the flag is set.
- **Cheap CI checks:** licence check, `npm audit`, Angular's bundle budgets, a link check on
  the documents.
