# ADR 9: The CI check runs in the Playwright image

Status: accepted, 2026-11-19. Group: process.

## Context

The `check` job runs the e2e suite on Chromium, WebKit and Firefox. It installed the browsers on
every run with `npx playwright install --with-deps`, which also fetches well over a hundred system
packages with apt from Ubuntu's mirror. The step normally took about 40 s. On 2026-11-18 the mirror
delivered at about 50–100 KB/s, and the run was cancelled after 35 minutes, still in that step. The
runner started at once and the browsers' own download was normal: the time went to one outside
server the project does not control.

## Decision

1. **The `check` job runs in Microsoft's Playwright image** for the version of `@playwright/test` in
   the lock file, for Ubuntu 26.04 (`mcr.microsoft.com/playwright:v<version>-resolute`), the release
   `ubuntu-latest` ran the browsers on before. The browsers and their system packages are in the
   image; the install step is gone. The job runs as the runner's user, as Firefox refuses to start
   as root in another user's home.
2. **A step compares the image's tag with the installed `@playwright/test`** and fails the run with
   both versions named, so an upgrade of the package must move the image in the same change.
3. **The job has a time limit of 20 minutes,** about two and a half times a normal run, so a stalled
   step fails instead of holding the branch's run.

## Options

<!-- prettier-ignore -->
| Option | For | Against | Result |
|---|---|---|---|
| Leave it | Nothing to change. | A slow mirror holds a pull request for half an hour now and then, and the run says nothing about why. | Rejected. |
| Retry the install, or a time limit alone | Small. | A retry asks the same slow mirror again; a time limit only turns a long wait into a failure. | Kept as a guard (3), not as the fix. |
| Cache the apt packages and the browsers | Stays on the plain runner. | apt's cache is root-owned and spread over several directories; the cache key has to follow the browser revisions; a cache miss is the old step again. | Rejected. |
| The Playwright image | One pull of an image, from a registry other than the slow mirror, with the exact browsers and packages the version was released with. | A second place that names the Playwright version, and a dependency on Microsoft's registry. | Chosen, with the version check (2). |

## Consequences

- **An upgrade of Playwright is two lines:** the package and the image's tag. The check names both
  if one is forgotten.
- **The registry is a dependency that remains:** a slow or failing pull from `mcr.microsoft.com` can
  hold the job as the mirror did. The 20-minute limit bounds how long.
- **Dates may be written differently by the system's locale data:** on the image for Ubuntu 24.04
  WebKit wrote "Sat, 03/04" where 26.04 writes "Sat 03/04". Both are valid `Intl` output, so the e2e
  suite accepts either, and the image's release need not follow the runner's.
- **Local runs are unchanged:** a developer still installs the browsers once with
  `npx playwright install --with-deps`.
