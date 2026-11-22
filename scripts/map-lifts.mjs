// Takes the aerial lifts inside the map's box from OpenStreetMap through the Overpass API, and
// writes them to the content folder's map/lifts.json with the box they were taken for.
// node scripts/map-lifts.mjs
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { siteSchema } from '../src/content/schema.ts';

const dir = resolve(process.env.CONTENT_DIR || 'content/demo');
const site = siteSchema.parse(JSON.parse(readFileSync(join(dir, 'site.json'), 'utf8')));
if (!site.map) throw new Error(`${join(dir, 'site.json')} has no map`);
const { box } = site.map;

// Lifts that carry people up a slope; magic carpets, zip lines and goods lifts are left out.
const kinds = 'cable_car|gondola|mixed_lift|chair_lift|drag_lift|t-bar|j-bar|platter|rope_tow';
const bounds = [box.south, box.west, box.north, box.east].join(',');
const query = `[out:json][timeout:60];way["aerialway"~"^(${kinds})$"](${bounds});out tags geom;`;

let answer;
// A busy server answers 429 or 50x; it asks for a wait before the next try.
for (let attempt = 1; !answer; attempt++) {
  const response = await fetch('https://overpass-api.de/api/interpreter', {
    method: 'POST',
    headers: { 'User-Agent': 'beds24-direct-booking map lifts' },
    body: new URLSearchParams({ data: query }),
  });
  if (response.ok) answer = await response.json();
  else if (attempt === 3) throw new Error(`Overpass answered ${response.status}`);
  else await new Promise((done) => setTimeout(done, 15000));
}

const round = (value) => Math.round(value * 1e5) / 1e5;
const features = answer.elements
  .map(({ tags, geometry }) => ({
    type: 'Feature',
    properties: { kind: tags.aerialway, ...(tags.name && { name: tags.name }) },
    geometry: {
      type: 'LineString',
      coordinates: geometry.map(({ lon, lat }) => [round(lon), round(lat)]),
    },
  }))
  .sort((a, b) => (a.properties.name ?? '').localeCompare(b.properties.name ?? ''));
for (const { properties } of features)
  console.log(`${properties.kind}: ${properties.name ?? '(no name)'}`);
mkdirSync(join(dir, 'map'), { recursive: true });
writeFileSync(
  join(dir, 'map', 'lifts.json'),
  `${JSON.stringify({ type: 'FeatureCollection', box, features })}\n`,
);
