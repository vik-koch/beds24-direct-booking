import { readdirSync, readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';

test(
  "the map's tiles are served by their build, as vector tiles",
  { tag: '@any-engine' },
  async ({ request }) => {
    const { build } = JSON.parse(readFileSync('content/demo/map/tiles.json', 'utf8'));
    const column = readdirSync(`content/demo/map/tiles/${build}/15`)[0];
    const [file] = readdirSync(`content/demo/map/tiles/${build}/15/${column}`);
    const response = await request.get(`/map/tiles/${build}/15/${column}/${file}`);
    expect(response.status()).toBe(200);
    expect(response.headers()['content-type']).toBe('application/vnd.mapbox-vector-tile');
  },
);
