import { defineConfig, devices } from '@playwright/test';

const BASE_URL = process.env.PLAYWRIGHT_TEST_BASE_URL || 'http://localhost:3000';
const isRemote = BASE_URL.startsWith('https://');

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  // retries: remote dev runs get 1 retry to absorb genuine network jitter,
  // not to mask worker-saturation flake (that is fixed via `workers` cap below).
  retries: process.env.CI ? 2 : isRemote ? 1 : 0,
  // Cap workers at 4 when targeting a remote URL.
  // Reason: on a Mac dev machine, the Playwright worker pool defaults to ~cpus/2.
  // At >=8 parallel workers, simultaneous worker+browser bootup on macOS
  // exceeds the 30s per-test timeout before the first API call even starts —
  // causing 8/18 tests in api-endpoints.spec.ts + oauth-link-flow.spec.ts to
  // flake against production. 4 workers proved stable across 5 consecutive runs.
  workers: process.env.CI ? 1 : isRemote ? 4 : undefined,
  reporter: [['html', { open: 'never' }], ['list']],
  use: {
    baseURL: BASE_URL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: isRemote
    ? undefined
    : {
        command: 'npm run dev',
        url: BASE_URL,
        reuseExistingServer: !process.env.CI,
        timeout: 120 * 1000,
      },
});
