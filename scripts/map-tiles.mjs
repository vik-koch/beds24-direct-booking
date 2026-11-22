// Cuts the map's tiles, zoom 12 to 15 inside site.json's box, out of a Protomaps planet build into
// the content folder's map/tiles/<build>/, and notes the build, the box and the count in
// map/tiles.json. The old tiles stay until every new one has arrived.
// node scripts/map-tiles.mjs [build, such as 20261122; the latest by default]
import { mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { FetchSource, PMTiles } from 'pmtiles';
import { siteSchema } from '../src/content/schema.ts';

const dir = resolve(process.env.CONTENT_DIR || 'content/demo');
const { map } = siteSchema.parse(JSON.parse(readFileSync(join(dir, 'site.json'), 'utf8')));
if (!map) throw new Error(`${join(dir, 'site.json')} has no map`);
const build =
  process.argv[2] ??
  (await (await fetch('https://build-metadata.protomaps.dev/builds.json')).json())
    .at(-1)
    .key.replace('.pmtiles', '');
const archive = new PMTiles(new FetchSource(`https://build.protomaps.com/${build}.pmtiles`));

const column = (lon, z) => Math.floor(((lon + 180) / 360) * 2 ** z);
const row = (lat, z) => {
  const r = (lat * Math.PI) / 180;
  return Math.floor(((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * 2 ** z);
};

const out = join(dir, 'map', 'tiles');
const next = join(dir, 'map', 'tiles-next');
rmSync(next, { recursive: true, force: true });
let [count, bytes] = [0, 0];
for (let z = 12; z <= 15; z++) {
  const jobs = [];
  for (let x = column(map.box.west, z); x <= column(map.box.east, z); x++)
    for (let y = row(map.box.north, z); y <= row(map.box.south, z); y++)
      jobs.push(
        archive.getZxy(z, x, y).then((tile) => {
          if (!tile) return;
          mkdirSync(join(next, build, `${z}`, `${x}`), { recursive: true });
          writeFileSync(join(next, build, `${z}`, `${x}`, `${y}.mvt`), new Uint8Array(tile.data));
          count++;
          bytes += tile.data.byteLength;
        }),
      );
  await Promise.all(jobs);
}
rmSync(out, { recursive: true, force: true });
renameSync(next, out);
writeFileSync(
  join(dir, 'map', 'tiles.json'),
  `${JSON.stringify({ build, box: map.box, count })}\n`,
);
console.log(`${count} tiles of build ${build}, ${Math.round(bytes / 1000)} kB, in ${out}`);
