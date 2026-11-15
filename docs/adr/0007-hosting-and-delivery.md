# ADR 7: Hosting and delivery

Status: accepted, 2026-11-13. Group: stack.

## Context

The brief decides the shape: one small machine per site with a Traefik proxy in front, a `web`
container and, on the demo, a `sim` container, images built in CI, deployment from `main` only,
and a version tag for a state a private site can pin. `compose.yml` is that stack. This ADR
decides how a commit gets from `main` onto the demo's machine. What weighs on it:

- **The demo's machine is shared.** It already runs a Traefik proxy and other stacks, on x64.
  The delivery must not touch them.
- **The repository is public.** Whatever CI holds to reach the machine has to be worth little
  to anyone else and easy to withdraw.
- **A site of its own will reuse the delivery** from a private repository, on its own machine.
- **Nobody watches the demo.** A failed deployment has to be visible in the pull request's
  merge, not found later.

## Decision

1. **CI builds the two images on `main`,** once `check` and `stack` have passed, on a
   runner of the demo machine's architecture (x64), and pushes them to the GitHub container registry
   tagged with the commit.
2. **CI deploys by pushing over SSH** as the user `deploy`, with a key of
   this repository's own and the machine's host key pinned. One shell script does it:
   `scripts/deploy.sh` copies `compose.yml` and the stack's settings to `/srv/<stack name>`,
   starts the images the settings name and checks the public address.
3. **The demo's stack joins the proxy the machine already runs.** Nothing outside its own
   directory and its own images is changed; the script removes only this repository's images.
4. **A `v*.*.*` tag gives the images of that commit the version as a second tag.** Nothing is
   rebuilt, and the tag does not deploy: the demo follows `main`.
5. **No Terraform, no observability stack.** The machine exists; an external uptime check is
   enough for a site of this size.

## How a commit reaches the machine: options

<!-- prettier-ignore -->
| Option | For | Against | Result |
|---|---|---|---|
| The machine pulls: a watcher such as Watchtower, or a webhook that starts a pull | CI holds no credential for the machine. | A further service on a shared machine, with the Docker socket. The pipeline does not learn whether the deployment worked, so a failure shows nowhere. Settings and the compose file still have to reach the machine some other way. | Rejected. |
| CI pushes over SSH with a shell script | The run ends with the site checked, so a merge that breaks the demo is red. The same script works from a workstation and from a private repository. The maintainer already runs another project this way on the same machine. | CI holds a key for a user that can run Docker on the machine, which is as good as root there. | Chosen, with a key of its own that can be withdrawn alone, kept as a secret of a GitHub environment, and the host key pinned. |
| Deploying by hand | No credential anywhere. | "A merge deploys the demo" is the brief's rule, and a hand step is forgotten. | Rejected. |

## Images: options

<!-- prettier-ignore -->
| Option | For | Against | Result |
|---|---|---|---|
| Both architectures in one manifest | The same tag runs anywhere, and a change of the demo's machine needs no change here. | Two runners, a push by digest and a job that merges the manifests, for an image only the demo machine pulls: a site of its own builds its own image, because its content is needed at build time. | Rejected. |
| One architecture, the demo machine's, built on a runner of that architecture | One job, no emulation. | The published image runs on that architecture only, and the choice has to follow the machine. The pull request's `stack` job builds on the other architecture, so a Dockerfile that works on one alone still fails. | Chosen: x64. |
| Images tagged `latest` or `main` | Short settings. | The machine cannot tell what it runs, and a deployment is not repeatable. | Rejected: every deployment names the commit. |

## When old images are removed: options

<!-- prettier-ignore -->
| Option | For | Against | Result |
|---|---|---|---|
| A job at the end of the run on `main`, beside the deployment | The registry is tidied the moment it grows, and no second workflow exists. | A failure in tidying up turns a merge red although the demo is deployed, or is hidden if the job may fail. A trial run by hand, with another number to keep or without deleting, still needs a trigger of its own. | Rejected. |
| A workflow of its own, weekly and by hand | A merge's result says only whether the demo is deployed. A run by hand can show what would be removed before anything is. One concurrency group with the release workflow keeps tagging and removing apart. | Until the next run the registry holds up to a week's merges more than the ten commits it keeps. GitHub pauses a schedule after 60 days without activity in the repository, in which time nothing is pushed either. | Chosen. |

