import { test, expect } from '@playwright/test';

const viewports = [
  { name: 'Desktop', width: 1280, height: 800 },
  { name: 'Tablet', width: 768, height: 1024 },
  { name: 'Mobile', width: 375, height: 667 },
];

test.describe('Responsive Layout Viewport Tests', () => {
  for (const viewport of viewports) {
    test(`Landing page layout stability on ${viewport.name} (${viewport.width}x${viewport.height})`, async ({ page }) => {
      // Set viewport size dynamically
      await page.setViewportSize({ width: viewport.width, height: viewport.height });

      // Navigate to landing page
      const response = await page.goto('/en', { waitUntil: 'domcontentloaded' });
      expect(response?.status()).toBe(200);

      // Verify page title is present
      await expect(page).toHaveTitle(/Sophia/);

      // Check header navigation is responsive
      const logo = page.locator('a:has-text("Sophia")').first();
      await expect(logo).toBeVisible();

      // Check for horizontal scroll presence (which indicates bad responsive styling)
      const hasHorizontalScroll = await page.evaluate(() => {
        return document.documentElement.scrollWidth > window.innerWidth;
      });
      expect(hasHorizontalScroll, 'No horizontal scroll should be present (indicates layout overflow)').toBe(false);
    });
  }
});
