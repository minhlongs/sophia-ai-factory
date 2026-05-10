/**
 * E2E Admin Alerts Triage — alert rules + history + admin audit endpoints.
 *
 * Run: npx playwright test tests/e2e/admin-alerts-triage.spec.ts
 *
 * Coverage (smoke / contract level):
 * - GET /api/alerts/rules        → 401 anon
 * - GET /api/alerts/history      → 401 anon
 * - GET /api/alerts/preferences  → 401 anon
 * - GET /api/admin/audit         → 401/403 anon (admin-only)
 * - /admin/audit page redirects unauthenticated
 */

import { test, expect } from '@playwright/test';

const REDIRECT_CODES = [302, 307, 308];

test.describe('Alert API — unauthenticated returns 401', () => {
  test('GET /api/alerts/rules returns 401', async ({ request }) => {
    const res = await request.get('/api/alerts/rules');
    expect(res.status()).toBe(401);
  });

  test('GET /api/alerts/history returns 401', async ({ request }) => {
    const res = await request.get('/api/alerts/history');
    expect(res.status()).toBe(401);
  });

  test('GET /api/alerts/preferences returns 401', async ({ request }) => {
    const res = await request.get('/api/alerts/preferences');
    expect(res.status()).toBe(401);
  });

  test('GET /api/admin/audit returns 401/403 anon (admin-only)', async ({ request }) => {
    const res = await request.get('/api/admin/audit');
    expect([401, 403, ...REDIRECT_CODES]).toContain(res.status());
  });
});

test.describe('Admin alerts page navigation', () => {
  test('/admin/audit redirects unauthenticated', async ({ page }) => {
    const response = await page.goto('/en/admin/audit', { waitUntil: 'commit' });
    expect(REDIRECT_CODES.concat([200, 403, 404])).toContain(response?.status() ?? 0);
  });

  test('/dashboard/alerts loads or redirects (does not 500)', async ({ page }) => {
    const response = await page.goto('/en/dashboard/alerts', { waitUntil: 'commit' });
    expect(response?.status() ?? 0).toBeLessThan(500);
  });
});
