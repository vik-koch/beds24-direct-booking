# ADR 7: Hosting and delivery

Status: accepted, 2026-11-13, on the condition below. Group: stack.

## Context

The brief decides the shape: one small machine per site with a Traefik proxy in front, a `web`
container and, on the demo, a `sim` container, images built in CI, deployment from `main` only,
and a version tag for a state a private site can pin. `compose.yml` is that stack. This ADR
decides how a commit gets from `main` onto the demo's machine. What weighs on it:

- **The demo's machine is shared.** It already runs a Traefik proxy and other stacks, on ARM.
  The delivery must not touch them.
- **The repository is public.** Whatever CI holds to reach the machine has to be worth little
  to anyone else and easy to withdraw.
- **A site of its own will reuse the delivery** from a private repository, on its own machine.
- **Nobody watches the demo.** A failed deployment has to be visible in the pull request's
  merge, not found later.

## Decision

1. **CI builds the two images on `main`,** once `check` and `stack` have passed, on an ARM
   runner for the demo machine's architecture, and pushes them to the GitHub container registry
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
| Both architectures in one manifest | The same tag runs anywhere. | Two runners, a push by digest and a job that merges the manifests, for an image only the ARM demo machine pulls: a site of its own builds its own image, because its content is needed at build time. | Rejected. |
| ARM only, built on an ARM runner | One job, no emulation. | The published image runs on ARM only. The pull request's `stack` job builds on x64, so a Dockerfile that works on one architecture alone still fails. | Chosen. |
| Images tagged `latest` or `main` | Short settings. | The machine cannot tell what it runs, and a deployment is not repeatable. | Rejected: every deployment names the commit. |

## What this rests on

- **Verified:** the script's paths (success, a start that fails on the machine, a site that
  does not answer, a missing setting) against stand-ins for `ssh` and `curl`; the stack itself
  by the `stack` job.
- **Taken from the maintainer's other project,** which deploys to the same machine in this way:
  that the proxy finds a stack by its labels and that the `deploy` user can run Docker.
- **Not run when this was written:** the image build on the ARM runner, the push to the
  registry, the deployment and the release workflow. They run for the first time when this is
  merged.

## Condition

The ADR is accepted on the condition that the first deployment from `main` and the first release
tag work as described. The result is added here when it is known.

## Consequences

- **A merge to `main` is red when the deployment fails** at any step or the demo does not
  answer afterwards. The script then prints what runs on the machine; it does not roll back by
  itself. Going back is a revert on `main`.
- **Runs on `main` go one after the other,** so an older commit cannot be deployed over a newer
  one. When merges follow each other quickly, a run that is still waiting is dropped for the
  newer one: that commit gets no images and cannot be tagged as a release.
- **The maintainer provides** the `demo` environment's secret `DEPLOY_SSH_PRIVATE_KEY` and
  variables `DEPLOY_HOST`, `DEPLOY_KNOWN_HOSTS` and `DEMO_APP_DOMAIN`, the directory
  `/srv/beds24-demo` owned by `deploy`, the DNS record, and public visibility for the two image
  packages, since the machine pulls without a login.
- **Images pile up in the registry,** one pair per merge. Removing old ones is a job of its own.
- **A site of its own** builds its image in a private repository from a released tag and its
  content, and calls the same script against its own machine, which then also needs the proxy.
  That delivery, with a machine set up from nothing, is a separate piece of work.
