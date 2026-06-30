import { defineConfig, devices } from '@playwright/test';

const BASE_URL = process.env.PLAYWRIGHT_TEST_BASE_URL || 'http://localhost:3000';
const isRemote = BASE_URL.startsWith('https://');

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : isRemote ? 1 : 0,
  workers: process.env.CI ? 1 : isRemote ? 4 : undefined,
  reporter: [
    ['html', { open: 'never' }],
    ['list'],
    ['junit', { outputFile: 'test-results/e2e-results.xml' }],
  ],
  use: {
    baseURL: BASE_URL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    viewport: { width: 1280, height: 720 },
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'mobile-chrome',
      use: { ...devices['Pixel 7'] },
    },
  ],
  webServer: isRemote
    ? undefined
    : {
        command: process.env.E2E_PREBUILT === '1'
          ? 'npx wrangler dev --local --port 3000'
          : 'bash -c "export $(grep -v \'^\' .env.local | xargs) && npm run build && node scripts/fix-instrumentation-standalone.mjs && npx @opennextjs/cloudflare build --skipNextBuild && npx wrangler dev --local --port 3000"',
        url: BASE_URL,
        reuseExistingServer: !process.env.CI,
        timeout: process.env.E2E_PREBUILT === '1' ? 60 * 1000 : 300 * 1000,
      },
  globalSetup: './tests/e2e/global-setup.ts',
});
