import { defineConfig, devices } from '@playwright/test';

const reuse = { reuseExistingServer: !process.env['CI'] };
const app = (token: string) => ({
  NG_ALLOWED_HOSTS: 'localhost',
  BEDS24_URL: 'http://localhost:4300/v2',
  BEDS24_TOKEN: token,
});

export default defineConfig({
  testDir: 'e2e',
  forbidOnly: !!process.env['CI'],
  reporter: process.env['CI'] ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: { baseURL: 'http://localhost:4000' },
  // Angular's server answers only for hosts it was told about; a deployment sets its own.
  webServer: [
    { command: 'npm run sim', url: 'http://localhost:4300/v2/properties', ...reuse },
    { command: 'npm run serve', url: 'http://localhost:4000', env: app('simulator'), ...reuse },
    // A second instance whose token the simulator refuses; its pages answer 503.
    {
      command: 'npm run serve',
      url: 'http://localhost:4001/favicon.ico',
      env: { ...app('refused'), PORT: '4001' },
      ...reuse,
    },
  ],
  projects: [
    { name: 'chromium', use: devices['Desktop Chrome'] },
    { name: 'webkit-phone', use: devices['iPhone 15'] },
    { name: 'firefox', use: devices['Desktop Firefox'] },
  ],
});
