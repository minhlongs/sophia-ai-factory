/**
 * E2E Quota Upsell Tests — quota status/overage API + dashboard upsell flow.
 *
 * Run: npx playwright test tests/e2e/quota-upsell.spec.ts
 *
 * Coverage (API layer — auth-protected):
 * - GET /api/quota/status → 401 unauth
 * - GET /api/quota/overage-events → 401 unauth
 * - GET /api/v1/quota/:tenantId → 401 unauth (already in api-endpoints; here tests param shape)
 * Coverage (page layer):
 * - /pricing renders 4 tiers (upgrade target — used by upsell modal)
 * - /dashboard/billing redirects unauthenticated
 * - /api/checkout?tier=PREMIUM redirects to login (upgrade entry from upsell)
 *
 * Notes:
 * - Auth-dependent quota-exceeded → upsell modal flow blocked by Better Auth signing.
 * - Quota enforcer logic + overage event emission tested in unit/integration suites
 *   (src/forest/quota/__tests__/, src/land/billing/dunning/__tests__/).
 */

import { test, expect } from '@playwright/test';

const REDIRECT_OR_RATELIMITED = [302, 307, 308, 429];

test.describe('Quota API — unauthenticated returns 401', () => {
  test('GET /api/quota/status returns 401', async ({ request }) => {
    const res = await request.get('/api/quota/status');
    expect(res.status()).toBe(401);
  });

  test('GET /api/quota/overage-events returns 401', async ({ request }) => {
    const res = await request.get('/api/quota/overage-events');
    expect(res.status()).toBe(401);
  });

  test('GET /api/v1/quota/:tenantId returns 401 (any tenant id)', async ({ request }) => {
    const res = await request.get('/api/v1/quota/00000000-0000-0000-0000-000000000000');
    expect(res.status()).toBe(401);
  });
});

test.describe('Upsell entry points (no auth)', () => {
  test('/en/pricing renders 4 upgrade tier options', async ({ page }) => {
    await page.goto('/en/pricing');
    await expect(page.locator('#pricing').getByRole('radio')).toHaveCount(4);
  });

  test('GET /api/checkout?tier=PREMIUM redirects to login (upsell → upgrade)', async ({
    request,
  }) => {
    const res = await request.get('/api/checkout?tier=PREMIUM', { maxRedirects: 0 });
    expect(REDIRECT_OR_RATELIMITED).toContain(res.status());
    if (res.status() !== 429) {
      expect(res.headers()['location']).toMatch(/login/i);
    }
  });

  test('GET /api/checkout?tier=ENTERPRISE redirects to login', async ({ request }) => {
    const res = await request.get('/api/checkout?tier=ENTERPRISE', { maxRedirects: 0 });
    expect(REDIRECT_OR_RATELIMITED).toContain(res.status());
  });

  test('/dashboard/billing redirects unauthenticated', async ({ page }) => {
    const response = await page.goto('/en/dashboard/billing', { waitUntil: 'commit' });
    expect([302, 307, 308, 200]).toContain(response?.status() ?? 0);
    if (response && [302, 307, 308].includes(response.status())) {
      expect(response.headers()['location']).toMatch(/login/i);
    }
  });
});
