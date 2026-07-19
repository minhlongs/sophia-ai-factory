/**
 * critical-paths.spec.ts — Post-deploy smoke suite (3 tests, tagged @smoke)
 *
 * Intentionally unauthenticated. Run against localhost OR prod via
 * PLAYWRIGHT_TEST_BASE_URL env var. Gracefully skips if URL unreachable.
 *
 * Usage:
 *   npx playwright test --grep "@smoke"
 *   PLAYWRIGHT_TEST_BASE_URL=https://sophia.agencyos.network npx playwright test --grep "@smoke"
 */

import { test, expect } from '@playwright/test';

// Graceful skip when base URL is unreachable (pre-deploy local or cold CI).
test.beforeAll(async ({ request }) => {
  try {
    const res = await request.get('/');
    // If we get any response (even 4xx), the server is reachable — proceed.
    void res;
  } catch {
    test.skip(true, 'Base URL unreachable — skipping smoke suite');
  }
});

test('@smoke public home loads with HTTP 200', async ({ page }) => {
  const response = await page.goto('/');
  expect(response?.ok(), 'Expected HTTP 2xx for /').toBe(true);
  // Confirm the page rendered something (not empty body)
  await expect(page.locator('body')).not.toBeEmpty();
});

test('@smoke /api/version returns valid JSON with shortSha', async ({ request }) => {
  const res = await request.get('/api/version');
  expect(res.ok()).toBe(true);

  const body = await res.json() as Record<string, unknown>;
  expect(typeof body.shortSha).toBe('string');
  expect((body.shortSha as string).length).toBeGreaterThanOrEqual(7);

  // If SOPHIA_EXPECTED_SHA is set (post-deploy hook), verify exact match.
  const expected = process.env.SOPHIA_EXPECTED_SHA;
  if (expected) {
    expect(body.shortSha).toBe(expected);
  }
});

test('@smoke /dashboard redirects unauthenticated user away from /dashboard', async ({ page }) => {
  const res = await page.goto('/dashboard');
  const finalUrl = page.url();
  // Sophia uses next-intl locale prefix (/{en,vi}/...) — accept any login-ish path
  // OR any redirect chain OR any non-dashboard landing.
  const loggedOut = /\/(login|sign-in|signin|auth)(\/|$|\?)/.test(finalUrl);
  const redirected = res?.status() !== undefined && res.status() >= 300;
  const offDashboard = !finalUrl.replace(/\?.*$/, '').endsWith('/dashboard');
  expect(
    loggedOut || redirected || offDashboard,
    `Expected unauthenticated user to be redirected away from /dashboard. Final URL: ${finalUrl} (HTTP ${res?.status()})`,
  ).toBe(true);
});
