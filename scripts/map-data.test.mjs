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

const route = (meters, end) => ({
  type: 'Feature',
  properties: { apartment: 'ahorn', place: 'lake', meters },
  geometry: { type: 'LineString', coordinates: [[12.6, 47.38], end] },
});
const lifts = (...names) => ({
  type: 'FeatureCollection',
  features: names.map((name) => ({ properties: { kind: 'gondola', name } })),
});

// A site's repository with its map committed and pushed, the script beside stand-ins for the map
// scripts, which write `writes` into the map, and for gh, which notes its calls and knows `pr`.
function site(writes, pr = '') {
  const root = mkdtempSync(join(tmpdir(), 'map-data-'));
  const [repo, scripts, bin] = ['repo', 'scripts', 'bin'].map((name) => join(root, name));
  const map = join(repo, 'content', 'demo', 'map');
  for (const folder of [map, scripts, bin]) mkdirSync(folder, { recursive: true });
  const git = (...args) => execFileSync('git', args, { cwd: repo, encoding: 'utf8' });
  git('init', '-q', '--bare', join(root, 'origin.git'));
  git('init', '-q', '-b', 'main');
  git('remote', 'add', 'origin', join(root, 'origin.git'));
  writeFileSync(join(map, 'tiles.json'), JSON.stringify({ build: '20261122' }));
  writeFileSync(
    join(map, 'routes.json'),
    JSON.stringify({ features: [route(1000, [12.61, 47.39])] }),
  );
  writeFileSync(join(map, 'lifts.json'), JSON.stringify(lifts('Ahornbahn')));
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
  assert.equal(gh, '');
  assert.equal(proposed, undefined);
});

test('changed data is pushed to map-data and opens a pull request that names the changes', () => {
  const { run, gh, proposed, git } = site({
    'tiles.json': { build: '20261130' },
    'routes.json': { features: [route(900, [12.62, 47.39])] },
    'lifts.json': lifts('Ahornbahn', 'Gipfelbahn'),
  });
  assert.equal(run.status, 0, run.stderr);
  const summary = [
    '- Tiles of build 20261130, were 20261122',
    '- Route ahorn to lake: 900 m, was 1000 m',
    '- Lift added: gondola Gipfelbahn',
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
  const { run, gh, proposed } = site({ 'lifts.json': lifts() }, '7');
  assert.equal(run.status, 0, run.stderr);
  assert.match(proposed, /- Lift gone: gondola Ahornbahn/);
  assert.match(gh, /pr edit 7 --body [^]*Lift gone/);
  assert.doesNotMatch(gh, /pr create/);
});
