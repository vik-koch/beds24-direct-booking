import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: 'e2e',
  forbidOnly: !!process.env['CI'],
  reporter: process.env['CI'] ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: { baseURL: 'http://localhost:4000' },
  // Angular's server answers only for hosts it was told about; a deployment sets its own.
  webServer: {
    command: 'npm run serve',
    url: 'http://localhost:4000',
    env: { NG_ALLOWED_HOSTS: 'localhost' },
    reuseExistingServer: !process.env['CI'],
  },
  projects: [
    { name: 'chromium', use: devices['Desktop Chrome'] },
    { name: 'webkit-phone', use: devices['iPhone 15'] },
    { name: 'firefox', use: devices['Desktop Firefox'] },
  ],
});
