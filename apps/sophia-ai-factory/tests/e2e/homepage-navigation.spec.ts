import { test, expect } from './fixtures/auth-fixture';
import { Homepage } from './pages/homepage.page';

/**
 * Example E2E test for the Homepage.
 * Demonstrates using Page Object Model pattern with fixtures.
 *
 * Run: npm run test:e2e home-navigation.spec.ts
 */

test.describe('Homepage Navigation', () => {
  test.beforeEach(async ({ page }) => {
    const homepage = new Homepage(page);
    await homepage.navigate();
  });

  test('should have correct title', async ({ page }) => {
    const homepage = new Homepage(page);
    const title = await homepage.getTitle();

    // Sophia AI Factory — Revenue as a Service
    expect(title).toContain('Sophia');
  });

  test('should display navigation header', async ({ page }) => {
    const homepage = new Homepage(page);
    expect(await homepage.isVisible()).toBeTruthy();
  });

  test('should have Get Started button visible', async ({ page }) => {
    const homepage = new Homepage(page);
    await expect(homepage.getStartedButton).toBeVisible();
  });

  test('should navigate to pricing page', async ({ page }) => {
    const homepage = new Homepage(page);

    // Expect pricing link to be visible
    await expect(homepage.pricingLink).toBeVisible();

    // Click and verify navigation (adjust href as needed)
    await homepage.pricingLink.click();
    await expect(page).toHaveURL(/pricing|pricing/);
  });

  test('hero title should contain key message', async ({ page }) => {
    const homepage = new Homepage(page);

    // Check hero section contains expected keywords
    await expect(homepage.heroTitle).toBeVisible();
    await expect(homepage.heroTitle).toContainText(/(revenue|service|ai|factory)/i);
  });
});
