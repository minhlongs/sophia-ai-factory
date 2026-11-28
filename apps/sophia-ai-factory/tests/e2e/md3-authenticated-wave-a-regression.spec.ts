import { test, expect } from '@playwright/test';
import crypto from 'node:crypto';

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:8788';

const ROUTES = [
  { id: 'first-value', locale: 'vi', path: '/vi/dashboard/first-value' },
  { id: 'first-value', locale: 'en', path: '/en/dashboard/first-value' },
  { id: 'monetization', locale: 'vi', path: '/vi/dashboard/monetization' },
  { id: 'monetization', locale: 'en', path: '/en/dashboard/monetization' },
  { id: 'settings', locale: 'vi', path: '/vi/dashboard/settings' },
  { id: 'settings', locale: 'en', path: '/en/dashboard/settings' },
] as const;

const VIEWPORTS: Array<[number, number]> = [
  [320, 568],
  [390, 844],
  [768, 1024],
  [1440, 900],
];

const THEMES = ['light', 'dark'] as const;

test.describe('MD3 Phase 2 Wave A — Authenticated Semantic Landmark, i18n & Reflow Regression', () => {
  test('48-combination authenticated matrix passes with 1 H1, 1 main landmark, 0 nested main, and 0px overflow', async ({
    browser,
  }) => {
    const ctx = await browser.newContext({ deviceScaleFactor: 1 });
    const page = await ctx.newPage();

    // Genuine synthetic Better Auth signup (no demo=1, no forged cookies)
    await page.goto(`${BASE_URL}/vi/login`, { waitUntil: 'domcontentloaded' });
    const cookies = await ctx.cookies(BASE_URL);
    const csrf = cookies.find((c) => c.name === 'csrf-token' || c.name.includes('csrf'))?.value ?? '';
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Origin: BASE_URL,
      ...(csrf ? { 'x-csrf-token': csrf } : {}),
    };
    const ts = Date.now();
    const signUp = await page.request.post(`${BASE_URL}/api/auth/sign-up/email`, {
      headers,
      data: {
        name: 'WaveA2 Regression Customer',
        email: `wa2-e2e-${ts}@example.test`,
        password: `SophiaWA2#${crypto.randomBytes(8).toString('hex')}9`,
      },
    });
    expect(signUp.status()).toBe(200);

    for (const theme of THEMES) {
      for (const rt of ROUTES) {
        for (const [w, h] of VIEWPORTS) {
          await page.setViewportSize({ width: w, height: h });
          const resp = await page.goto(`${BASE_URL}${rt.path}`, { waitUntil: 'domcontentloaded', timeout: 25000 });
          expect(resp?.status()).toBe(200);

          await page.evaluate((th) => {
            document.documentElement.classList.toggle('dark', th === 'dark');
            document.documentElement.classList.toggle('light', th === 'light');
          }, theme);

          await expect(page.locator('main')).toHaveCount(1, { timeout: 8000 });
          await expect(page.locator('main main')).toHaveCount(0);
          await expect(page.locator('h1')).toHaveCount(1, { timeout: 8000 });

          const metrics = await page.evaluate(() => {
            const bodyText = document.body.innerText ?? '';
            return {
              overflowPx: Math.max(0, document.documentElement.scrollWidth - document.documentElement.clientWidth),
              hasErrorBoundary:
                bodyText.includes('Đã xảy ra lỗi') ||
                bodyText.includes('Lỗi không mong muốn') ||
                bodyText.includes('Something went wrong'),
              hasEnSettingsLeak:
                bodyText.includes('Account & Workspace Settings') || bodyText.includes('View Billing Metering'),
            };
          });

          expect(metrics.hasErrorBoundary).toBe(false);
          expect(metrics.overflowPx).toBe(0);
          if (rt.id === 'settings' && rt.locale === 'vi') {
            expect(metrics.hasEnSettingsLeak).toBe(false);
          }
        }
      }
    }

    await ctx.close();
  });
});
