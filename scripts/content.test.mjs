import assert from 'node:assert/strict';
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { readContent } from './content.mjs';

// A copy of the demo's content with one file changed.
function changed(file, change) {
  const dir = mkdtempSync(join(tmpdir(), 'content-'));
  cpSync('content/demo', dir, { recursive: true });
  const value = JSON.parse(readFileSync(join(dir, file), 'utf8'));
  change(value);
  writeFileSync(join(dir, file), JSON.stringify(value));
  return dir;
}

test('the demo and the test site are valid', () => {
  assert.deepEqual(Object.keys(readContent('content/demo').texts), ['de', 'en']);
  assert.deepEqual(Object.keys(readContent('e2e/content').texts), ['it', 'nl']);
});

test('a key missing in one language is named', () => {
  const dir = changed('texts.en-GB.json', (texts) => delete texts.nav.weeks);
  assert.throws(() => readContent(dir), /texts\.en-GB\.json\n {2}nav\.weeks/);
});

test('a key the schema does not know is refused', () => {
  const dir = changed('texts.de-AT.json', (texts) => (texts.nav.extra = 'x'));
  assert.throws(() => readContent(dir), /texts\.de-AT\.json\n {2}nav/);
});

test('a language without its texts file fails', () => {
  const dir = changed('site.json', () => undefined);
  rmSync(join(dir, 'texts.en-GB.json'));
  assert.throws(() => readContent(dir), /texts\.en-GB\.json/);
});

test('the notice may be left out', () => {
  const dir = changed('texts.de-AT.json', (texts) => delete texts.notice);
  assert.equal(readContent(dir).texts.de.notice, undefined);
});

test('two languages with one address prefix are refused', () => {
  const dir = changed('site.json', (site) => (site.languages[1] = 'de-DE'));
  assert.throws(() => readContent(dir), /one address prefix/);
});

test('a language that is not a canonical tag is refused', () => {
  const dir = changed('site.json', (site) => (site.languages[1] = 'en_gb'));
  assert.throws(() => readContent(dir), /languages\.1: not a language tag/);
});

test('a language is named in its own language, from its tag', () => {
  const names = (dir) =>
    readContent(dir).site.languages.map(({ tag, code, name }) => [tag, code, name]);
  assert.deepEqual(names('content/demo'), [
    ['de-AT', 'de', 'Deutsch'],
    ['en-GB', 'en', 'English'],
  ]);
  assert.deepEqual(names('e2e/content')[0], ['it', 'it', 'Italiano']);
});
