# ADR 3: Each agent has its own identity on GitHub

Status: proposed, 2026-11-12.

## Context

Two agents work in this repository: a developer agent that writes the changes, and a reviewer
agent on another model (ADR 2). The reviewer posts as a GitHub App of its own. The developer
agent used the maintainer's login for everything, which has two costs:

- **A reader cannot tell who wrote a comment.** The maintainer's remarks and the agent's
  replies carry the same name, in a repository whose process is meant to be read.
- **The maintainer cannot approve the agent's pull request,** because GitHub lets nobody
  approve a pull request opened under their own name.

## Decision

1. **The developer agent has a GitHub App as its identity,** like the reviewer: no webhook, no
   server, installed on this repository only. It may write pull requests and issues.
2. **It opens pull requests, answers reviews and comments on issues as that App.**
   `scripts/app-token.mjs` signs a short-lived token with the App's private key, and the
   GitHub CLI uses it. The review command uses the same code for the reviewer's App.
3. **Commits and pushes stay with the maintainer's login,** with the agent named as co-author
   in the commit message.
4. **The Apps carry neutral names,** not a vendor's or a model's. Which tool and model wrote
   something is said in the text: in each review's last line and in the commit's co-author
   line.

## Options

<!-- prettier-ignore -->
| Option | For | Against | Result |
|---|---|---|---|
| A line under each comment that names the agent | Nothing to set up. | The comment still carries the maintainer's name and picture, and the pull request stays his own. | Rejected. |
| A second user account for the agent | Behaves like a person in every part of GitHub. | An account with a password and a token that does not expire by itself. | Rejected. |
| An App that also pushes the commits | The history would show the agent as author. | The agent's environment would hold a key that can change the code. | Rejected. |
| An App for pull requests, issues and comments | Tokens last an hour and are limited to this repository and these two permissions. | The key is readable in the agent's environment, so anything running there can post as the agent. | Chosen. |

## Consequences

- **The maintainer can review and approve** the agent's pull requests as anybody else's.
- **A pull request has two parties in its history:** it is opened by the App, its commits are
  the maintainer's with the agent as co-author.
- **Two more environment variables on the developing machine,** `DEVELOPER_APP_ID` and
  `DEVELOPER_APP_KEY`. They are no part of the site.
- **The reviewer's tool sees neither App's variables:** the review command passes on no
  variable that names an App.
- **Labels, the milestone and the project board stay with the maintainer's login.** Whether
  the App could set them was not tried.
