import { test, expect } from '@playwright/test';

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3000';
const AFFILIATE_WIDTHS = [320, 390, 768, 1024, 1440] as const;

test.describe('MD3 Public Layout & Accessibility Regression', () => {
  for (const route of ['/vi/affiliate', '/en/affiliate']) {
    for (const width of AFFILIATE_WIDTHS) {
      test(`${route} has 0px horizontal overflow and single <main> at ${width}px`, async ({ page }) => {
        await page.setViewportSize({ width, height: 900 });
        await page.goto(`${BASE_URL}${route}`, { waitUntil: 'domcontentloaded' });
        const metrics = await page.evaluate(() => ({
          clientWidth: document.documentElement.clientWidth,
          scrollWidth: document.documentElement.scrollWidth,
          mainCount: document.querySelectorAll('main').length,
        }));
        expect(metrics.scrollWidth).toBeLessThanOrEqual(metrics.clientWidth);
        expect(metrics.mainCount).toBe(1);
      });
    }
  }

  test('mobile nav trigger and footer standalone links meet >= 44px touch target contract', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`${BASE_URL}/vi/features`, { waitUntil: 'domcontentloaded' });
    const rects = await page.evaluate(() => {
      const els = [...document.querySelectorAll('.md3-touch-target')];
      return els.map((el) => {
        const r = el.getBoundingClientRect();
        return { text: (el.textContent || '').trim().slice(0, 24), width: Math.round(r.width), height: Math.round(r.height) };
      });
    });
    expect(rects.length).toBeGreaterThan(0);
    for (const rect of rects) {
      expect(rect.height, `touch target height for ${rect.text}`).toBeGreaterThanOrEqual(44);
    }
  });
});
