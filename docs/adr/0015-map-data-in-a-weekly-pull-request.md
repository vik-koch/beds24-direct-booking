# ADR 15: Fresh map data comes as a weekly pull request

Status: accepted, 2026-11-23. Group: process.

## Context

A site's map data (tiles, walking routes and lifts, ADR 14) is committed content, written by three
scripts that read OpenStreetMap through Protomaps, the OSRM router on routing.openstreetmap.de and
the Overpass API. The data was only as new as the last time someone ran them, so an edit in
OpenStreetMap, such as a new path, reached a site only when someone remembered to.

Rerunning the scripts on the demo on 2026-11-23 gave the same bytes for every file: all 62 tiles of
build 20261123 equal build 20261122's, and the routes and lifts files are unchanged.

## Decision

1. **A workflow of its own takes the data afresh,** every Monday and when started by hand. The
   demo's is `.github/workflows/map-data.yml`. A site of its own copies the template
   `infra/site-map-data.yml`, which runs the scripts of the release its `deploy.yml` names.
2. **It proposes the change in a pull request** from the branch `map-data`, which it replaces on
   every run that finds a change. The description names the tiles' build and each changed route and
   lift. Merging the pull request deploys the data, as any merge does.
3. **A run that finds nothing new changes nothing.** Tiles equal to the committed ones keep their
   build and their address.
4. **The deployment never fetches map data,** and has no flag for it.

## Alternatives

<!-- prettier-ignore -->
| Option | For | Against | Outcome |
|---|---|---|---|
| A workflow of its own that opens a pull request | A commit stays the whole state of a site, so a revert restores it; a person sees new routes before visitors do; a deployment depends on no map service. | One more workflow per repository, and a pull request to merge. | Chosen. |
| The deployment takes the data, always or behind a flag | No pull request; the data is always fresh. | Two builds of one commit can differ, so a revert no longer restores a site; a slow or failing map service fails a deployment; routes reach visitors unseen. | Rejected. |
| The workflow commits to `main` directly | No pull request to merge. | `main` takes changes only through an approved pull request; routes reach visitors unseen. | Rejected. |
| A reusable workflow the private repository calls instead of a copy | One file to maintain. | The deployment is a copied template, and one way for both keeps a site's set-up in files it can read. | Rejected. |

## Consequences

- **A pull request opened with a run's own token starts no `pull_request` run,** so the demo's
  workflow starts CI on the branch itself; `ci.yml` takes `workflow_dispatch` for that. A site's
  repository from the templates has no CI; the content build checks the data when the merge deploys
  it.
- **Both repositories must allow GitHub Actions to create pull requests** (Settings, Actions,
  General). Without it the run pushes the branch and then fails.
- **The branch `map-data` belongs to the workflow:** a commit added to it by hand is gone after the
  next run that finds a change.
- **Tiles that did change get new addresses,** and git keeps the tiles that did not change only
  once, so the repository grows by what OpenStreetMap changed inside the box.
- **GitHub pauses a schedule after 60 days without activity in a public repository;** it is switched
  on again under Actions.
- **Not checked:** the workflows themselves, before their first run on GitHub; the script is tested
  against a local remote with a stand-in for `gh`.
