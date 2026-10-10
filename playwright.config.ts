import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: 'tests/e2e',
  fullyParallel: true,
  retries: 0,
  use: { baseURL: 'http://localhost:5182', trace: 'on-first-retry' },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1536, height: 960 } } },
    { name: 'phone', use: { ...devices['Pixel 5'] } },
  ],
  webServer: { command: 'npm run dev', url: 'http://localhost:5182', reuseExistingServer: true },
});
