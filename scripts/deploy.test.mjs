import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';

test('a password Compose would misread stops the deployment before it reaches the machine', () => {
  for (const password of ['""', "'quoted'", 'two words', 'a#b', 'a$b']) {
    const env = join(mkdtempSync(join(tmpdir(), 'deploy-')), 'site.env');
    writeFileSync(
      env,
      `STACK_NAME=site\nAPP_DOMAIN=example.test\nWEB_IMAGE=web:1\nSITE_PASSWORD=${password}\n`,
    );
    const run = spawnSync('bash', ['scripts/deploy.sh', 'machine.invalid', env], {
      encoding: 'utf8',
    });
    assert.equal(run.status, 1, password);
    // Only this line: the script stopped before its report, which would ask the machine.
    assert.match(run.stderr, /^SITE_PASSWORD in .* may hold only letters, digits, - and _\n$/);
  }
});
