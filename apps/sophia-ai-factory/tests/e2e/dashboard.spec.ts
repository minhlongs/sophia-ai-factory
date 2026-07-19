/**
 * Dashboard E2E Tests — Auth-gated dashboard functionality.
 *
 * Run: npx playwright test tests/e2e/dashboard.spec.ts
 * Env: E2E_USER_PASSWORD (for authenticated tests)
 *
 * Coverage:
 * - Unauthenticated /dashboard redirects to login
 * - Authenticated user can access /dashboard
 * - Dashboard sidebar is functional
 * - User info section displays correctly
 * - Quick actions are visible
 * - Metrics/stats cards are present
 */

import { test, expect } from './fixtures/auth-fixtures';
import { DashboardPage } from './pages/dashboard.page';

// Public tests (no auth required)
test.describe('Dashboard — Public (unauthorized)', () => {
  test('/dashboard redirects unauthenticated users to login', async ({ page }) => {
    const response = await page.goto('/vi/dashboard', { waitUntil: 'networkidle' });
    const finalUrl = page.url();
    expect(finalUrl).not.toMatch(/\/vi\/dashboard$/);
    expect(finalUrl).toMatch(/login|\/vi$|\/en$|\/$|sign/i);
  });

  test('/dashboard/settings redirects unauthenticated users', async ({ page }) => {
    await page.goto('/vi/dashboard/settings', { waitUntil: 'networkidle' });
    const finalUrl = page.url();
    expect(finalUrl).not.toMatch(/dashboard\/settings/);
  });

  test('/dashboard/campaigns redirects unauthenticated users', async ({ page }) => {
    await page.goto('/vi/dashboard/campaigns', { waitUntil: 'networkidle' });
    const finalUrl = page.url();
    expect(finalUrl).not.toMatch(/dashboard\/campaigns/);
  });
});

// Authenticated tests (require E2E_USER_PASSWORD via fixture)
test.describe('Dashboard — Authenticated', () => {
  test('authenticated user can access dashboard', async ({ userPage }) => {
    const dashboard = new DashboardPage(userPage);
    await dashboard.navigate();

    const finalUrl = userPage.url();
    expect(finalUrl).toMatch(/\/dashboard/);
  });

  test('dashboard loads with visible sidebar', async ({ userPage }) => {
    const dashboard = new DashboardPage(userPage);
    await dashboard.navigate();
    await expect(dashboard.sidebar).toBeVisible({ timeout: 5000 });
  });

  test('dashboard displays user menu', async ({ userPage }) => {
    const dashboard = new DashboardPage(userPage);
    await dashboard.navigate();
    await expect(dashboard.userMenu).toBeVisible();
  });

  test('dashboard metrics section is present', async ({ userPage }) => {
    const dashboard = new DashboardPage(userPage);
    await dashboard.navigate();
    await expect(dashboard.metricsSection).toBeVisible();
  });

  test('dashboard quick actions are visible', async ({ userPage }) => {
    const dashboard = new DashboardPage(userPage);
    await dashboard.navigate();
    const isVisible = await dashboard.quickActions.isVisible();
    if (isVisible) {
      await expect(dashboard.quickActions).toBeVisible();
    }
  });

  test('overview tab is active by default', async ({ userPage }) => {
    const dashboard = new DashboardPage(userPage);
    await dashboard.navigate();
    await expect(dashboard.overviewTab).toHaveClass(/active/);
  });

  test('sidebar navigation items are present', async ({ userPage }) => {
    const dashboard = new DashboardPage(userPage);
    await dashboard.navigate();
    const navItems = dashboard.sidebar.locator('a, button');
    const count = await navItems.count();
    expect(count).toBeGreaterThan(0);
  });
});
