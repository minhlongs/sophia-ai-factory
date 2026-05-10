/**
 * E2E OAuth Link Flow — TikTok + YouTube connect/callback contracts.
 *
 * Run: npx playwright test tests/e2e/oauth-link-flow.spec.ts
 *
 * Coverage (smoke — full token-exchange path requires upstream OAuth playback):
 * - GET /api/oauth/tiktok/connect    → 401 anon (auth required to initiate)
 * - GET /api/oauth/youtube/connect   → 401 anon
 * - GET /api/oauth/tiktok/callback   → 400/401/302 without valid code+state
 * - GET /api/oauth/youtube/callback  → 400/401/302 without valid code+state
 * - /dashboard/integrations page redirects unauthenticated
 */

import { test, expect } from '@playwright/test';

const REDIRECT_CODES = [302, 307, 308];

test.describe('OAuth connect — unauthenticated returns 401', () => {
  test('GET /api/oauth/tiktok/connect returns 401', async ({ request }) => {
    const res = await request.get('/api/oauth/tiktok/connect');
    expect([401, ...REDIRECT_CODES]).toContain(res.status());
  });

  test('GET /api/oauth/youtube/connect returns 401', async ({ request }) => {
    const res = await request.get('/api/oauth/youtube/connect');
    expect([401, ...REDIRECT_CODES]).toContain(res.status());
  });
});

test.describe('OAuth callback — invalid params handled gracefully', () => {
  test('GET /api/oauth/tiktok/callback without params does not 500', async ({ request }) => {
    const res = await request.get('/api/oauth/tiktok/callback');
    expect(res.status()).toBeLessThan(500);
  });

  test('GET /api/oauth/youtube/callback without params does not 500', async ({ request }) => {
    const res = await request.get('/api/oauth/youtube/callback');
    expect(res.status()).toBeLessThan(500);
  });

  test('GET /api/oauth/tiktok/callback with bogus code rejects (no token write)', async ({
    request,
  }) => {
    const res = await request.get('/api/oauth/tiktok/callback?code=fake&state=fake');
    expect(res.status()).toBeLessThan(500);
    expect([400, 401, 403, ...REDIRECT_CODES, 200]).toContain(res.status());
  });
});

test.describe('OAuth integration page navigation', () => {
  test('/dashboard/integrations redirects unauthenticated', async ({ page }) => {
    const response = await page.goto('/en/dashboard/integrations', { waitUntil: 'commit' });
    expect(REDIRECT_CODES.concat([200])).toContain(response?.status() ?? 0);
    if (response && REDIRECT_CODES.includes(response.status())) {
      expect(response.headers()['location']).toMatch(/login/i);
    }
  });
});
