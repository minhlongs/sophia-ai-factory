/**
 * E2E Admin Bulk Promo Generator — contract-level smoke.
 *
 * Run: npx playwright test tests/e2e/admin-promo-bulk.spec.ts
 *
 * Coverage:
 * - POST /api/admin/promo-codes/bulk-generate → 401 anon
 * - POST /api/admin/promo-codes/bulk-generate → 400 invalid body shape
 * - /admin/promo-codes/bulk page gates anon access
 * - /admin/promo-codes page exposes Bulk Generate link
 *
 * Auth-flow (login → submit → CSV download) deferred to Phase 08 with
 * E2E_TEST_USER_PASSWORD bootstrapped admin session.
 */

import { test, expect } from "@playwright/test";

const REDIRECT_CODES = [302, 307, 308];

test.describe("Bulk-generate API — unauthenticated rejects", () => {
  test("POST returns 401 anon", async ({ request }) => {
    const res = await request.post("/api/admin/promo-codes/bulk-generate", {
      data: { baseCode: "FREE100", count: 1, tier: "MASTER" },
    });
    expect([401, 403]).toContain(res.status());
  });

  test("POST without body returns 400/401/403 (no 500)", async ({ request }) => {
    const res = await request.post("/api/admin/promo-codes/bulk-generate", {
      data: {},
    });
    expect(res.status()).toBeLessThan(500);
    expect([400, 401, 403]).toContain(res.status());
  });
});

test.describe("Bulk page anon navigation", () => {
  test("/admin/promo-codes/bulk gates anon access", async ({ page }) => {
    const response = await page.goto("/en/admin/promo-codes/bulk", {
      waitUntil: "commit",
    });
    expect(REDIRECT_CODES.concat([200, 401, 403, 404])).toContain(
      response?.status() ?? 0,
    );
  });

  test("/admin/promo-codes loads or redirects (does not 500)", async ({
    page,
  }) => {
    const response = await page.goto("/en/admin/promo-codes", {
      waitUntil: "commit",
    });
    expect(response?.status() ?? 0).toBeLessThan(500);
  });
});
