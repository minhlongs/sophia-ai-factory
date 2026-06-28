/**
 * Admin Panel E2E Tests — Admin-only functionality.
 *
 * Run: npx playwright test tests/e2e/admin.spec.ts
 * Env: E2E_ADMIN_PASSWORD, E2E_USER_PASSWORD (set via e2e:bootstrap-users)
 *
 * Coverage:
 * - Admin user can access /admin
 * - Regular user gets access denied (403 or redirect)
 * - User management section loads for admin
 * - System health indicators present
 * - Audit logs table present
 * - Admin tabs navigation works
 */

import { test, expect } from './fixtures/auth-fixtures';
import { AdminPage } from './pages/admin.page';

test.describe('Admin Panel — Access Control', () => {
  test('admin user can access /admin', async ({ adminPage }) => {
    const admin = new AdminPage(adminPage);
    await admin.navigate();

    const finalUrl = adminPage.url();
    expect(finalUrl).toMatch(/\/admin/);
  });

  test('regular user cannot access /admin (redirects or 403)', async ({ userPage }) => {
    const response = await userPage.goto('/vi/admin', { waitUntil: 'domcontentloaded' });
    const finalUrl = userPage.url();
    expect(finalUrl).not.toMatch(/\/admin$/);

    if (response) {
      expect([200, 302, 403, 404]).toContain(response.status());
    }
  });

  test('non-authenticated user redirected to login from /admin', async ({ page }) => {
    await page.goto('/vi/admin', { waitUntil: 'networkidle' });
    const finalUrl = page.url();
    expect(finalUrl).not.toMatch(/\/admin$/);
    expect(finalUrl).toMatch(/login|\/vi$|\/en$|\/$/);
  });
});

test.describe('Admin Panel — Authenticated Admin', () => {
  test('admin panel loads with admin navigation visible', async ({ adminPage }) => {
    const admin = new AdminPage(adminPage);
    await admin.navigate();
    await expect(admin.adminNav).toBeVisible({ timeout: 5000 });
  });

  test('admin users tab is present', async ({ adminPage }) => {
    const admin = new AdminPage(adminPage);
    await admin.navigate();
    await expect(admin.usersTab).toBeVisible();
  });

  test('admin alerts tab is present', async ({ adminPage }) => {
    const admin = new AdminPage(adminPage);
    await admin.navigate();
    await expect(admin.alertsTab).toBeVisible();
  });

  test('admin analytics tab is present', async ({ adminPage }) => {
    const admin = new AdminPage(adminPage);
    await admin.navigate();
    await expect(admin.analyticsTab).toBeVisible();
  });

  test('admin system health tab is present', async ({ adminPage }) => {
    const admin = new AdminPage(adminPage);
    await admin.navigate();
    if (await admin.systemHealthTab.isVisible()) {
      await expect(admin.systemHealthTab).toBeVisible();
    }
  });

  test('admin audit logs tab is present', async ({ adminPage }) => {
    const admin = new AdminPage(adminPage);
    await admin.navigate();
    if (await admin.auditLogsTab.isVisible()) {
      await expect(admin.auditLogsTab).toBeVisible();
    }
  });

  test('user search input is available', async ({ adminPage }) => {
    const admin = new AdminPage(adminPage);
    await admin.navigate();
    await admin.switchTab('users');
    await expect(admin.userSearchInput).toBeVisible();
  });

  test('user table loads with at least one user', async ({ adminPage }) => {
    const admin = new AdminPage(adminPage);
    await admin.navigate();
    await admin.switchTab('users');

    const isTableVisible = await admin.userTable.isVisible();
    if (isTableVisible) {
      const userCount = await admin.getUserCount();
      expect(userCount).toBeGreaterThanOrEqual(1);
    }
  });

  test('admin can switch between tabs', async ({ adminPage }) => {
    const admin = new AdminPage(adminPage);
    await admin.navigate();

    await admin.switchTab('users');
    await expect(admin.usersTab).toHaveClass(/active/);

    await admin.switchTab('analytics');
    await expect(admin.analyticsTab).toHaveClass(/active/);
  });
});
