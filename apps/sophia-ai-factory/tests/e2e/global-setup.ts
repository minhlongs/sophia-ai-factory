/**
 * Global setup for Playwright tests.
 * Runs once before all tests start.
 *
 * Responsibilities:
 * 1. Create test output directories (screenshots, videos).
 * 2. Bootstrap local D1 database with missing migrations.
 * 3. Validate environment and report test target.
 *
 * NOTE: This file runs in a raw Node.js context (not the app runtime).
 * The project's no-console rule does not apply here; console output is
 * the primary feedback channel for test bootstrap and operator debugging.
 */

import { execSync } from 'child_process';
import { mkdirSync, existsSync, statSync } from 'fs';
import { join } from 'path';

// ── Local D1 resolution (mirrors tests/e2e/fixtures/free100-db-helpers.ts) ───
import { getLocalD1Path } from './fixtures/free100-db-helpers';

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

  // Verify local D1 SQLite exists — warn if missing so tests don't fail cryptically
  if (!isRemote) {
    try {
      const d1Path = getLocalD1Path();
      console.log(`✅ Local D1 found at: ${d1Path}`);
    } catch (err) {
      console.warn('⚠️ Local D1 not found — run `npm run dev` once to bootstrap.');
      console.warn('   Some E2E tests may fail without an initialized D1 database.');
      if (err instanceof Error) console.warn(`   ${err.message}`);
    }
  }

  // Bootstrap local D1 with missing migrations for mock D1 mode
  if (process.env.NEXT_PUBLIC_MOCK_D1 === 'true') {
    try {
      console.log('🗄️  Bootstrapping local D1 database...');
      const bootstrapScript = join(process.cwd(), 'scripts', 'e2e-bootstrap-d1.sh');
      if (!existsSync(bootstrapScript)) {
        console.warn(`⚠️ Bootstrap script not found at ${bootstrapScript}`);
        console.warn(' Run `npm run dev` once or create the script to enable D1 bootstrap.');
      } else {
        execSync(`bash "${bootstrapScript}"`, { stdio: 'pipe', timeout: 120_000 });
        console.log('✅ Local D1 bootstrap complete');
      }
    } catch (err) {
      console.warn('⚠️  D1 bootstrap skipped or failed — tests may have missing tables');
      if (err instanceof Error) console.warn(`   ${err.message}`);
    }
  }

  // Validate mock AI services flag — required for E2E to avoid real API calls
  if (!isRemote && process.env.NEXT_PUBLIC_MOCK_AI_SERVICES !== 'true') {
    console.warn('⚠️ NEXT_PUBLIC_MOCK_AI_SERVICES not set to "true".');
    console.warn('   E2E tests may attempt real AI API calls and fail.');
    console.warn('   Add NEXT_PUBLIC_MOCK_AI_SERVICES=true to .env.local');
  }

  // Warn about missing test user credentials
  const hasTestUser = !!process.env.E2E_TEST_USER_PASSWORD;
  if (!hasTestUser) {
    console.warn('⚠️  E2E_TEST_USER_PASSWORD not set — auth-dependent tests will be skipped');
    console.warn('   Run: npm run e2e:bootstrap-user to create a test user');
  }

  console.log('✅ Global setup complete');
};
