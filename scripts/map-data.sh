#!/usr/bin/env bash
# Takes the map's data afresh with the three map scripts and, when the content folder's map/
# changed and passes the content build's checks, proposes it in a pull request from the branch
# map-data, which belongs to this script. A run that finds the data as committed closes that pull
# request.
# The map data workflows call it from the root of the repository that holds the content, with gh
# logged in and git's author set.
#
#   CONTENT_DIR=<folder> scripts/map-data.sh     the demo's folder without it
set -euo pipefail

content=${CONTENT_DIR:-content/demo}
map=$content/map
scripts=$(cd "$(dirname "$0")" && pwd)
branch=map-data

# The services fail now and then, so each script gets three tries.
for script in map-tiles map-routes map-lifts; do
  for attempt in 1 2 3; do
    node "$scripts/$script.mjs" && break
    [ "$attempt" -lt 3 ] || exit 1
    sleep 30
  done
done

pr=$(gh pr list --head "$branch" --json number --jq '.[].number')
if [ -z "$(git status --porcelain -- "$map")" ]; then
  echo "The map's data is as committed."
  [ -z "$pr" ] || gh pr close "$pr" --delete-branch --comment "The map's data is as main holds it again."
  exit 0
fi

# The content build's checks, so data the deployment would refuse is never proposed.
CHECK=$scripts/content.mjs node --input-type=module -e \
  'const { readContent } = await import(process.env.CHECK); readContent(process.argv[1]);' "$content"

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
const key = ({ properties: p }) => `${p.page ? `${p.page}: ` : ''}${p.apartment} to ${p.place}`;
const walk = ({ properties: p }) => `${p.meters} m, ${p.minutes} min`;
const routes = new Map(was('routes.json').features.map((route) => [key(route), route]));
for (const route of now('routes.json').features) {
  const old = routes.get(key(route));
  if (JSON.stringify(old) !== JSON.stringify(route))
    lines.push(`- Route ${key(route)}: ${walk(route)}, ${old ? `was ${walk(old)}` : 'new'}`);
}
// Lifts have no key: each one that is not in the other file, as a whole and counted, is listed.
const minus = (a, b) => {
  const rest = b.map((lift) => JSON.stringify(lift));
  return a.filter((lift) => {
    const i = rest.indexOf(JSON.stringify(lift));
    if (i < 0) return true;
    rest.splice(i, 1);
    return false;
  });
};
const name = ({ properties: p }) => `${p.kind} ${p.name ?? '(no name)'}`;
const [lifts, newLifts] = [was('lifts.json').features, now('lifts.json').features];
for (const lift of minus(newLifts, lifts)) lines.push(`- Lift new or changed: ${name(lift)}`);
for (const lift of minus(lifts, newLifts)) lines.push(`- Lift gone or changed: ${name(lift)}`);
console.log(lines.join('\n') || '- Other changes, in the files');
EOF
)

git switch -q --detach
git add -- "$map"
git commit -q -m "Take the map's data afresh" -m "$summary"
git push -q -f origin "HEAD:refs/heads/$branch"
body=$(printf '%s\n' "The map scripts found newer data in OpenStreetMap:" "" "$summary" "" \
  "The data passed the content build's checks before it was proposed. Walk a changed route, or" \
  "check it on the map, before merging. A later run replaces this branch.")
if [ -n "$pr" ]; then
  gh pr edit "$pr" --body "$body"
else
  gh pr create --head "$branch" --title "Take the map's data afresh" --body "$body"
fi
echo "Proposed on $branch:"
echo "$summary"
