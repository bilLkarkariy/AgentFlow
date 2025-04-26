import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  // Include .e2e.ts files in test discovery
  testMatch: ['**/*.e2e.ts', '**/?(*.)+(spec|test).[jt]s?(x)'],
  timeout: 30 * 1000,
  expect: { timeout: 5000 },
  fullyParallel: true,
  retries: process.env.CI ? 2 : 0,
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:5174',
    trace: 'on-first-retry',
  },
  // Only start Vite dev server for front-end E2E
  webServer: [
    {
      command: 'pnpm run dev',
      port: 5174,
      reuseExistingServer: !process.env.CI,
    },
  ],
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox',  use: { ...devices['Desktop Firefox'] } },
    { name: 'webkit',   use: { ...devices['Desktop Safari'] } },
  ],
});
