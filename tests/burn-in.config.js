// @ts-check
const { defineConfig, devices } = require('@playwright/test');

/**
 * Burn-in config: 0 retries, 25 iterations, both viewports.
 * Every failure is real. Screenshots + traces on every failure.
 */
module.exports = defineConfig({
  testDir: '.',
  testMatch: 'burn-in.spec.js',
  timeout: 60000,
  retries: 0,
  repeatEach: 25,
  reporter: [
    ['list'],
    ['json', { outputFile: 'burn-in-results.json' }],
  ],

  use: {
    baseURL: 'http://localhost:8000',
    trace: 'on',
    screenshot: 'on',
    video: 'off',
  },

  projects: [
    {
      name: 'desktop',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'iphone',
      use: { ...devices['iPhone 14'] },
    },
  ],

  webServer: {
    command: 'python3 -m http.server 8000 --directory ..',
    port: 8000,
    reuseExistingServer: true,
  },
});
