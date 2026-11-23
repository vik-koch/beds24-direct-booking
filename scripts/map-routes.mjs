// Computes the walking route from every apartment to every place of the map, through the points the
// apartment gives for it, with OSRM's foot profile on routing.openstreetmap.de, and writes them to
// the content folder's map/routes.json.
// node scripts/map-routes.mjs
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { apartmentSchema, siteSchema } from '../src/content/schema.ts';

const dir = resolve(process.env.CONTENT_DIR || 'content/demo');
const read = (file, schema) => schema.parse(JSON.parse(readFileSync(join(dir, file), 'utf8')));
const site = read('site.json', siteSchema);
if (!site.map) throw new Error(`${join(dir, 'site.json')} has no map`);

const features = [];
for (const slug of site.apartments) {
  const { lat, lon, via = {} } = read(`apartments/${slug}.json`, apartmentSchema);
  if (lat === undefined || lon === undefined)
    throw new Error(`apartments/${slug}.json has no point`);
  for (const place of site.map.places) {
    const points = [{ lat, lon }, ...(via[place.key] ?? []), place];
    const path = points.map((point) => `${point.lon},${point.lat}`).join(';');
    const response = await fetch(
      `https://routing.openstreetmap.de/routed-foot/route/v1/foot/${path}?overview=full&geometries=geojson`,
      { headers: { 'User-Agent': 'beds24-direct-booking map routes' } },
    );
    if (!response.ok)
      throw new Error(`${slug} to ${place.key}: the router answered ${response.status}`);
    const [route] = (await response.json()).routes;
    features.push({
      type: 'Feature',
      properties: {
        apartment: slug,
        place: place.key,
        meters: Math.round(route.distance / 10) * 10,
        minutes: Math.ceil(route.duration / 60),
        from: { lat, lon },
        to: { lat: place.lat, lon: place.lon },
        ...(via[place.key] && { via: via[place.key] }),
      },
      geometry: route.geometry,
    });
    console.log(`${slug} to ${place.key}: ${Math.round(route.distance)} m`);
    // The router allows one request a second.
    await new Promise((done) => setTimeout(done, 1000));
  }
}
mkdirSync(join(dir, 'map'), { recursive: true });
writeFileSync(
  join(dir, 'map', 'routes.json'),
  `${JSON.stringify({ type: 'FeatureCollection', features })}\n`,
);
