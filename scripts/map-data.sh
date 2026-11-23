#!/usr/bin/env bash
# Takes the map's data afresh with the three map scripts and, when the content folder's map/
# changed, proposes it in a pull request from the branch map-data, which belongs to this script.
# The map data workflows call it from the root of the repository that holds the content, with gh
# logged in and git's author set.
#
#   CONTENT_DIR=<folder> scripts/map-data.sh     the demo's folder without it
set -euo pipefail

map=${CONTENT_DIR:-content/demo}/map
branch=map-data

# The services fail now and then, so each script gets three tries.
for script in map-tiles map-routes map-lifts; do
  for attempt in 1 2 3; do
    node "$(dirname "$0")/$script.mjs" && break
    [ "$attempt" -lt 3 ] || exit 1
    sleep 30
  done
done

if [ -z "$(git status --porcelain -- "$map")" ]; then
  echo "The map's data is as committed."
  exit 0
fi

# routes.json and lifts.json are one line each, so the pull request names what changed in them.
summary=$(MAP=$map node --input-type=module <<'EOF'
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
const { MAP: map } = process.env;
const was = (file) => JSON.parse(execFileSync('git', ['show', `HEAD:./${map}/${file}`]));
const now = (file) => JSON.parse(readFileSync(`${map}/${file}`, 'utf8'));
const lines = [];
const [tiles, newTiles] = [was('tiles.json'), now('tiles.json')];
if (tiles.build !== newTiles.build) lines.push(`- Tiles of build ${newTiles.build}, were ${tiles.build}`);
const key = ({ properties: p }) => `${p.apartment} to ${p.place}`;
const routes = new Map(was('routes.json').features.map((route) => [key(route), route]));
for (const route of now('routes.json').features) {
  const old = routes.get(key(route));
  if (JSON.stringify(old?.geometry) !== JSON.stringify(route.geometry))
    lines.push(`- Route ${key(route)}: ${route.properties.meters} m${old ? `, was ${old.properties.meters} m` : ', new'}`);
}
const names = (lifts) => lifts.features.map(({ properties: p }) => `${p.kind} ${p.name ?? '(no name)'}`);
const [lifts, newLifts] = [names(was('lifts.json')), names(now('lifts.json'))];
for (const lift of newLifts.filter((name) => !lifts.includes(name))) lines.push(`- Lift added: ${lift}`);
for (const lift of lifts.filter((name) => !newLifts.includes(name))) lines.push(`- Lift gone: ${lift}`);
console.log(lines.join('\n') || '- Other changes, in the files');
EOF
)

git switch -q --detach
git add -- "$map"
git commit -q -m "Take the map's data afresh" -m "$summary"
git push -q -f origin "HEAD:refs/heads/$branch"
body=$(printf '%s\n' "The map scripts found newer data in OpenStreetMap:" "" "$summary" "" \
  "Walk a changed route, or check it on the map, before merging. A later run replaces this branch.")
pr=$(gh pr list --head "$branch" --json number --jq '.[].number')
if [ -n "$pr" ]; then
  gh pr edit "$pr" --body "$body"
else
  gh pr create --head "$branch" --title "Take the map's data afresh" --body "$body"
fi
echo "Proposed on $branch:"
echo "$summary"
[ -z "${GITHUB_OUTPUT:-}" ] || echo "branch=$branch" >>"$GITHUB_OUTPUT"
