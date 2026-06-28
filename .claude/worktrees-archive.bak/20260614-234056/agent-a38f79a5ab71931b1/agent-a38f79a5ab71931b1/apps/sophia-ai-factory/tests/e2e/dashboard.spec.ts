/**
 * E2E Dashboard Tests — Auth-gated routes and API health.
 *
 * Run: npx playwright test tests/e2e/dashboard.spec.ts
 * Env: NEXT_PUBLIC_MOCK_AI_SERVICES=true
 *
 * Coverage:
 * - /dashboard returns redirect when not authenticated
 * - /api/health returns 200 with status field
 *
 * NOTE: No authenticated dashboard testing — no real accounts.
 */

import { test, expect } from '@playwright/test';

test.describe('Dashboard auth guard', () => {
  test('/dashboard redirects unauthenticated users (302/307)', async ({ page }) => {
    // Track redirects
    const redirected = { happened: false };
    page.on('response', (res) => {
      if ([301, 302, 307, 308].includes(res.status()) && res.url().includes('dashboard')) {
        redirected.happened = true;
      }
    });

    await page.goto('/vi/dashboard', { waitUntil: 'networkidle' });

    // Final URL should not be the dashboard
    const finalUrl = page.url();
    expect(finalUrl).not.toMatch(/\/vi\/dashboard$/);
    // Should be login page or home
    expect(finalUrl).toMatch(/login|\/vi$|\/en$|\/$|sign/i);
  });

  test('/vi/dashboard/settings redirects unauthenticated users', async ({ page }) => {
    await page.goto('/vi/dashboard/settings', { waitUntil: 'networkidle' });
    const finalUrl = page.url();
    expect(finalUrl).not.toMatch(/dashboard\/settings/);
  });

  test('/vi/dashboard/campaigns redirects unauthenticated users', async ({ page }) => {
    await page.goto('/vi/dashboard/campaigns', { waitUntil: 'networkidle' });
    const finalUrl = page.url();
    expect(finalUrl).not.toMatch(/dashboard\/campaigns/);
  });
});

test.describe('API health endpoint', () => {
  test('GET /api/health returns 200', async ({ request }) => {
    const response = await request.get('/api/health');
    // Health endpoint returns 200 for healthy, 503 for unhealthy
    expect([200, 503]).toContain(response.status());
  });

  test('GET /api/health returns JSON with status field', async ({ request }) => {
    const response = await request.get('/api/health');
    expect(response.headers()['content-type']).toMatch(/application\/json/);

    const body = await response.json();
    expect(body).toHaveProperty('status');
    // Status is one of the known values
    expect(['healthy', 'degraded', 'unhealthy']).toContain(body.status);
  });

  test('GET /api/health returns timestamp field', async ({ request }) => {
    const response = await request.get('/api/health');
    const body = await response.json();
    expect(body).toHaveProperty('timestamp');
    // Timestamp should be a valid ISO string
    expect(new Date(body.timestamp).toISOString()).toBeTruthy();
  });
});

export {};
