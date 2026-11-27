import { defineConfig, devices } from '@playwright/test';

const reuse = { reuseExistingServer: !process.env['CI'] };
const app = (token: string, sim = 4300) => ({
  NG_ALLOWED_HOSTS: 'localhost',
  BEDS24_URL: `http://localhost:${sim}/v2`,
  BEDS24_REFRESH_TOKEN: token,
});
const today = new Date().toISOString().slice(0, 10);

export default defineConfig({
  testDir: 'e2e',
  // Each test stands alone, so the suite's shards split by test rather than by file.
  fullyParallel: true,
  forbidOnly: !!process.env['CI'],
  reporter: process.env['CI'] ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: { baseURL: 'http://localhost:4000', trace: 'retain-on-failure' },
  // Angular's server answers only for hosts it was told about; a deployment sets its own.
  webServer: [
    { command: 'npm run sim', url: 'http://localhost:4300/v2/properties', ...reuse },
    { command: 'npm run serve', url: 'http://localhost:4000', env: app('simulator'), ...reuse },
    // A second instance whose refresh token the simulator refuses; its pages answer 503.
    {
      command: 'npm run serve',
      url: 'http://localhost:4001/pictures/icon-winter.svg',
      env: { ...app('refused'), PORT: '4001' },
      ...reuse,
    },
    // A Beds24 whose owner has set no prices from today on, and a site that asks it.
    {
      command: 'npm run sim',
      url: 'http://localhost:4301/v2/properties',
      env: { PORT: '4301', SIM_PRICES_UNTIL: today },
      ...reuse,
    },
    {
      command: 'npm run serve',
      url: 'http://localhost:4003/pictures/icon-winter.svg',
      env: { ...app('simulator', 4301), PORT: '4003' },
      ...reuse,
    },
    // A site under test, closed with a password; Playwright counts its 401 as ready.
    {
      command: 'npm run serve',
      url: 'http://localhost:4004/en',
      env: { ...app('simulator'), PORT: '4004', SITE_PASSWORD: 'under test' },
      ...reuse,
    },
    // A second site, built from other content: two other languages, no notice, its own theme.
    {
      command:
        'CONTENT_DIR=e2e/content npm run content && ng build --output-path dist/other && npm run content && node dist/other/server/server.mjs',
      url: 'http://localhost:4002/pictures/icon.svg',
      env: { ...app('simulator'), PORT: '4002' },
      timeout: 180_000,
      ...reuse,
    },
  ],
  projects: [
    { name: 'chromium', use: devices['Desktop Chrome'] },
    { name: 'webkit-phone', use: devices['iPhone 15'], grepInvert: /@any-engine/ },
    { name: 'firefox', use: devices['Desktop Firefox'] },
  ],
});
