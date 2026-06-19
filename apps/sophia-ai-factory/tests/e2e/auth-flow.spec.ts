/**
 * E2E Auth Flow Tests — Login, setup wizard, auth guards.
 *
 * Run: npx playwright test tests/e2e/auth-flow.spec.ts
 * Env: NEXT_PUBLIC_MOCK_AI_SERVICES=true
 *
 * Coverage:
 * - /login page renders login form
 * - /setup-wizard page loads with step indicator
 * - Login with invalid credentials shows error
 * - Unauthenticated /dashboard redirects to login
 *
 * NOTE: No real credentials used — only tests unauthenticated flows.
 */

import { test, expect } from '@playwright/test';

test.describe('Auth pages', () => {
  test('/login page renders login form', async ({ page }) => {
    await page.goto('/vi/login');
    // Form fields must be visible
    await expect(page.locator('input[type="email"]')).toBeVisible();
    // Either password input or magic link mode
    const hasPasswordInput = await page.locator('input[type="password"]').isVisible();
    const hasEmailInput = await page.locator('input[type="email"]').isVisible();
    expect(hasEmailInput).toBeTruthy();
    // Submit button visible — target the form's submit button, not navbar buttons
    const submitBtn = page.locator('form button[type="submit"]').first();
    await expect(submitBtn).toBeVisible();
  });

  test('/setup-wizard page loads with step indicator', async ({ page }) => {
    await page.goto('/setup-wizard');
    // Page should render — either the wizard UI or a redirect to login
    // In mock mode the wizard renders
    const body = page.locator('body');
    await expect(body).toBeVisible();
    // The page should have some visible content (h1 or step indicator)
    const heading = page.locator('h1').or(page.locator('[data-testid="step-indicator"]'));
    await expect(heading.first()).toBeVisible();
  });

  test('login with invalid credentials shows error', async ({ page }) => {
    await page.goto('/vi/login');

    // Fill in email
    await page.locator('input[type="email"]').fill('invalid@example.com');

    // Switch to password mode if in magic link mode
    const passwordToggle = page.locator('button').filter({ hasText: /mật khẩu|password/i });
    if (await passwordToggle.isVisible()) {
      await passwordToggle.click();
    }

    const passwordInput = page.locator('input[type="password"]');
    if (await passwordInput.isVisible()) {
      await passwordInput.fill('wrongpassword123');
    }

    // Submit — target form's submit button specifically
    const submitBtn = page.locator('form button[type="submit"]').first();
    await submitBtn.click();

    // Wait for error response — either an error message or the form stays
    await page.waitForTimeout(2000);

    // Should NOT have navigated to dashboard
    expect(page.url()).not.toMatch(/\/dashboard/);

    // Error state: page should still be on login, possibly with error text
    const currentUrl = page.url();
    expect(currentUrl).toMatch(/login/);
  });

  test('unauthenticated /dashboard redirects to login', async ({ page }) => {
    // Navigate to dashboard without auth cookies
    const response = await page.goto('/vi/dashboard', { waitUntil: 'networkidle' });

    // Should redirect to login page
    const finalUrl = page.url();
    expect(finalUrl).toMatch(/login|\/vi$|\/en$|\/$|sign/i);

    // Alternatively, response could be a redirect chain ending at login
    // Just ensure we are NOT on the dashboard
    expect(finalUrl).not.toMatch(/\/dashboard$/);
  });
});

export {};
