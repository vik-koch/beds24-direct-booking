import assert from 'node:assert/strict';
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { readContent, writeContent } from './content.mjs';

// A copy of the demo's content with files changed, each given by its name and then its change.
function changed(...edits) {
  const dir = mkdtempSync(join(tmpdir(), 'content-'));
  cpSync('content/demo', dir, { recursive: true });
  for (let i = 0; i < edits.length; i += 2) {
    const value = JSON.parse(readFileSync(join(dir, edits[i]), 'utf8'));
    edits[i + 1](value);
    writeFileSync(join(dir, edits[i]), JSON.stringify(value));
  }
  return dir;
}

const bothTexts = (change) => changed('texts.de-AT.json', change, 'texts.en-GB.json', change);

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

test('the notice may be left out, in every language', () => {
  const dir = bothTexts((texts) => delete texts.notice);
  assert.equal(readContent(dir).texts.de.notice, undefined);
});

test('every language has the keys the first one has, and no others', () => {
  const fewer = changed('texts.en-GB.json', (texts) => delete texts.notice);
  assert.throws(
    () => readContent(fewer),
    /texts\.en-GB\.json\n {2}notice: missing, as texts\.de-AT\.json has it$/,
  );
  const nested = changed('texts.en-GB.json', (texts) => delete texts.credits.changes.cropped);
  assert.throws(
    () => readContent(nested),
    /texts\.en-GB\.json\n {2}credits\.changes\.cropped: missing, as texts\.de-AT\.json has it$/,
  );
  // The notice is visited last, as only the second language has it, and still reported first.
  const both = changed(
    'texts.de-AT.json',
    (texts) => delete texts.notice,
    'texts.en-GB.json',
    (texts) => delete texts.credits.changes.cropped,
  );
  assert.throws(() => readContent(both), /texts\.en-GB\.json\n {2}notice: not in texts\.de-AT/);
  const more = changed(
    'texts.en-GB.json',
    (texts) => (texts.notice.link = { text: 'More', href: '/en' }),
  );
  assert.throws(
    () => readContent(more),
    /texts\.en-GB\.json\n {2}notice\.link: not in texts\.de-AT\.json$/,
  );
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

test('a third season is refused', () => {
  const dir = changed('site.json', (site) => (site.seasons.autumn = site.seasons.winter));
  assert.throws(() => readContent(dir), /site\.json\n {2}seasons: Unrecognized key/);
});

test('a season cannot start on 29 February', () => {
  const dir = changed('site.json', (site) => (site.seasons.summer.start = '02-29'));
  assert.throws(() => readContent(dir), /seasons\.summer\.start: not a day of every year/);
});

test('two seasons need a start each, a single season none', () => {
  const both = changed('site.json', (site) => delete site.seasons.summer.start);
  assert.throws(() => readContent(both), /seasons\.summer\.start: two seasons need a start/);
  const one = changed('site.json', (site) => delete site.seasons.summer);
  assert.throws(() => readContent(one), /seasons\.winter\.start: a single season covers/);
});

test('the texts name exactly the seasons the site lists', () => {
  const extra = changed('site.json', (site) => {
    delete site.seasons.summer;
    delete site.seasons.winter.start;
  });
  assert.throws(() => readContent(extra), /texts\.de-AT\.json\n {2}seasons\.summer: a season/);
  const missing = changed('texts.en-GB.json', (texts) => delete texts.hero.summer);
  assert.throws(() => readContent(missing), /texts\.en-GB\.json\n {2}hero\.summer: missing/);
});

test('a hero photo must exist', () => {
  const dir = changed('site.json', (site) => (site.seasons.winter.hero.file = 'pictures/gone.jpg'));
  assert.throws(() => readContent(dir), /seasons\.winter\.hero\.file: pictures\/gone\.jpg/);
});

test('a feature names any Lucide icon, and only those', () => {
  const dir = changed('site.json', (site) => (site.features[0].icon = 'mountain-snow'));
  assert.equal(readContent(dir).site.features[0].icon, 'mountain-snow');
  const wrong = changed('site.json', (site) => (site.features[0].icon = 'chalet'));
  assert.throws(
    () => readContent(wrong),
    /site\.json\n {2}features\.0\.icon: chalet is not a Lucide icon/,
  );
});

test('two names of one icon import it once', () => {
  const dir = changed('site.json', (site) => {
    site.features[0].icon = 'heading-1';
    site.features[1].icon = 'heading1';
  });
  const out = mkdtempSync(join(tmpdir(), 'generated-'));
  writeContent(dir, out);
  const icons = readFileSync(join(out, 'icons.ts'), 'utf8');
  assert.equal(icons.match(/lucideHeading1/g).length, 2);
});

test('the site lists up to five features, or none, each key once', () => {
  const none = changed(
    'site.json',
    (site) => (site.features = []),
    'texts.de-AT.json',
    (texts) => (texts.hero.features = {}),
    'texts.en-GB.json',
    (texts) => (texts.hero.features = {}),
  );
  assert.deepEqual(readContent(none).site.features, []);
  const six = changed('site.json', (site) =>
    site.features.push(...['a', 'b', 'c'].map((key) => ({ key, icon: 'tag' }))),
  );
  assert.throws(() => readContent(six), /site\.json\n {2}features: /);
  const twice = changed('site.json', (site) => (site.features[1].key = site.features[0].key));
  assert.throws(() => readContent(twice), /features: a feature key is listed twice/);
});

test('every language names exactly the features the site lists', () => {
  const inherited = changed('site.json', (site) => (site.features[0].key = 'constructor'));
  assert.throws(
    () => readContent(inherited),
    /texts\.de-AT\.json\n {2}hero\.features\.constructor: missing$/,
  );
  const missing = bothTexts((texts) => delete texts.hero.features.saturdays);
  assert.throws(
    () => readContent(missing),
    /texts\.de-AT\.json\n {2}hero\.features\.saturdays: missing$/,
  );
  const other = bothTexts((texts) => (texts.hero.features.parking = 'Parking'));
  assert.throws(
    () => readContent(other),
    /hero\.features\.parking: a feature site\.json does not list$/,
  );
});

test('the contact may list any of its lines, or be left out', () => {
  const name = changed('site.json', (site) => (site.contact = { name: 'Only a name' }));
  assert.deepEqual(readContent(name).site.contact, { name: 'Only a name' });
  const none = changed('site.json', (site) => delete site.contact);
  assert.equal(readContent(none).site.contact, undefined);
});

test('a contact that lists nothing is refused', () => {
  const dir = changed('site.json', (site) => (site.contact = {}));
  assert.throws(() => readContent(dir), /contact: lists nothing/);
});

test('a change the schema does not know is refused', () => {
  const dir = changed(
    'site.json',
    (site) => (site.seasons.winter.hero.credit.changes = ['tinted']),
  );
  assert.throws(() => readContent(dir), /seasons\.winter\.hero\.credit\.changes\.0/);
});

test('a change without its text in one language is named', () => {
  const dir = changed('texts.en-GB.json', (texts) => delete texts.credits.changes.scaled);
  assert.throws(
    () => readContent(dir),
    /texts\.en-GB\.json\n {2}credits\.changes\.scaled: missing/,
  );
});
