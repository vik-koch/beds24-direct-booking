# ADR 2: The reviewer agent is a local command

Status: accepted, 2026-11-12. Group: process.

## Context

Every pull request is reviewed by an agent on another model than its author, in the pull
request itself, so that the two do not share blind spots and the review is public. What the
review needs:

1. **Started on purpose.** A pull request grows in several commits; a review of each push is
   noise, and only the person who merges knows when it is ready.
2. **Model and reasoning effort chosen per run.** A document change and the booking seam do not
   deserve the same effort.
3. **Paid by a subscription.** There is a ChatGPT subscription and no API key, and a second
   bill by usage is not wanted for a project of this size.
4. **An identity of its own,** so that the pull request shows who wrote a review.
5. **Not tied to one vendor.** The subscription may change; the reviewer should then be
   replaced without rewriting the process.

## Decision

1. **A review is a local command,** `scripts/review.mjs`, run by the person who merges on their
   own machine. It reviews the whole pull request at its current head, or answers one question
   about it, and posts one review that names the commit, the tool, the model and the effort.
2. **A GitHub App is the reviewer's identity and nothing more.** It has no webhook and no
   server. The command signs a short-lived token with the App's private key, which stays on
   that machine.
3. **The reviewer's guidelines are `AGENTS.md`** in the repository root, a file name
   that Codex and other agent tools load by themselves.
4. **The reviewer's tool is one function in the command.** Today it calls the Codex CLI on a
   ChatGPT login. The contract around it is plain: a prompt goes in, a summary and a list of
   findings with path and line come out.

## Options

<!-- prettier-ignore -->
| Option | For | Against | Result |
|---|---|---|---|
| The review that Codex offers on GitHub, by `@codex review` or on every pull request | Nothing to build. Covered by the subscription. Reads `AGENTS.md`. | Its documentation describes no choice of model or effort. The review comes from the vendor's integration, so another vendor means another process. | Rejected for point 2. |
| A workflow in GitHub Actions with the Codex action, started by hand | Runs without the developer's machine. Model and effort are inputs. | The action requires an API key. | Rejected for point 3. |
| A GitHub App with a webhook that reacts to a comment | Started from the pull request itself, also from a phone. | Needs a server that is always on and holds the subscription login, for one person who sits at that machine anyway. | Rejected. |
| A local command, posting as the developer | The smallest thing: no App. | Review and merge would carry the same name. | Rejected for point 4. |
| A local command, posting as a GitHub App | Meets all five points. The App is a key file and a few lines. | Works only on a machine with the login and the key. A review cannot be started from elsewhere. | Chosen. |

What these statements rest on, on 2026-11-12:

- **Verified here:** three rounds of review of this change by Codex CLI 0.167.2 on a ChatGPT
  login, with model and effort from the command line, posted through the App. They found four
  defects, which were fixed, among them the two limits on the reviewer below. With those limits
  in place the reviewer's shell commands run, and a file in the home directory cannot be read
  from inside its sandbox.
- **Taken from documentation:** that the hosted review offers no choice of model or effort
  ([Codex on GitHub](https://learn.chatgpt.com/docs/third-party/github)), and that the action
  requires an API key ([codex-action](https://github.com/openai/codex-action)).
- **Not checked:** what the tool can reach on the network. In one round, when its shell did not
  start, it reported reading the project's documents through GitHub.

## Consequences

- **The agent's review happens when someone asks for one.** Nothing starts it by itself and no
  rule demands it; that stays a habit. The gate is elsewhere: since ADR 3 the maintainer can
  approve the developer agent's pull requests, and `main` requires that one approval. The
  reviewer comments and does not approve.
- **A re-review is the same command again.** The reviewer is given the earlier reviews and the
  replies, so it can see what was answered.
- **Replacing the tool is a change to one function,** as long as the new tool can be run from a
  command line, read the checkout and return the same shape. There is no interface for several
  tools: with one tool it would be untested guesswork.
- **The reviewer reads untrusted text and its answer is published.** Title, description and
  comments of a public repository reach the model, and so could an instruction hidden in them.
  The command therefore gives the tool a permissions profile of its own: it can read the
  checkout, the repository's git directory and the Node installation that holds the tool, and
  nothing else of the machine, and it is not told where the App's key is. What is left to leak
  is public already. The guidelines tell the reviewer to treat that text as material, and a
  review is only started for a pull request the developer has chosen.
- **The reviewer reads and does not run** (added 2026-11-13). Its checkout has no installed
  packages, so lint, the tests and the app do not start in it. The command gives it the result
  of each check in CI at the reviewed commit, with the failed steps of a failed one. Letting it
  install and run would have it execute a pull request's code while it reads untrusted text;
  running is the part of CI and of the maintainer's acceptance in the browser. Verified on that
  day: both endpoints the command reads answer for this public repository with the token of an
  App that has no permission on checks or Actions. Not checked: a failed check, because the
  repository had none.
- **Two environment variables on the reviewing machine,** `REVIEWER_APP_ID` and
  `REVIEWER_APP_KEY`. They are no part of the site. Without them the command prints the review
  instead of posting it, which is also the way to try a model.
- **The guidelines are public and versioned,** and a pull request that changes them is reviewed
  under its own version of them.
