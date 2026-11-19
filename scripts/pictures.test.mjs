import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import sharp from 'sharp';
import { convertPictures } from './pictures.mjs';

const temp = (name) => mkdtempSync(join(tmpdir(), `${name}-`));
const png = (width, height, orientation) => {
  const picture = sharp({ create: { width, height, channels: 3, background: '#789' } });
  return (orientation ? picture.withMetadata({ orientation }) : picture).png().toBuffer();
};

// A content folder with the given files in pictures/, and one apartment that lists them.
async function folder(files) {
  const dir = temp('content');
  mkdirSync(join(dir, 'pictures'));
  for (const [name, bytes] of Object.entries(files))
    writeFileSync(join(dir, 'pictures', name), await bytes);
  return dir;
}
const listing = (...files) => [
  { slug: 'one', pictures: files.map((file) => ({ file, alt: { en: file } })) },
];
const convert = (dir, apartments, cache = temp('cache')) =>
  convertPictures(dir, apartments, temp('out'), cache);

test('square to 2:1 is converted, in the widths up to the source, none wider', async () => {
  const dir = await folder({
    'square.png': png(1000, 1000),
    'four-three.png': png(2000, 1500),
    'three-two.png': png(1100, 733),
    'two-one.png': png(300, 150),
  });
  const files = ['square.png', 'four-three.png', 'three-two.png', 'two-one.png'];
  const { pictures } = await convert(dir, listing(...files.map((f) => `pictures/${f}`)));
  assert.deepEqual(
    pictures.one.map(({ width, height, sources }) => [width, height, sources.map((s) => s.width)]),
    [
      [1000, 1000, [480, 960, 1000]],
      [1920, 1440, [480, 960, 1440, 1920]],
      [1100, 733, [480, 960, 1100]],
      [300, 150, [300]],
    ],
  );
  assert.deepEqual(pictures.one[0].alt, { en: 'pictures/square.png' });
});

test('a portrait picture or one wider than 2:1 stops the build, naming it', async () => {
  const dir = await folder({ 'tall.png': png(600, 800), 'wide.png': png(1100, 500) });
  await assert.rejects(
    convert(dir, listing('pictures/tall.png')),
    /apartments\/one\.json\n {2}pictures\.0: pictures\/tall\.png is 600 × 800, not between square and 2:1/,
  );
  await assert.rejects(convert(dir, listing('pictures/wide.png')), /is 1100 × 500, not between/);
});

test('a crop 1% off square or off 2:1 still counts, and one pixel more does not', async () => {
  const dir = await folder({
    'square.png': png(99, 100),
    'not-square.png': png(98, 100),
    'two-one.png': png(202, 100),
    'too-wide.png': png(203, 100),
  });
  const { pictures } = await convert(dir, listing('pictures/square.png', 'pictures/two-one.png'));
  assert.equal(pictures.one.length, 2);
  await assert.rejects(convert(dir, listing('pictures/not-square.png')), /is 98 × 100/);
  await assert.rejects(convert(dir, listing('pictures/too-wide.png')), /is 203 × 100/);
});

test('a picture is measured as the camera meant it to be shown', async () => {
  // Stored landscape, shown portrait: orientation 6 turns it by 90 degrees.
  const dir = await folder({ 'turned.png': png(800, 600, 6) });
  await assert.rejects(convert(dir, listing('pictures/turned.png')), /is 600 × 800/);
});

test('a missing file or one that is not a picture stops the build, naming it', async () => {
  const dir = await folder({ 'text.png': 'not a picture' });
  await assert.rejects(
    convert(dir, listing('pictures/gone.png')),
    /pictures\.0: pictures\/gone\.png does not exist/,
  );
  await assert.rejects(
    convert(dir, listing('pictures/text.png')),
    /pictures\.0: pictures\/text\.png is not a picture/,
  );
});

test('a picture whose pixels are damaged stops the build, naming it', async () => {
  const noise = Buffer.from(Array.from({ length: 600 * 450 * 3 }, () => (Math.random() * 256) | 0));
  const whole = await sharp(noise, { raw: { width: 600, height: 450, channels: 3 } })
    .png()
    .toBuffer();
  // The header and the size are intact; the pixels stop half way.
  const dir = await folder({ 'cut.png': whole.subarray(0, whole.length / 2) });
  await assert.rejects(
    convert(dir, listing('pictures/cut.png')),
    /apartments\/one\.json\n {2}pictures\.0: pictures\/cut\.png cannot be converted: /,
  );
});

test('a damaged download is not kept, so the next run fetches the address again', async () => {
  let answer = Buffer.from('broken');
  const server = createServer((req, res) =>
    res.writeHead(200, { 'content-type': 'image/png' }).end(answer),
  ).listen(0);
  const address = `http://localhost:${server.address().port}/01.png`;
  const cache = temp('cache');
  try {
    await assert.rejects(convert(temp('content'), listing(address), cache), /is not a picture/);
    answer = await png(800, 600);
    const { pictures } = await convert(temp('content'), listing(address), cache);
    assert.equal(pictures.one[0].width, 800);
  } finally {
    server.close();
  }
});

test('an address is fetched once, and one that does not answer with a picture stops the build', async () => {
  const picture = await png(800, 600);
  const server = createServer((req, res) => {
    if (req.url === '/01.png') res.writeHead(200, { 'content-type': 'image/png' }).end(picture);
    else if (req.url === '/page.png')
      res.writeHead(200, { 'content-type': 'text/html' }).end('<p>');
    else res.writeHead(404, { 'content-type': 'text/html' }).end('Not found');
  }).listen(0);
  const at = `http://localhost:${server.address().port}`;
  const dir = temp('content');
  const cache = temp('cache');
  try {
    await assert.rejects(
      convert(dir, listing(`${at}/02.png`)),
      new RegExp(`pictures\\.0: ${at}/02\\.png answered 404 text/html, not a picture`),
    );
    await assert.rejects(convert(dir, listing(`${at}/page.png`)), /answered 200 text\/html/);
    const first = await convert(dir, listing(`${at}/01.png`), cache);
    assert.equal(first.converted, 2);
  } finally {
    server.close();
  }
  // The server is gone: the second run takes the download and the files from the cache.
  const again = await convert(dir, listing(`${at}/01.png`), cache);
  assert.equal(again.converted, 0);
  assert.deepEqual(
    again.pictures.one[0].sources.map((s) => s.width),
    [480, 800],
  );
});

test('a file is named by its apartment, place, width and content', async () => {
  const dir = await folder({ 'a.png': png(500, 500), 'b.png': png(500, 400) });
  const out = temp('out');
  const { pictures } = await convertPictures(
    dir,
    listing('pictures/a.png', 'pictures/b.png'),
    out,
    temp('cache'),
  );
  const urls = pictures.one.flatMap(({ sources }) => sources.map((s) => s.url));
  assert.equal(urls.length, 4);
  // The name carries the served file's own digest, so a new encoding gets a new address.
  for (const url of urls) {
    assert.match(url, /^\/pictures\/apartments\/one-[12]-\d+\.[0-9a-f]{8}\.webp$/);
    const name = url.split('/').at(-1);
    const hash = createHash('sha256')
      .update(readFileSync(join(out, name)))
      .digest('hex');
    assert.equal(name.split('.').at(-2), hash.slice(0, 8));
  }
  assert.deepEqual(readdirSync(out).sort(), urls.map((url) => url.split('/').at(-1)).sort());
});
