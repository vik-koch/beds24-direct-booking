import assert from 'node:assert/strict';
import {
  cpSync,
  existsSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, test } from 'node:test';
import { siteSchema } from '../src/content/schema.ts';
import { readContent, writeContent } from './content.mjs';

// Every folder a test makes, removed when the file's tests are done.
const root = mkdtempSync(join(tmpdir(), 'content-test-'));
after(() => rmSync(root, { recursive: true, force: true }));

// A copy of the demo's content with files changed, each given by its name and then its change.
function changed(...edits) {
  const dir = mkdtempSync(join(root, 'content-'));
  cpSync('content/demo', dir, { recursive: true });
  for (let i = 0; i < edits.length; i += 2) {
    const value = JSON.parse(readFileSync(join(dir, edits[i]), 'utf8'));
    edits[i + 1](value);
    writeFileSync(join(dir, edits[i]), JSON.stringify(value));
  }
  return dir;
}

// The project's cache, which the content script before the tests has filled with the demo's
// pictures; scripts/pictures.test.mjs converts into empty caches.
const cache = 'node_modules/.cache/pictures';

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

test('a file that is not valid JSON is named', () => {
  for (const file of ['site.json', 'texts.en-GB.json', 'apartments/zirbe.json']) {
    const dir = changed('site.json', () => undefined);
    writeFileSync(join(dir, file), '{ "name": "x", }');
    assert.throws(
      () => readContent(dir),
      new RegExp(`${file.replace('.', '\\.')}\\n {2}\\(file\\): Expected double-quoted`),
    );
  }
});

test("a picture's season is one the site lists, and each season has as many pictures", () => {
  const winter = changed('apartments/zirbe.json', (apartment) => {
    apartment.pictures[0].season = 'winter';
  });
  assert.throws(() => readContent(winter), /zirbe\.json\n {2}pictures: 4 in winter, 2 in summer/);
  const withoutWinter = (texts) => {
    delete texts.seasons.winter;
    delete texts.hero.winter;
  };
  const single = changed(
    'site.json',
    (site) => {
      delete site.seasons.winter;
      delete site.seasons.summer.start;
    },
    'texts.de-AT.json',
    withoutWinter,
    'texts.en-GB.json',
    withoutWinter,
  );
  assert.throws(
    () => readContent(single),
    /zirbe\.json\n {2}pictures\.1\.season: a season site\.json does not list/,
  );
});

test('the notice may be left out, in every language', () => {
  const dir = bothTexts((texts) => delete texts.notice);
  assert.equal(readContent(dir).texts.de.notice, undefined);
});

