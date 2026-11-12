# Working agreements

How the project is built, tested and reviewed. The rules an agent needs in every session are in
`CLAUDE.md`; what is built and why is in `brief.md`.

## Roles

- **Viktor** writes each issue's intent and owns scope and what is left out, the design round
  and the design language, acceptance, the real business and its content, and calls on risk.
  Infrastructure he drives himself, with Claude as the reviewer.
- **Claude** adds the plan to the issue, branches, commits with a co-author trailer and opens
  the pull request, with the screenshot matrix for UI work.
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
- **Touching old code is the moment to question it.** Refactor in the same pull request if it
  stays small; otherwise open a `debt` issue.
- **Debt is recorded in issues,** where it is public and can be planned, not in an agent's
  memory.

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

## For the stack ADR

Agreed in outline, to be fixed there:

- **Format and lint:** Prettier with sorted imports, run by a hook; ESLint with angular-eslint
  and the Tailwind class plugin.
- **Tests:** Vitest for units, Playwright for e2e.
- **Content:** one Zod schema for a deployment's content, checked at build time, so a bad
  content set fails the build and not the page.
- **Configuration is a build input.** Content, pictures and theme values are read at build time
  from one directory per deployment. Only the Beds24 address and token, the preview password
  and the indexing flag are runtime environment variables.
- **Site notice:** an optional line above the header with an optional link, per language, from
  the deployment's content. It is in the first shell slice, so the demo says it is a demo from
  day one.
- **Security headers** as Traefik labels in the stack; indexing off unless the flag is set.
- **Cheap CI checks:** licence check, `npm audit`, Angular's bundle budgets, a link check on
  the documents.
