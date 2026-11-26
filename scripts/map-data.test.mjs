import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import {
  chmodSync,
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';

const route = (meters, minutes, end = [12.61, 47.39], page) => ({
  type: 'Feature',
  properties: { ...(page && { page }), apartment: 'ahorn', place: 'lake', meters, minutes },
  geometry: { type: 'LineString', coordinates: [[12.6, 47.38], end] },
});
const lift = (name, top = 47.4) => ({
  properties: { kind: 'gondola', name },
  geometry: {
    type: 'LineString',
    coordinates: [
      [12.6, 47.38],
      [12.62, top],
    ],
  },
});
const lifts = (...features) => ({ type: 'FeatureCollection', features });

// A page's map may have a place of the same key as site.json's map.
const committed = [route(1000, 13), route(960, 12, undefined, 'parking')];

// A site's repository with its map committed and pushed, the script beside stand-ins for the map
// scripts, which write `writes` into the map, for the content check, which refuses the map when
// `invalid`, and for gh, which notes its calls and knows `pr`.
function site(writes, { pr = '', invalid = false } = {}) {
  const root = mkdtempSync(join(tmpdir(), 'map-data-'));
  const [repo, scripts, bin] = ['repo', 'scripts', 'bin'].map((name) => join(root, name));
  const map = join(repo, 'content', 'demo', 'map');
  for (const folder of [map, scripts, bin]) mkdirSync(folder, { recursive: true });
  const git = (...args) => execFileSync('git', args, { cwd: repo, encoding: 'utf8' });
  git('init', '-q', '--bare', join(root, 'origin.git'));
  git('init', '-q', '-b', 'main');
  git('remote', 'add', 'origin', join(root, 'origin.git'));
  writeFileSync(join(map, 'tiles.json'), JSON.stringify({ build: '20261122' }));
  writeFileSync(join(map, 'routes.json'), JSON.stringify({ features: committed }));
  writeFileSync(join(map, 'lifts.json'), JSON.stringify(lifts(lift('Ahornbahn'))));
  git('add', '.');
  git('-c', 'user.name=t', '-c', 'user.email=t@t', 'commit', '-q', '-m', 'map');
  git('push', '-q', 'origin', 'main');

  copyFileSync('scripts/map-data.sh', join(scripts, 'map-data.sh'));
  for (const name of ['map-tiles', 'map-routes', 'map-lifts']) {
    const file = `${name.slice(4)}.json`;
    const body =
      writes[file] &&
      `writeFileSync('${join(map, file)}', ${JSON.stringify(JSON.stringify(writes[file]))});`;
    writeFileSync(
      join(scripts, `${name}.mjs`),
      `import { writeFileSync } from 'node:fs';\n${body || ''}\n`,
    );
  }
  writeFileSync(
    join(scripts, 'content.mjs'),
    `export const readContent = (dir) => {
      if (dir !== 'content/demo' || ${invalid}) throw new Error('routes.json: missing');
    };`,
  );
  writeFileSync(
    join(bin, 'gh'),
    `#!/bin/sh\nprintf '%s\\n---\\n' "$*" >> ${join(root, 'gh.log')}\n[ "$2" = list ] && echo '${pr}'\nexit 0\n`,
  );
  chmodSync(join(bin, 'gh'), 0o755);

  const run = spawnSync('bash', [join(scripts, 'map-data.sh')], {
    cwd: repo,
    encoding: 'utf8',
    env: {
      ...process.env,
      PATH: `${bin}:${process.env.PATH}`,
      GIT_AUTHOR_NAME: 't',
      GIT_AUTHOR_EMAIL: 't@t',
      GIT_COMMITTER_NAME: 't',
      GIT_COMMITTER_EMAIL: 't@t',
    },
  });
  const log = join(root, 'gh.log');
  const branch = spawnSync('git', ['log', '-1', '--format=%B', 'map-data'], {
    cwd: join(root, 'origin.git'),
    encoding: 'utf8',
  });
  return {
    run,
    gh: existsSync(log) ? readFileSync(log, 'utf8') : '',
    proposed: branch.status === 0 ? branch.stdout : undefined,
    git,
  };
}

test('data as committed proposes nothing', () => {
  const { run, gh, proposed } = site({});
  assert.equal(run.status, 0, run.stderr);
  assert.match(run.stdout, /as committed/);
  assert.doesNotMatch(gh, /pr (create|edit|close)/);
  assert.equal(proposed, undefined);
});

test('data as committed closes the pull request that proposed other data', () => {
  const { run, gh } = site({}, { pr: '7' });
  assert.equal(run.status, 0, run.stderr);
  assert.match(gh, /pr close 7 --delete-branch/);
});

test('data the content build refuses is not proposed', () => {
  const { run, gh, proposed } = site({ 'lifts.json': lifts() }, { invalid: true });
  assert.notEqual(run.status, 0);
  assert.match(run.stderr, /routes\.json: missing/);
  assert.doesNotMatch(gh, /pr (create|edit)/);
  assert.equal(proposed, undefined);
});

test('changed data is pushed to map-data and opens a pull request that names the changes', () => {
  const { run, gh, proposed, git } = site({
    'tiles.json': { build: '20261130' },
    'routes.json': { features: [route(900, 12, [12.62, 47.39]), committed[1]] },
    'lifts.json': lifts(lift('Ahornbahn'), lift('Gipfelbahn'), lift('Gipfelbahn')),
  });
  assert.equal(run.status, 0, run.stderr);
  const summary = [
    '- Tiles of build 20261130, were 20261122',
    '- Route ahorn to lake: 900 m, 12 min, was 1000 m, 13 min',
    '- Lift new or changed: gondola Gipfelbahn',
    '- Lift new or changed: gondola Gipfelbahn',
  ].join('\n');
  assert.equal(proposed.trim(), `Take the map's data afresh\n\n${summary}`);
  assert.match(gh, /^pr list --head map-data/);
  assert.match(
    gh,
    /pr create --head map-data --title Take the map's data afresh --body [^]*Route ahorn/,
  );
  assert.equal(git('branch', '--show-current'), '', 'the local main stays where it was');
  assert.equal(git('rev-list', '--count', 'main').trim(), '1');
});

test('a run with a pull request open replaces its branch and its description', () => {
  const { run, gh, proposed } = site({ 'lifts.json': lifts() }, { pr: '7' });
  assert.equal(run.status, 0, run.stderr);
  assert.match(proposed, /- Lift gone or changed: gondola Ahornbahn/);
  assert.match(gh, /pr edit 7 --body [^]*Lift gone/);
  assert.doesNotMatch(gh, /pr create/);
});

test('a walk that takes longer on the same line, and a lift that moved, are named', () => {
  const { proposed } = site({
    'routes.json': { features: [committed[0], route(960, 13, undefined, 'parking')] },
    'lifts.json': lifts(lift('Ahornbahn', 47.41)),
  });
  assert.match(
    proposed,
    /- Route parking: ahorn to lake: 960 m, 13 min, was 960 m, 12 min\n- Lift/,
  );
  assert.match(
    proposed,
    /- Lift new or changed: gondola Ahornbahn\n- Lift gone or changed: gondola Ahornbahn/,
  );
});
