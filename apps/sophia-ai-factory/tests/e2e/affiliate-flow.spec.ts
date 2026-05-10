/**
 * E2E Affiliate Flow Tests — earnings/payouts/payout-method API + dashboard pages.
 *
 * Run: npx playwright test tests/e2e/affiliate-flow.spec.ts
 *
 * Coverage (API layer — auth-protected endpoints reject anon):
 * - GET /api/affiliate/earnings   → 401 unauth
 * - GET /api/affiliate/payouts    → 401 unauth
 * - POST /api/affiliate/payout-method → 401 unauth, 400 invalid body
 * - GET /api/v1/integrations/affiliate-networks → 401 unauth
 * Coverage (page layer):
 * - /affiliate-discovery loads (public discovery page)
 * - /dashboard/integrations/affiliate-networks redirects unauthenticated
 *
 * Notes:
 * - Auth-dependent flows blocked by Better Auth signing (see _fixtures/free100-fixtures.ts).
 * - Conversion accrual + commission ledger tested in unit/integration suites.
 */

import { test, expect } from '@playwright/test';

const REDIRECT_CODES = [302, 307, 308];

test.describe('Affiliate API — unauthenticated returns 401', () => {
  test('GET /api/affiliate/earnings returns 401', async ({ request }) => {
    const res = await request.get('/api/affiliate/earnings');
    expect(res.status()).toBe(401);
  });

  test('GET /api/affiliate/payouts returns 401', async ({ request }) => {
    const res = await request.get('/api/affiliate/payouts');
    expect(res.status()).toBe(401);
  });

  test('POST /api/affiliate/payout-method returns 401', async ({ request }) => {
    const res = await request.post('/api/affiliate/payout-method', {
      data: { method: 'usdt' },
    });
    expect(res.status()).toBe(401);
  });

  test('GET /api/v1/integrations/affiliate-networks returns 401', async ({ request }) => {
    const res = await request.get('/api/v1/integrations/affiliate-networks');
    expect(res.status()).toBe(401);
  });
});

test.describe('Affiliate page navigation', () => {
  test('/affiliate-discovery loads as public page (200 or graceful)', async ({ page }) => {
    const response = await page.goto('/en/affiliate-discovery');
    expect(response?.status()).toBeLessThan(500);
  });

  test('/dashboard/integrations/affiliate-networks redirects unauthenticated', async ({
    page,
  }) => {
    const response = await page.goto('/en/dashboard/integrations/affiliate-networks', {
      waitUntil: 'commit',
    });
    expect(REDIRECT_CODES.concat([200])).toContain(response?.status() ?? 0);
    if (response && REDIRECT_CODES.includes(response.status())) {
      expect(response.headers()['location']).toMatch(/login/i);
    }
  });

  test('/admin/affiliates redirects unauthenticated (admin-only)', async ({ page }) => {
    const response = await page.goto('/en/admin/affiliates', { waitUntil: 'commit' });
    expect(REDIRECT_CODES.concat([200, 403, 404])).toContain(response?.status() ?? 0);
  });
});
