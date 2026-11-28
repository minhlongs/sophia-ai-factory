import { test, expect } from '@playwright/test';
import crypto from 'node:crypto';

const RAW_BASE_URL = process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:8788';

function assertLoopbackOrigin(rawUrl: string): string {
  const parsed = new URL(rawUrl);
  const allowedHosts = new Set(['127.0.0.1', 'localhost', '[::1]']);
  if (parsed.protocol !== 'http:' || !allowedHosts.has(parsed.hostname)) {
    throw new Error(
      `[Wave A Safety Guard] Refusing non-loopback target "${rawUrl}". This synthetic-auth spec is strictly local-only (http://127.0.0.1 or http://localhost).`,
    );
  }
  return parsed.origin;
}

const BASE_URL = assertLoopbackOrigin(RAW_BASE_URL);

const ROUTES = [
  { id: 'first-value', locale: 'vi', path: '/vi/dashboard/first-value', expectedH1: /Hành trình Kịch bản Giá trị Đầu tiên/i },
  { id: 'first-value', locale: 'en', path: '/en/dashboard/first-value', expectedH1: /First-Value Script Journey/i },
  { id: 'monetization', locale: 'vi', path: '/vi/dashboard/monetization', expectedH1: /Quản lý Thu nhập/i },
  { id: 'monetization', locale: 'en', path: '/en/dashboard/monetization', expectedH1: /Revenue Management/i },
  { id: 'settings', locale: 'vi', path: '/vi/dashboard/settings', expectedH1: /Cài đặt tài khoản và không gian làm việc/i },
  { id: 'settings', locale: 'en', path: '/en/dashboard/settings', expectedH1: /Account & Workspace Settings/i },
] as const;

const VIEWPORTS: Array<[number, number]> = [
  [320, 568],
  [390, 844],
  [768, 1024],
  [1440, 900],
];

const THEMES = ['light', 'dark'] as const;

test.describe('MD3 Phase 2 Wave A — Authenticated Semantic Landmark, i18n & Reflow Regression', () => {
  test('48-combination authenticated matrix passes with loopback guard, 1 H1, 1 main landmark, 0 nested main, and 0px overflow', async ({
    browser,
  }) => {
    const ctx = await browser.newContext({ deviceScaleFactor: 1 });
    const page = await ctx.newPage();

    // Genuine synthetic Better Auth signup against verified loopback runtime only
    await page.goto(`${BASE_URL}/vi/login`, { waitUntil: 'domcontentloaded' });
    assertLoopbackOrigin(page.url());
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
          assertLoopbackOrigin(page.url());
          expect(resp?.status()).toBe(200);
          expect(new URL(page.url()).pathname).toBe(rt.path);

          await page.evaluate((th) => {
            document.documentElement.classList.toggle('dark', th === 'dark');
            document.documentElement.classList.toggle('light', th === 'light');
          }, theme);

          await expect(page.locator('main')).toHaveCount(1, { timeout: 8000 });
          await expect(page.locator('main main')).toHaveCount(0);
          await expect(page.locator('h1')).toHaveCount(1, { timeout: 8000 });
          await expect(page.locator('h1').first()).toHaveText(rt.expectedH1);

          const metrics = await page.evaluate((expectedTheme) => {
            const bodyText = document.body.innerText ?? '';
            return {
              overflowPx: Math.max(0, document.documentElement.scrollWidth - document.documentElement.clientWidth),
              hasEffectiveTheme: document.documentElement.classList.contains(expectedTheme),
              hasErrorBoundary:
                bodyText.includes('Đã xảy ra lỗi') ||
                bodyText.includes('Lỗi không mong muốn') ||
                bodyText.includes('Something went wrong'),
              hasEnSettingsLeak:
                bodyText.includes('Account & Workspace Settings') || bodyText.includes('View Billing Metering'),
            };
          }, theme);

          expect(metrics.hasEffectiveTheme).toBe(true);
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
