import { test, expect } from '@playwright/test';

const STAGING = process.env.PLAYWRIGHT_TEST_BASE_URL || 'https://sophia-ai-factory-staging.agencyos-openclaw.workers.dev';

test.describe('Sophia Staging E2E Smoke', () => {
  test('api/health responds 200', async ({ request }) => {
    const r = await request.get(`${STAGING}/api/health`);
    expect(r.status()).toBe(200);
  });

  test('api/version returns shortSha', async ({ request }) => {
    const r = await request.get(`${STAGING}/api/version`);
    expect(r.status()).toBe(200);
    const body = await r.json();
    expect(body.shortSha).toBeTruthy();
  });

  test('homepage renders', async ({ page }) => {
    await page.goto(`${STAGING}/`);
    await expect(page).toHaveURL(new RegExp(`${STAGING}|/en`));
    const title = await page.title();
    expect(title).toBeTruthy();
  });

  test('pricing page accessible', async ({ page }) => {
    await page.goto(`${STAGING}/en/pricing`);
    expect(page.url()).toContain('/pricing');
  });

  test('redeem page accessible', async ({ page }) => {
    await page.goto(`${STAGING}/en/redeem`);
    expect(page.url()).toContain('/redeem');
  });
});
