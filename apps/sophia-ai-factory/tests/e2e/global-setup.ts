/**
 * Global setup for Playwright tests.
 * Runs once before all tests start.
 */

import { mkdirSync, existsSync } from 'fs';
import { join } from 'path';

// Create test output directories
const testResultsDir = join(process.cwd(), 'test-results');
const screenshotsDir = join(process.cwd(), 'test-results', 'screenshots');
const videosDir = join(process.cwd(), 'test-results', 'videos');

function ensureDir(dir: string) {
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
}

export default async () => {
  console.log('🧪 Setting up Playwright E2E environment...');

  ensureDir(testResultsDir);
  ensureDir(screenshotsDir);
  ensureDir(videosDir);

  // Validate required environment variables
  const baseUrl = process.env.PLAYWRIGHT_TEST_BASE_URL || 'http://localhost:3000';
  console.log(`📍 Test base URL: ${baseUrl}`);

  // Check if we're running against a remote URL or need local server
  const isRemote = baseUrl.startsWith('https://');
  if (!isRemote) {
    console.log('🌐 Will start local dev server via webServer config');
  }

  // Warn about missing test user credentials
  const hasTestUser = !!process.env.E2E_TEST_USER_PASSWORD;
  if (!hasTestUser) {
    console.warn('⚠️  E2E_TEST_USER_PASSWORD not set — auth-dependent tests will be skipped');
    console.warn('   Run: npm run e2e:bootstrap-user to create a test user');
  }

  console.log('✅ Global setup complete');
};
