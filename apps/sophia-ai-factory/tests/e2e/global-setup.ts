/**
 * Global setup for Playwright tests.
 * Runs once before all tests start.
 *
 * Responsibilities:
 * 1. Create test output directories (screenshots, videos).
 * 2. Bootstrap local D1 database with missing migrations.
 * 3. Validate environment and report test target.
 */

import { execSync } from 'child_process';
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

  // Bootstrap local D1 with missing migrations for mock D1 mode
  if (process.env.NEXT_PUBLIC_MOCK_D1 === 'true') {
    try {
      console.log('🗄️  Bootstrapping local D1 database...');
      const bootstrapScript = join(process.cwd(), 'scripts', 'e2e-bootstrap-d1.sh');
      execSync(`bash "${bootstrapScript}"`, { stdio: 'pipe', timeout: 120_000 });
      console.log('✅ Local D1 bootstrap complete');
    } catch (err) {
      console.warn('⚠️  D1 bootstrap skipped or failed — tests may have missing tables');
      if (err instanceof Error) console.warn(`   ${err.message}`);
    }
  }

  // Warn about missing test user credentials
  const hasTestUser = !!process.env.E2E_TEST_USER_PASSWORD;
  if (!hasTestUser) {
    console.warn('⚠️  E2E_TEST_USER_PASSWORD not set — auth-dependent tests will be skipped');
    console.warn('   Run: npm run e2e:bootstrap-user to create a test user');
  }

  console.log('✅ Global setup complete');
};
