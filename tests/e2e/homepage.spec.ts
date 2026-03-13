import { test, expect } from '@playwright/test';

test.describe('Sophia AI Factory - Homepage', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('should display homepage title', async ({ page }) => {
    await expect(page).toHaveTitle(/AI Video Factory/);
  });

  test('should display main heading', async ({ page }) => {
    const heading = page.getByRole('heading', { level: 1 });
    await expect(heading).toBeVisible();
  });

  test('should display pricing section', async ({ page }) => {
    const pricingSection = page.getByText(/pricing/i, { exact: false });
    await expect(pricingSection).toBeVisible();
  });

  test('should display checkout buttons', async ({ page }) => {
    const checkoutButtons = page.getByRole('button', { name: /checkout|subscribe|get started/i });
    expect(checkoutButtons.count()).toBeGreaterThan(0);
  });

  test('should navigate to chat page', async ({ page }) => {
    await page.getByRole('link', { name: /chat/i }).click();
    await expect(page).toHaveURL(/.*chat.*/);
  });

  test('should be responsive on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    const heading = page.getByRole('heading', { level: 1 });
    await expect(heading).toBeVisible();
  });
});
