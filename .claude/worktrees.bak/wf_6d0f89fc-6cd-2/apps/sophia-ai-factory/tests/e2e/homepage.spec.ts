/**
 * Homepage E2E Tests — Public landing page functionality.
 *
 * Run: npx playwright test tests/e2e/homepage.spec.ts
 * Env: NEXT_PUBLIC_MOCK_AI_SERVICES=true (optional)
 *
 * Coverage:
 * - Homepage loads successfully
 * - Root path (/) redirects to /vi
 * - Hero section is visible
 * - Pricing CTA is visible and navigates correctly
 * - Locale switcher toggles between vi and en
 * - Navigation links are present
 */

import { test, expect } from '@playwright/test';
import { Homepage } from './pages/homepage.page';

test.describe('Homepage', () => {
  let home: Homepage;

  test.beforeEach(async ({ page }) => {
    home = new Homepage(page);
  });

  test('redirects from / to /vi', async ({ page }) => {
    await page.goto('/');
    const url = page.url();
    expect(url).toMatch(/\/vi(\/|$)/);
  });

  test('homepage loads with visible hero section', async ({ page }) => {
    await home.navigate();
    await expect(home.heroSection).toBeVisible({ timeout: 5000 });
    await expect(home.heroTitle).toBeVisible();
    await expect(home.navigation).toBeVisible();
  });

  test('hero title contains Sophia', async ({ page }) => {
    await home.navigate();
    const title = await home.heroTitle.textContent();
    expect(title).toMatch(/Sophia/i);
  });

  test('Get Started button is visible and clickable', async ({ page }) => {
    await home.navigate();
    await expect(home.getStartedButton).toBeVisible();
    await expect(home.getStartedButton).toBeEnabled();
  });

  test('Pricing link is visible and navigates to /pricing', async ({ page }) => {
    await home.navigate();
    await expect(home.pricingLink).toBeVisible();
    await home.clickPricing();
    await expect(page).toHaveURL(/pricing/);
    await expect(page.locator('main')).toBeVisible();
  });

  test('locale switcher toggles to Vietnamese', async ({ page }) => {
    await home.navigate();
    const initialLocale = await home.getLocale();
    expect(initialLocale).toBe('vi');

    // If there's a locale switcher, test it
    if (await home.localeSwitcher.isVisible()) {
      // Try switching to English and back
      await home.switchToEnglish();
      await page.waitForLoadState('domcontentloaded');
      expect(page.url()).toMatch(/\/en(\/|$)/);

      await home.switchToVietnamese();
      await page.waitForLoadState('domcontentloaded');
      expect(page.url()).toMatch(/\/vi(\/|$)/);
    }
  });

  test('navigation links are present', async ({ page }) => {
    await home.navigate();
    const navLinks = page.locator('nav a, header a').filter({ has: page.locator('*') });
    const count = await navLinks.count();
    expect(count).toBeGreaterThan(0);
  });

  test('page title contains Sophia', async ({ page }) => {
    await home.navigate();
    const title = await home.getTitle();
    expect(title).toMatch(/Sophia/i);
  });

  test('hero section has call-to-action buttons', async ({ page }) => {
    await home.navigate();
    const buttons = home.heroSection.locator('button, a[href]');
    const count = await buttons.count();
    expect(count).toBeGreaterThan(0);
  });

  test('locale from / redirects correctly', async ({ page }) => {
    await page.goto('/');
    // Should have redirected to either /vi or /en (default locale)
    const url = page.url();
    expect(url).not.toBe('/');
    expect(url).toMatch(/^\/(vi|en)/);
  });
});
