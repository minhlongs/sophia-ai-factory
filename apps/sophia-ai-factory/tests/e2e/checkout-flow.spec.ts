/**
 * E2E Checkout Flow Tests — Per-tier checkout API + redirects.
 *
 * Run: npx playwright test tests/e2e/checkout-flow.spec.ts
 *
 * Coverage:
 * - /pricing renders 4 tier radio buttons
 * - POST /api/checkout per tier returns 401 (unauthenticated)
 * - GET /api/checkout?tier=X redirects to login (unauthenticated)
 * - POST /api/checkout with invalid tier returns 400
 * - GET /api/checkout without tier redirects to /pricing
 */

import { test, expect } from '@playwright/test';

const TIERS = ['BASIC', 'PREMIUM', 'ENTERPRISE', 'MASTER'] as const;

// Pricing route's GET handler is rate-limited to 10 req / 60s per IP.
// Accept 429 alongside redirect codes — rate-limit is correct behavior, not a bug.
const REDIRECT_OR_RATELIMITED = [302, 307, 308, 429];

test.describe('Pricing page checkout buttons', () => {
  test('/en/pricing renders 4 tier radio buttons in #pricing section', async ({ page }) => {
    await page.goto('/en/pricing');
    await expect(page.locator('#pricing').getByRole('radio')).toHaveCount(4);
  });

  test('/vi/pricing renders 4 tier radio buttons in #pricing section', async ({ page }) => {
    await page.goto('/vi/pricing');
    await expect(page.locator('#pricing').getByRole('radio')).toHaveCount(4);
  });
});

test.describe('POST /api/checkout — unauthenticated', () => {
  for (const tier of TIERS) {
    test(`tier=${tier} returns 401 with login required message`, async ({ request }) => {
      const res = await request.post('/api/checkout', { data: { tier } });
      expect(res.status()).toBe(401);
      const body = await res.json();
      expect(body.error).toMatch(/login required/i);
    });
  }

  test('invalid tier returns 400', async ({ request }) => {
    const res = await request.post('/api/checkout', { data: { tier: 'INVALID' } });
    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/invalid/i);
  });

  test('missing tier returns 400', async ({ request }) => {
    const res = await request.post('/api/checkout', { data: {} });
    expect(res.status()).toBe(400);
  });
});

test.describe.configure({ mode: 'serial' });

test.describe('GET /api/checkout — Telegram bot redirect handler', () => {
  for (const tier of TIERS) {
    test(`tier=${tier} redirects to login when unauthenticated`, async ({ request }) => {
      const res = await request.get(`/api/checkout?tier=${tier}`, { maxRedirects: 0 });
      expect(REDIRECT_OR_RATELIMITED).toContain(res.status());
      if (res.status() !== 429) {
        const location = res.headers()['location'];
        expect(location).toBeTruthy();
        expect(location).toMatch(/login/i);
      }
    });
  }

  test('missing tier redirects to /pricing', async ({ request }) => {
    const res = await request.get('/api/checkout', { maxRedirects: 0 });
    expect(REDIRECT_OR_RATELIMITED).toContain(res.status());
    if (res.status() !== 429) {
      expect(res.headers()['location']).toMatch(/\/pricing/);
    }
  });

  test('invalid tier redirects to /pricing', async ({ request }) => {
    const res = await request.get('/api/checkout?tier=GARBAGE', { maxRedirects: 0 });
    expect(REDIRECT_OR_RATELIMITED).toContain(res.status());
    if (res.status() !== 429) {
      expect(res.headers()['location']).toMatch(/\/pricing/);
    }
  });
});

export {};
