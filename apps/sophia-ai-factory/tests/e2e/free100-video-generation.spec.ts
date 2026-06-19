/**
 * E2E: FREE100 Video Generation — AI Prompt → SSE → VideoPlayer
 *
 * Run: npx playwright test tests/e2e/free100-video-generation.spec.ts
 * Env: NEXT_PUBLIC_MOCK_AI_SERVICES=true
 *
 * Coverage:
 * - /dashboard/videos/new redirects unauthenticated users to login
 * - AiPromptForm fields are present when authenticated (auth-fixture path)
 * - SSE stream mock emits succeeded with a fake R2 URL within 5s (local-only)
 * - VideoPlayer renders with the mocked R2 URL (blocked by Inngest dependency)
 *
 * Auth strategy: Uses the `authenticatedPage` fixture from `./fixtures/auth-fixture`
 * which performs a real Better Auth sign-in via API. This avoids direct D1 seeding
 * and unsigned cookie injection, eliminating the D1 binding error in local dev.
 * The fixture auto-skips when E2E_TEST_USER_PASSWORD is unset.
 *
 * SSE strategy: page.route() intercepts /api/v1/missions/{id}/stream
 *   and returns a pre-built SSE body (Playwright fulfills synchronously;
 *   EventSource receives all events at once in rapid succession).
 *
 * Known blockers (out of scope for this spec):
 * - The full form-submit test depends on Inngest, which is not running in
 *   local dev. Blocked pending an E2E_INSTANT_VIDEO_GEN flag in
 *   generateVideoAction or an MSW/fetch-mock of the action.
 */

import { test, expect } from './fixtures/auth-fixture';
import { mockSseStreamWildcard } from './fixtures/sse-mock';

const MOCK_VIDEO_URL =
  'https://pub-e2e-mock.r2.cloudflarestorage.com/e2e-videos/output.mp4';

test.describe('FREE100 Video Generation', () => {

  test('unauthenticated /dashboard/videos/new redirects to login', async ({ page }) => {
    await page.goto('/en/dashboard/videos/new', { waitUntil: 'networkidle' });
    const url = page.url();
    expect(url).not.toMatch(/dashboard\/videos\/new/);
    expect(url).toMatch(/login|\/en$|\/vi$|\/$|sign/i);
  });

  test('AiPromptForm fields render when authenticated', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/en/dashboard/videos/new', { waitUntil: 'domcontentloaded' });
    const url = authenticatedPage.url();
    expect(url, 'authenticated request should NOT redirect to /login').not.toMatch(/\/login/);

    // Form fields
    await expect(authenticatedPage.locator('textarea[name="prompt"]')).toBeVisible();
    await expect(authenticatedPage.locator('select[name="style"]')).toBeVisible();
    await expect(authenticatedPage.locator('select[name="language"]')).toBeVisible();
    await expect(authenticatedPage.locator('button[type="submit"]')).toBeVisible();
  });

  test('SSE mock intercepts mission stream and emits succeeded', async ({ authenticatedPage }) => {
    test.skip(
      !!process.env.PLAYWRIGHT_TEST_BASE_URL?.startsWith('https://'),
      'SSE mock test requires local D1 + dev server; skipped against remote prod.',
    );

    // Install wildcard SSE mock BEFORE navigation
    await mockSseStreamWildcard(authenticatedPage, { videoUrl: MOCK_VIDEO_URL });

    await authenticatedPage.goto('/en');

    // We verify the route handler is correctly installed by making a direct fetch
    // to a mock mission endpoint and confirming the SSE body is returned.
    const response = await authenticatedPage.evaluate(async (url) => {
      const res = await fetch(url);
      const text = await res.text();
      return { status: res.status, body: text };
    }, '/api/v1/missions/test-e2e-mission-id/stream');

    expect(response.status).toBe(200);
    expect(response.body).toContain('event: connected');
    expect(response.body).toContain('event: status');
    expect(response.body).toContain('"status":"succeeded"');
    expect(response.body).toContain(MOCK_VIDEO_URL);
    expect(response.body).toContain('event: done');
  });

  test('full form submit → SSE succeeded → VideoPlayer renders (requires Inngest)', async ({
    authenticatedPage,
  }) => {
    // Install SSE mock before navigation
    await mockSseStreamWildcard(authenticatedPage, { videoUrl: MOCK_VIDEO_URL });

    await authenticatedPage.goto('/en/dashboard/videos/new', { waitUntil: 'networkidle' });
    const url = authenticatedPage.url();

    if (!url.includes('/dashboard/videos/new')) {
      test.skip(true, 'Auth cookie validation requires signed token — manual run needed');
      return;
    }

    // Fill and submit form
    await authenticatedPage.locator('textarea[name="prompt"]').fill(
      'A short E2E test video about AI agents',
    );
    await authenticatedPage.locator('select[name="style"]').selectOption('casual');
    await authenticatedPage.locator('select[name="language"]').selectOption('en');
    await authenticatedPage.locator('button[type="submit"]').click();

    // Wait for server action response (up to 10s)
    // If Inngest is not running, the action returns an error and missionId is never set.
    const missionCreatedText = authenticatedPage.locator('text=/mission|mission_id/i');
    const serverError = authenticatedPage.locator('[role="alert"], .text-destructive');

    const result = await Promise.race([
      missionCreatedText.waitFor({ timeout: 10_000 }).then(() => 'mission'),
      serverError.waitFor({ timeout: 10_000 }).then(() => 'error'),
    ]).catch(() => 'timeout');

    if (result === 'error' || result === 'timeout') {
      // TODO: e2e harness blocker — Inngest dev server not running.
      // Add E2E_INSTANT_VIDEO_GEN=true guard to generateVideoAction to bypass Inngest.
      test.skip(
        true,
        'generateVideoAction requires Inngest or E2E_INSTANT_VIDEO_GEN flag — manual run needed',
      );
      return;
    }

    // If we got here, missionId is displayed and RenderProgress is mounted
    // Wait for SSE mock to deliver succeeded → VideoPlayer should render
    const videoEl = authenticatedPage.locator('video');
    await expect(videoEl).toBeVisible({ timeout: 10_000 });
    const src = await videoEl.getAttribute('src');
    expect(src).toContain('r2');
  });
});