test('a notice links within the site by a path from its root, elsewhere by https', () => {
  for (const href of ['/en/apartments/ahorn', 'https://example.com/a'])
    assert.ok(readContent(bothTexts((texts) => (texts.notice.link = { text: 'More', href }))));
  for (const href of [
    'en/apartments/ahorn',
    '//example.com/a',
    'http://example.com/a',
    'https://',
    'https:///a',
  ])
    assert.throws(
      () => readContent(bothTexts((texts) => (texts.notice.link = { text: 'More', href }))),
      /notice\.link\.href/,
    );
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

test('a content folder beyond a limit fails, and the message names the limit', () => {
  const cases = [
    [(site) => (site.name = 'x'.repeat(16)), /site\.json\n {2}name: at most 15 characters/],
    [(site) => (site.languages = ['de-AT', 'en-GB', 'it']), /languages: exactly two languages/],
    [(site) => (site.apartments = []), /apartments: at least one apartment/],
    [(site) => site.apartments.push('d', 'e'), /apartments: at most four apartments/],
    [
      (site) =>
        (site.map.places = Array.from({ length: 11 }, (_, i) => ({
          ...site.map.places[0],
          key: `p${i}`,
        }))),
      /map\.places: at most ten places/,
    ],
  ];
  for (const [change, message] of cases)
    assert.throws(() => readContent(changed('site.json', change)), message);
  assert.throws(
    () => readContent(changed('apartments/zirbe.json', (a) => (a.name = 'x'.repeat(21)))),
    /apartments\/zirbe\.json\n {2}name: at most 20 characters/,
  );
  const at = changed(
    'site.json',
    (site) => {
      site.name = 'x'.repeat(15);
      site.apartments.push('d');
    },
    'apartments/zirbe.json',
    (apartment) => (apartment.name = 'x'.repeat(20)),
    // d is a copy of zirbe, so it walks zirbe's routes.
    'map/routes.json',
    (routes) =>
      routes.features.push(
        ...routes.features
          .filter((f) => f.properties.apartment === 'zirbe')
          .map((f) => ({ ...f, properties: { ...f.properties, apartment: 'd' } })),
      ),
  );
  writeFileSync(
    join(at, 'apartments/d.json'),
    readFileSync('content/demo/apartments/zirbe.json', 'utf8'),
  );
  assert.equal(readContent(at).site.apartments.length, 4);
  // A letter with its accent as a code point of its own counts once.
  const accent = (count) => 'x'.repeat(count - 1) + 'e\u0301';
  const accents = changed(
    'site.json',
    (site) => (site.name = accent(15)),
    'apartments/zirbe.json',
    (apartment) => (apartment.name = accent(20)),
  );
  assert.equal(readContent(accents).site.name, accent(15));
  assert.throws(
    () => readContent(changed('site.json', (site) => (site.name = accent(16)))),
    /name: at most 15 characters/,
  );
});

test('each apartment is a file of its own, in the order site.json lists them', () => {
  const { slug, roomId, name } = readContent('content/demo').site.apartments[0];
  assert.deepEqual({ slug, roomId, name }, { slug: 'zirbe', roomId: 9001011, name: 'Zirbe' });
  assert.deepEqual(
    readContent('content/demo').site.apartments.map((a) => a.slug),
    ['zirbe', 'laerche', 'ahorn'],
  );
  const missing = changed('site.json', () => undefined);
  rmSync(join(missing, 'apartments/ahorn.json'));
  assert.throws(
    () => readContent(missing),
    /site\.json\n {2}apartments\.2: apartments\/ahorn\.json does not exist/,
  );
  assert.throws(
    () => readContent(changed('site.json', (site) => site.apartments.pop())),
    /apartments\/ahorn\.json\n {2}\(file\): not an apartment site\.json lists/,
  );
  assert.throws(
    () => readContent(changed('site.json', (site) => site.apartments.push('zirbe'))),
    /site\.json\n {2}apartments: an apartment slug is listed twice/,
  );
  assert.throws(
    () => readContent(changed('apartments/zirbe.json', (a) => (a.roomId = 'x'))),
    /apartments\/zirbe\.json\n {2}roomId/,
  );
  assert.throws(
    () => readContent(changed('apartments/zirbe.json', (a) => (a.slug = 'zirbe'))),
    /apartments\/zirbe\.json\n {2}\(file\): Unrecognized key/,
  );
});

test("a picture has its alternative text in exactly the site's languages", () => {
  const missing = changed('apartments/zirbe.json', (a) => delete a.pictures[1].alt['en-GB']);
  assert.throws(
    () => readContent(missing),
    /apartments\/zirbe\.json\n {2}pictures\.1\.alt\.en-GB: missing$/,
  );
  const extra = changed('apartments/zirbe.json', (a) => (a.pictures[0].alt['it'] = 'Foto'));
  assert.throws(
    () => readContent(extra),
    /pictures\.0\.alt\.it: a language site\.json does not list$/,
  );
  assert.throws(
    () => readContent(changed('apartments/zirbe.json', (a) => (a.pictures[0].alt['en-GB'] = ' '))),
    /apartments\/zirbe\.json\n {2}pictures\.0\.alt\.en-GB: empty or only spaces/,
  );
  assert.throws(
    () => readContent(changed('texts.en-GB.json', (texts) => (texts.nav.weeks = ''))),
    /texts\.en-GB\.json\n {2}nav\.weeks: empty or only spaces/,
  );
  assert.throws(
    () => readContent(changed('apartments/zirbe.json', (a) => (a.pictures = []))),
    /apartments\/zirbe\.json\n {2}pictures: at least one picture/,
  );
  assert.throws(
    () =>
      readContent(
        changed('apartments/zirbe.json', (a) => (a.pictures[0].file = 'http://example.com/a.png')),
      ),
    /pictures\.0\.file: not a file in pictures\/ or an https address/,
  );
});

test('the generated site gives each picture its files and its texts by address prefix', async () => {
  const out = mkdtempSync(join(root, 'generated-'));
  await writeContent('content/demo', out, cache);
  const site = readFileSync(join(out, 'site.ts'), 'utf8');
  const value = JSON.parse(site.slice(site.indexOf('= ') + 2, site.lastIndexOf(';\nexport')));
  const [first] = value.apartments[0].pictures;
  assert.deepEqual(Object.keys(first.alt), ['de', 'en']);
  // Generated: the page labels it.
  assert.equal(first.generated, true);
  assert.deepEqual([first.width, first.height], [1536, 1024]);
  assert.deepEqual(
    first.sources.map((s) => s.width),
    [480, 960, 1440, 1536],
  );
  assert.match(first.sources[0].url, /^\/pictures\/apartments\/zirbe-1-480\.[0-9a-f]{8}\.webp$/);
  assert.ok(existsSync(join(out, first.sources[0].url)));
  // A season's hero, with its credit, in its files and its portrait crop's.
  const { hero } = value.seasons.winter;
  assert.deepEqual(Object.keys(hero), ['credit', 'width', 'height', 'sources', 'portrait']);
  assert.match(hero.sources[0].url, /^\/pictures\/hero\/hero-winter-480\.[0-9a-f]{8}\.webp$/);
  assert.match(hero.portrait.sources[0].url, /^\/pictures\/hero\/hero-winter-portrait-480\./);
  assert.ok(existsSync(join(out, hero.portrait.sources[0].url)));
  // The sources are served only as their converted files.
  assert.ok(!existsSync(join(out, 'pictures', 'zirbe-1.webp')));
  assert.ok(!existsSync(join(out, 'pictures', 'hero-winter.webp')));
  assert.equal(await writeContent('content/demo', out, cache), 0);
  // A season's icon that is also its hero is still served as it is, for the tab.
  const shared = changed(
    'site.json',
    (site) => (site.seasons.winter.hero.file = site.seasons.winter.icon),
  );
  await writeContent(shared, out, cache);
  assert.ok(existsSync(join(out, 'pictures', 'icon-winter.svg')));
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
  assert.throws(
    () => readContent(dir),
    /site\.json\n {2}seasons: only winter and summer, one or both/,
  );
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

test('every season needs its icon, an SVG file that exists', () => {
  const icon = (value) => changed('site.json', (site) => (site.seasons.summer.icon = value));
  assert.throws(() => readContent(icon(undefined)), /seasons\.summer\.icon/);
  assert.throws(() => readContent(icon('pictures/hero-summer.webp')), /not an SVG file/);
  assert.throws(() => readContent(icon('pictures/gone.svg')), /pictures\/gone\.svg does not exist/);
  const dir = changed();
  cpSync(join(dir, 'pictures/hero-summer.webp'), join(dir, 'pictures/icon-summer.svg'));
  assert.throws(() => readContent(dir), /icon-summer\.svg is not an SVG document in UTF-8/);
  const svg = readFileSync(join(dir, 'pictures/icon-winter.svg'), 'utf8');
  for (const broken of [svg.slice(0, svg.indexOf('>') + 1), svg.replace('</g>', '')]) {
    writeFileSync(join(dir, 'pictures/icon-summer.svg'), broken);
    assert.throws(() => readContent(dir), /icon-summer\.svg is not an SVG document in UTF-8/);
  }
  // A stray byte in the licence comment, the rest intact.
  const at = svg.indexOf('Lucide');
  writeFileSync(
    join(dir, 'pictures/icon-summer.svg'),
    Buffer.concat([Buffer.from(svg.slice(0, at)), Buffer.from([0xff]), Buffer.from(svg.slice(at))]),
  );
  assert.throws(() => readContent(dir), /icon-summer\.svg is not an SVG document in UTF-8/);
  writeFileSync(join(dir, 'pictures/icon-summer.svg'), svg.replaceAll('"', "'"));
  readContent(dir);
  writeFileSync(
    join(dir, 'pictures/icon-summer.svg'),
    `<?xml version="1.0"?>\n<!-- A note -->\n${svg}`,
  );
  readContent(dir);
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

test('two names of one icon import it once', async () => {
  const dir = changed('site.json', (site) => {
    site.features[0].icon = 'heading-1';
    site.features[1].icon = 'heading1';
  });
  const out = mkdtempSync(join(root, 'generated-'));
  await writeContent(dir, out, cache);
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

test('an amenity names a Lucide icon, and its icon is imported', async () => {
  const wrong = changed('site.json', (site) => (site.amenities[2].icon = 'chalet'));
  assert.throws(
    () => readContent(wrong),
    /site\.json\n {2}amenities\.2\.icon: chalet is not a Lucide icon/,
  );
  const out = mkdtempSync(join(root, 'generated-'));
  await writeContent('content/demo', out, cache);
  assert.match(readFileSync(join(out, 'icons.ts'), 'utf8'), /lucideCookingPot/);
});

test('a code is listed once, in an area or alone', () => {
  const dir = changed('site.json', (site) => site.amenities[2].codes.push('PETS_NOT_ALLOWED'));
  assert.throws(() => readContent(dir), /site\.json\n {2}amenities: a code is listed twice/);
});

test('every language names exactly the areas the site lists, and labels each code', () => {
  const missing = changed('texts.en-GB.json', (texts) => delete texts.amenities.areas.kitchen);
  assert.throws(
    () => readContent(missing),
    /texts\.en-GB\.json\n {2}amenities\.areas\.kitchen: missing/,
  );
  const extra = bothTexts((texts) => (texts.amenities.areas.garden = 'x'));
  assert.throws(
    () => readContent(extra),
    /texts\.de-AT\.json\n {2}amenities\.areas\.garden: an area site\.json does not list/,
  );
  const unlabelled = bothTexts((texts) => delete texts.amenities.codes.WIFI);
  assert.throws(
    () => readContent(unlabelled),
    /texts\.de-AT\.json\n {2}amenities\.codes\.WIFI: missing/,
  );
  const none = changed('site.json', (site) => (site.amenities = []));
  assert.throws(
    () => readContent(none),
    /amenities\.areas\.general: an area site\.json does not list/,
  );
});

test('a room names a Lucide icon once, and every language names exactly the listed rooms', () => {
  const icon = changed('site.json', (site) => (site.rooms[0].icon = 'chalet'));
  assert.throws(
    () => readContent(icon),
    /site\.json\n {2}rooms\.0\.icon: chalet is not a Lucide icon/,
  );
  const twice = changed('site.json', (site) => site.rooms.push({ ...site.rooms[0] }));
  assert.throws(() => readContent(twice), /site\.json\n {2}rooms: a room code is listed twice/);
  const missing = changed('texts.de-AT.json', (texts) => delete texts.amenities.rooms.BATHROOM);
  assert.throws(
    () => readContent(missing),
    /texts\.de-AT\.json\n {2}amenities\.rooms\.BATHROOM: missing/,
  );
  const extra = bothTexts((texts) => (texts.amenities.rooms.KITCHEN = 'Küche'));
  assert.throws(
    () => readContent(extra),
    /texts\.de-AT\.json\n {2}amenities\.rooms\.KITCHEN: a room site\.json does not list/,
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

const withoutMap = (texts) => delete texts.map;
const noPoint = (apartment) => {
  delete apartment.lat;
  delete apartment.lon;
};

test('the map is optional, and without it no apartment has a point', () => {
  const edits = ['site.json', (site) => delete site.map, 'texts.de-AT.json', withoutMap];
  const withPoints = changed(...edits, 'texts.en-GB.json', withoutMap);
  assert.throws(() => readContent(withPoints), /zirbe\.json\n {2}lat, lon: no map in site\.json/);
  const apartments = ['zirbe', 'laerche', 'ahorn'].flatMap((slug) => [
    `apartments/${slug}.json`,
    noPoint,
  ]);
  const without = changed(...edits, 'texts.en-GB.json', withoutMap, ...apartments);
  assert.throws(
    () => readContent(without),
    /map\n {2}\(folder\): no map in site\.json; delete the folder/,
  );
  rmSync(join(without, 'map'), { recursive: true });
  assert.equal(readContent(without).site.map, undefined);
  const named = changed(...edits, ...apartments);
  rmSync(join(named, 'map'), { recursive: true });
  assert.throws(() => readContent(named), /texts\.en-GB\.json\n {2}map: no map in site\.json/);
});

test('with a map every apartment has its point inside the box', () => {
  const missing = changed('apartments/laerche.json', (apartment) => delete apartment.lon);
  assert.throws(() => readContent(missing), /laerche\.json\n {2}lat, lon: both needed with a map/);
  const outside = changed('apartments/laerche.json', (apartment) => (apartment.lat = 47.5));
  assert.throws(() => readContent(outside), /laerche\.json\n {2}lat, lon: outside the map's box/);
});

test('the box is at most 0.1° each way, and each place inside it', () => {
  const wide = changed('site.json', (site) => (site.map.box.east = 12.71));
  assert.throws(() => readContent(wide), /site\.json\n {2}map\.box: at most 0\.1° each way/);
  const turned = changed('site.json', (site) => (site.map.box.west = 12.68));
  assert.throws(() => readContent(turned), /map\.box: west and south below east and north/);
  const outside = changed('site.json', (site) => (site.map.places[1].lon = 12.7));
  assert.throws(() => readContent(outside), /site\.json\n {2}map\.places\.1: outside the box/);
  // Spans of exactly 0.1° in decimals pass; the tiles' grid ends at 85° and before 180° east.
  const box = (b) => siteSchema.shape.map.unwrap().shape.box.safeParse(b);
  assert.ok(box({ west: 12.6, south: 47.3, east: 12.7, north: 47.4 }).success);
  assert.ok(!box({ west: 12.6, south: 47.3, east: 12.7, north: 47.40001 }).success);
  assert.ok(!box({ west: 12.6, south: 85.95, east: 12.7, north: 86 }).success);
  assert.ok(!box({ west: 179.95, south: 47.3, east: 180, north: 47.4 }).success);
});

test('a place names a Lucide icon, and its icon is imported', async () => {
  const wrong = changed('site.json', (site) => (site.map.places[0].icon = 'gondola'));
  assert.throws(
    () => readContent(wrong),
    /site\.json\n {2}map\.places\.0\.icon: gondola is not a Lucide icon/,
  );
  const out = mkdtempSync(join(root, 'generated-'));
  await writeContent('content/demo', out, cache);
  assert.match(readFileSync(join(out, 'icons.ts'), 'utf8'), /lucideCableCar/);
});

test('every language names exactly the listed places, with texts for listed seasons only', () => {
  const missing = changed('texts.en-GB.json', (texts) => delete texts.map.places.kohlmais);
  assert.throws(
    () => readContent(missing),
    /texts\.en-GB\.json\n {2}map\.places\.kohlmais: missing/,
  );
  const extra = bothTexts((texts) => (texts.map.places.lake = { name: 'Lake' }));
  assert.throws(
    () => readContent(extra),
    /texts\.de-AT\.json\n {2}map\.places\.lake: a place site\.json does not list/,
  );
  const withoutWinter = (texts) => {
    delete texts.seasons.winter;
    delete texts.hero.winter;
  };
  const single = changed(
    'site.json',
    (site) => {
      delete site.seasons.winter;
      delete site.seasons.summer.start;
    },
    'texts.de-AT.json',
    withoutWinter,
    'texts.en-GB.json',
    withoutWinter,
    ...['zirbe', 'laerche', 'ahorn'].flatMap((slug) => [
      `apartments/${slug}.json`,
      (apartment) =>
        (apartment.pictures = apartment.pictures.filter(({ season }) => season !== 'winter')),
    ]),
  );
  assert.throws(
    () => readContent(single),
    /texts\.de-AT\.json\n {2}map\.places\.schattberg\.winter: a season site\.json does not list/,
  );
});

test('the tiles were cut for the box, and are there', () => {
  const moved = changed('site.json', (site) => (site.map.box.west = 12.601));
  assert.throws(
    () => readContent(moved),
    /map\/tiles\.json\n {2}box: cut for another box than site\.json's; run scripts\/map-tiles\.mjs/,
  );
  const gone = changed('site.json', () => undefined);
  const { build, count } = JSON.parse(readFileSync(join(gone, 'map', 'tiles.json'), 'utf8'));
  const column = join(gone, 'map', 'tiles', build, '15');
  const x = readdirSync(column)[0];
  rmSync(join(column, x, readdirSync(join(column, x))[0]));
  assert.throws(
    () => readContent(gone),
    new RegExp(
      `map/tiles/\\d+\\n  \\(folder\\): ${count - 1} of ${count} tiles; run scripts/map-tiles`,
    ),
  );
  rmSync(join(gone, 'map', 'tiles'), { recursive: true });
  assert.throws(() => readContent(gone), new RegExp(`\\(folder\\): 0 of ${count} tiles; run`));
  rmSync(join(gone, 'map', 'tiles.json'));
  assert.throws(() => readContent(gone), /map\/tiles\.json\n {2}\(file\): missing; run/);
});

test('one route for each apartment and place, from the points they have now', () => {
  const missing = changed('map/routes.json', (routes) => routes.features.pop());
  assert.throws(
    () => readContent(missing),
    /map\/routes\.json\n {2}ahorn to supermarket: missing; run scripts\/map-routes\.mjs/,
  );
  const moved = changed('apartments/zirbe.json', (apartment) => (apartment.lat += 0.0001));
  assert.throws(
    () => readContent(moved),
    /map\/routes\.json\n {2}zirbe to schattberg: computed before a point moved; run/,
  );
  const placeMoved = changed('site.json', (site) => (site.map.places[2].lon += 0.0001));
  assert.throws(() => readContent(placeMoved), /zirbe to tourist-office: computed before a point/);
  const withoutShop = (texts) => delete texts.map.places.supermarket;
  const fewer = changed(
    'site.json',
    (site) => site.map.places.pop(),
    'texts.de-AT.json',
    withoutShop,
    'texts.en-GB.json',
    withoutShop,
  );
  assert.throws(
    () => readContent(fewer),
    /map\/routes\.json\n {2}zirbe to supermarket: not a pair of the content; run/,
  );
});

test('the tiles are served by their build, and the site module names their address', async () => {
  const out = mkdtempSync(join(root, 'generated-'));
  await writeContent('content/demo', out, cache);
  const { build } = JSON.parse(readFileSync('content/demo/map/tiles.json', 'utf8'));
  assert.ok(existsSync(join(out, 'map', 'tiles', build, '15')));
  assert.match(
    readFileSync(join(out, 'site.ts'), 'utf8'),
    new RegExp(`"tiles": "/map/tiles/${build}"`),
  );
});
