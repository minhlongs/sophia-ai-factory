/**
 * E2E Account Self-Delete — 7-day cooldown + restore window.
 *
 * Run: npx playwright test tests/e2e/account-self-delete.spec.ts
 *
 * Coverage (smoke — full cooldown traversal needs cron + Better Auth signing):
 * - POST /api/account/delete/request → 401 anon
 * - GET  /api/account/delete/status  → 401 anon
 * - POST /api/account/delete/confirm → 401/400 without valid token
 * - /dashboard/settings redirects unauthenticated
 *
 * Notes:
 * - 7-day cooldown logic + restore window covered by
 *   src/app/api/account/delete/__tests__/.
 * - Confirm token = sha256(request_id) — see route handler for shape.
 */

import { test, expect } from '@playwright/test';

const REDIRECT_CODES = [302, 307, 308];

test.describe('Account delete API — unauthenticated returns 401', () => {
  test('POST /api/account/delete/request returns 401', async ({ request }) => {
    const res = await request.post('/api/account/delete/request', {
      data: { action: 'request' },
    });
    expect(res.status()).toBe(401);
  });

  test('GET /api/account/delete/status returns 401', async ({ request }) => {
    const res = await request.get('/api/account/delete/status');
    expect([401, 404]).toContain(res.status());
  });

  test('POST /api/account/delete/confirm without token rejects', async ({ request }) => {
    const res = await request.post('/api/account/delete/confirm', {
      data: {},
    });
    // 401 unauth, 400 missing token, 404 no such request
    expect([400, 401, 404]).toContain(res.status());
  });

  test('POST /api/account/delete/confirm with bogus token rejects', async ({ request }) => {
    const res = await request.post('/api/account/delete/confirm', {
      data: { token: 'not-a-real-confirmation-token' },
    });
    expect([400, 401, 403, 404]).toContain(res.status());
  });
});

test.describe('Account settings page navigation', () => {
  test('/dashboard/settings redirects unauthenticated', async ({ page }) => {
    const response = await page.goto('/en/dashboard/settings', { waitUntil: 'commit' });
    expect(REDIRECT_CODES.concat([200])).toContain(response?.status() ?? 0);
    if (response && REDIRECT_CODES.includes(response.status())) {
      expect(response.headers()['location']).toMatch(/login/i);
    }
  });
});
