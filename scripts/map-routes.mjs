// Computes the walking route to every place of site.json's map and of a content page's map from
// each apartment it walks from, through the points the place gives for that apartment, with
// Valhalla's pedestrian costing on valhalla1.openstreetmap.de, and writes them to the content
// folder's map/routes.json.
// node scripts/map-routes.mjs
import { mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { apartmentSchema, siteSchema } from '../src/content/schema.ts';
import { checkPoints, readJson, readMaps, walks } from './content.mjs';

const dir = resolve(process.env.CONTENT_DIR || 'content/demo');
const site = readJson(dir, 'site.json', siteSchema);
if (!site.map) throw new Error(`${join(dir, 'site.json')} has no map`);

const apartments = site.apartments.map((slug) => ({
  slug,
  ...readJson(dir, `apartments/${slug}.json`, apartmentSchema),
}));
checkPoints(dir, site, apartments);

// Valhalla's encoded polyline: six decimals, latitude first.
const decode = (shape) => {
  const coordinates = [];
  let index = 0;
  const next = () => {
    let result = 0;
    let shift = 0;
    let byte;
    do {
      byte = shape.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);
    return result & 1 ? ~(result >> 1) : result >> 1;
  };
  let lat = 0;
  let lon = 0;
  while (index < shape.length) {
    lat += next();
    lon += next();
    coordinates.push([lon / 1e6, lat / 1e6]);
  }
  return coordinates;
};

const features = [];
for (const { page, apartment, place, via } of walks(apartments, readMaps(dir, site, apartments))) {
  const { slug, lat, lon } = apartment;
  const pair = `${page ? `${page}: ` : ''}${slug} to ${place.key}`;
  const locations = [
    { lat, lon, type: 'break' },
    ...via.map((point) => ({ ...point, type: 'through' })),
    { lat: place.lat, lon: place.lon, type: 'break' },
  ];
  const response = await fetch('https://valhalla1.openstreetmap.de/route', {
    method: 'POST',
    headers: {
      'User-Agent': 'beds24-direct-booking map routes',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ locations, costing: 'pedestrian', directions_type: 'none' }),
  });
  if (!response.ok) throw new Error(`${pair}: the router answered ${response.status}`);
  const { summary, legs } = (await response.json()).trip;
  features.push({
    type: 'Feature',
    properties: {
      ...(page && { page }),
      apartment: slug,
      place: place.key,
      meters: Math.round(summary.length * 100) * 10,
      minutes: Math.ceil(summary.time / 60),
      from: { lat, lon },
      to: { lat: place.lat, lon: place.lon },
      ...(via.length > 0 && { via }),
    },
    geometry: { type: 'LineString', coordinates: decode(legs[0].shape) },
  });
  console.log(`${pair}: ${Math.round(summary.length * 1000)} m`);
  // The router allows one request a second.
  await new Promise((done) => setTimeout(done, 1000));
}
mkdirSync(join(dir, 'map'), { recursive: true });
writeFileSync(
  join(dir, 'map', 'routes.json'),
  `${JSON.stringify({ type: 'FeatureCollection', features })}\n`,
);