The rule counts versions and not their age, so both options end in the same registry. Compute
did not weigh: the job reads two lists and a few manifests and runs for seconds.

## The demo's delivery and a site's

A site of its own reuses the stack and the script and differs in what it has to bring itself.
[Deploying a site of its own](../deploying-a-site.md) has the steps.

<!-- prettier-ignore -->
| | The demo | A site of its own |
|---|---|---|
| Machine | Shared, exists, runs a proxy already. | Its own, set up from nothing by `infra/cloud-init.yml`, which also starts the proxy. |
| Where the image is built | Here, on `main`. | In the site's private repository, from a released version and the site's content, because the pages are prerendered. The workflow is the template `infra/site-deploy.yml`. |
| Architecture | x64, fixed here. | The runner the site's workflow names, to match its machine. |
| Registry | Public packages, pulled without a login. | The private repository's packages. The machine is logged in with the run's own token for the length of the run, so no long-lived credential is stored on it. |
| What deploys | A merge to `main` here. | A push to the site's `main`. A new release reaches the site when its workflow names it. |
| Beds24 | The simulator beside the app. | The site's Beds24 account, with the token as a secret. |
| Search engines | Kept out. | Let in by a variable. |

## What this rests on

- **Verified:** the script's paths (success, a start that fails on the machine, a site that
  does not answer, a missing setting) against stand-ins for `ssh` and `curl`; the stack itself
  by the `stack` job.
- **Taken from the maintainer's other project,** which deploys to the same machine in this way:
  that the proxy finds a stack by its labels and that the `deploy` user can run Docker.
- **Shown by the first deployment** (2026-11-13): the build, the push to the registry, the copy
  to the machine, the pull and the start worked, and the script reported the failure with the
  containers' state. The failure itself was an assumption nobody had checked: the images were
  built for ARM and the machine is x64.
- **Shown by the second deployment and the first release** (2026-11-13): a deployment that
  ends with the demo answering, and the release workflow. The section below has the result.

## Condition, and its result

The ADR was accepted on the condition that the first deployment from `main` and the first
release tag work as described. Both did, on 2026-11-13, and the condition is met:

- **The deployment.** The first run on `main` failed at the start of the containers, as told
  above. The run for the fix built and pushed the x64 images and deployed them. Afterwards
  `https://beds24.vikkoch.com/` answered 200 with the simulator's apartments, the response
  headers the stack sets and a certificate the proxy had fetched, and plain HTTP was redirected
  to HTTPS.
- **The release.** The tag `v0.1.0` on that commit ran the release workflow, and the registry
  lists `0.1.0` beside the commit's tag for both images.
- **Checked again on 2026-11-15:** the address, its headers, the redirect and the registry's
  tags are as described.

## Consequences

- **A merge to `main` is red when the deployment fails** at any step or the demo does not
  answer afterwards. The script then prints what runs on the machine; it does not roll back by
  itself. Going back is a revert on `main`.
- **An older commit is never deployed over a newer one.** Runs on `main` go one at a time, and
  the deploy job stops without deploying when its commit is no longer the head of `main`, which
  also holds for a run that is started again later. GitHub does not promise the order of
  waiting runs and drops a waiting run when a newer one arrives: such a commit gets no images
  and cannot be tagged as a release.
- **The maintainer provides** the `demo` environment's secret `DEPLOY_SSH_PRIVATE_KEY` and
  variables `DEPLOY_HOST`, `DEPLOY_KNOWN_HOSTS` and `DEMO_APP_DOMAIN`, the directory
  `/srv/beds24-demo` owned by `deploy`, the DNS record, and public visibility for the two image
  packages, since the machine pulls without a login.
- **Images pile up in the registry,** one pair per merge. A weekly workflow removes them with
  `scripts/prune-images.mjs`: it keeps every release and the newest ten commits of each image,
  so a commit further back than that can no longer be tagged as a release.
- **A site of its own** builds its image in a private repository from a released tag and its
  content, and calls the same script against its own machine, which it sets up with the
  proxy from one cloud-init file. The section above says what differs.
