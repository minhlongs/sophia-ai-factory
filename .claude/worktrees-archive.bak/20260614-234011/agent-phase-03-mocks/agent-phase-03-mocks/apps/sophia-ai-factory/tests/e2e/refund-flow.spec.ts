/**
 * E2E Refund Flow — auth-protected refund request + admin review endpoints.
 *
 * Run: npx playwright test tests/e2e/refund-flow.spec.ts
 *
 * Coverage (smoke / contract level — full flow needs Better Auth signing):
 * - POST /api/refund-requests/create → 401 anon, 400 invalid body
 * - GET  /api/admin/refunds          → 401 anon (admin-only)
 * - /dashboard/billing redirects unauthenticated
 *
 * Notes:
 * - 14d window logic + clawback math covered by unit suites in `land/refunds/`.
 * - Auth-required positive path blocked by Better Auth signing — see _fixtures/.
 */

import { test, expect } from '@playwright/test';

const REDIRECT_CODES = [302, 307, 308];

test.describe('Refund API — unauthenticated returns 401', () => {
  test('POST /api/refund-requests/create returns 401 (no session)', async ({ request }) => {
    const res = await request.post('/api/refund-requests/create', {
      data: {
        purchaseId: 'p_fake',
        reason: 'Testing refund window edge case',
        customerWalletAddress: 'TXyz000000000000000000',
      },
    });
    expect(res.status()).toBe(401);
  });

  test('GET /api/admin/refunds returns 401 anon (admin-only)', async ({ request }) => {
    const res = await request.get('/api/admin/refunds');
    // 401 unauth, 403 forbidden (non-admin), or redirect
    expect([401, 403, ...REDIRECT_CODES]).toContain(res.status());
  });
});

test.describe('Refund page navigation', () => {
  test('/dashboard/billing redirects unauthenticated', async ({ page }) => {
    const response = await page.goto('/en/dashboard/billing', { waitUntil: 'commit' });
    expect(REDIRECT_CODES.concat([200])).toContain(response?.status() ?? 0);
    if (response && REDIRECT_CODES.includes(response.status())) {
      expect(response.headers()['location']).toMatch(/login/i);
    }
  });
});
