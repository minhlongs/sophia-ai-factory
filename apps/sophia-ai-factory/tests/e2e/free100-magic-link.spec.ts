/**
 * E2E: FREE100 Magic-Link → Onboarding → Dashboard
 *
 * Run: npx playwright test tests/e2e/free100-magic-link.spec.ts
 * Env: NEXT_PUBLIC_MOCK_AI_SERVICES=true
 *
 * Coverage:
 * - /login page shows magic-link email form
 * - Authenticated user lands on /dashboard (via real Better Auth session)
 * - Unauthenticated /dashboard/onboarding redirects to login
 *
 * NOTE: Full magic-link email flow (request email → click link → auto-login)
 * requires a real email delivery mock or test-mode SMTP stub, which isn't wired
 * in the local dev server. Instead we verify:
 *   (a) The magic-link form exists and accepts email input
 *   (b) A real signed session reaches the dashboard (via auth-fixture)
 * This covers the auth entry point and the post-login destination.
 *
 * Auth strategy: the authenticated test below uses the shared auth fixture
 * (`./_fixtures/auth-fixture`), which signs in via Better Auth's own
 * `/api/auth/sign-in/email` endpoint and harvests the real signed cookie.
 * Auto-skips per fixture defaults — see `./_fixtures/auth-fixture.ts`.
 *
 * The pre-fixture path (manual `seedTestUser` + cookie injection) was retired
 * here on 2026-05-11: Better Auth validates the session token's signature on
 * every request, so a directly-inserted SQLite row could never be accepted.
 */

import { test, expect } from './_fixtures/auth-fixture';

test.describe('FREE100 Magic-Link Auth', () => {
  test('/login shows magic-link email form', async ({ page }) => {
    await page.goto('/en/login');
    await expect(page.locator('input[type="email"]')).toBeVisible();

    // Submit button
    const submitBtn = page.locator('button[type="submit"]').or(
      page.locator('button').filter({ hasText: /sign in|log in|continue|send|đăng nhập/i }),
    );
    await expect(submitBtn.first()).toBeVisible();
  });

  test('/login magic-link form accepts email and submits', async ({ page }) => {
    await page.goto('/en/login');
    await page.locator('input[type="email"]').fill('magiclink-test@test.invalid');

    const submitBtn = page.locator('button[type="submit"]').first();
    await submitBtn.click();

    // After submit: either stays on login with confirmation, or redirects.
    // We only assert: no crash, page is still renderable.
    await page.waitForTimeout(1000);
    const body = page.locator('body');
    await expect(body).toBeVisible();
  });

  test('signed-in user reaches /dashboard without redirect', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/en/dashboard', { waitUntil: 'domcontentloaded' });
    const url = authenticatedPage.url();

    expect(url, 'authenticated request should NOT redirect to /login').not.toMatch(/\/login/);
    expect(url).toMatch(/\/dashboard/);
  });

  test('unauthenticated /dashboard/onboarding redirects to login', async ({ page }) => {
    await page.goto('/en/dashboard/onboarding', { waitUntil: 'networkidle' });
    const url = page.url();
    expect(url).toMatch(/login|\/en$|\/vi$|\/$|sign/i);
    expect(url).not.toMatch(/dashboard\/onboarding/);
  });
});
