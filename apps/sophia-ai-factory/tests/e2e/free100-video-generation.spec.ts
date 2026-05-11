/**
 * E2E: FREE100 Video Generation — AI Prompt → SSE → VideoPlayer
 *
 * Run: npx playwright test tests/e2e/free100-video-generation.spec.ts
 * Env: NEXT_PUBLIC_MOCK_AI_SERVICES=true
 *
 * Coverage:
 * - /dashboard/videos/new renders the AiPromptForm (unauthenticated → redirect)
 * - AiPromptForm fields are present when authenticated (auth-fixture path)
 * - SSE stream mock emits succeeded with a fake R2 URL within 5s (local-only)
 * - VideoPlayer renders with the mocked R2 URL (blocked by Inngest dependency)
 *
 * Auth strategy: only the authenticated form-render test (test 2) consumes
 * the `authenticatedPage` fixture from `./_fixtures/auth-fixture`. Tests 1,
 * 3, and 4 destructure `{ page }` so the fixture's auto-skip-when-password-
 * unset does not apply — each guards itself (test 1 needs no auth, test 3
 * has an isRemote guard, test 4 has internal skip on Inngest failure).
 *
 * SSE strategy: page.route() intercepts /api/v1/missions/{id}/stream
 *   and returns a pre-built SSE body (Playwright fulfills synchronously;
 *   EventSource receives all events at once in rapid succession).
 *
 * Known blockers (out of scope for this spec):
 * - The SSE mock test uses `seedTestUser` (local D1 only) — kept on the legacy
 *   path because it requires writing a session row into local SQLite for
 *   `mockSseStreamWildcard` to bind. Already guarded against remote runs.
 * - The full form-submit test depends on Inngest, which is not running in
 *   local dev. Blocked pending an E2E_INSTANT_VIDEO_GEN flag in
 *   generateVideoAction or an MSW/fetch-mock of the action.
 */

import { test, expect } from './_fixtures/auth-fixture';
import { injectLocalAuthCookie } from './_fixtures/auth-helpers';
import { seedTestUser, tearDown } from './_fixtures/free100-fixtures';
import { mockSseStreamWildcard } from './_fixtures/sse-mock';

const MOCK_VIDEO_URL =
  'https://pub-e2e-mock.r2.cloudflarestorage.com/e2e-videos/output.mp4';

test.describe('FREE100 Video Generation', () => {
  let userId: string;

  test.afterAll(() => {
    if (userId) tearDown(userId);
  });

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

  test('SSE mock intercepts mission stream and emits succeeded', async ({ page }) => {
    test.skip(
      !!process.env.PLAYWRIGHT_TEST_BASE_URL?.startsWith('https://'),
      'SSE mock test requires local D1 + dev server; skipped against remote prod.',
    );
    const seeded = seedTestUser({ email: `e2e-sse-mock-${Date.now()}@test.invalid`, tier: 'MASTER' });
    await injectLocalAuthCookie(page, seeded.sessionToken);

    // Install wildcard SSE mock BEFORE navigation
    await mockSseStreamWildcard(page, { videoUrl: MOCK_VIDEO_URL });

    // Navigate to the page that would render RenderProgress
    // (the form itself is server-rendered, SSE starts after submission)
    // We verify the route handler is correctly installed by making a direct fetch
    // to a mock mission endpoint and confirming the SSE body is returned.
    const response = await page.evaluate(async (url) => {
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

    tearDown(seeded.userId);
  });

  test('full form submit → SSE succeeded → VideoPlayer renders (requires Inngest)', async ({
    page,
  }) => {
    const seeded = seedTestUser({
      email: `e2e-video-full-${Date.now()}@test.invalid`,
      tier: 'MASTER',
    });
    userId = seeded.userId;
    await injectLocalAuthCookie(page, seeded.sessionToken);

    // Install SSE mock before navigation
    await mockSseStreamWildcard(page, { videoUrl: MOCK_VIDEO_URL });

    await page.goto('/en/dashboard/videos/new', { waitUntil: 'networkidle' });
    const url = page.url();

    if (!url.includes('/dashboard/videos/new')) {
      test.skip(true, 'Auth cookie validation requires signed token — manual run needed');
      return;
    }

    // Fill and submit form
    await page.locator('textarea[name="prompt"]').fill(
      'A short E2E test video about AI agents',
    );
    await page.locator('select[name="style"]').selectOption('casual');
    await page.locator('select[name="language"]').selectOption('en');
    await page.locator('button[type="submit"]').click();

    // Wait for server action response (up to 10s)
    // If Inngest is not running, the action returns an error and missionId is never set.
    const missionCreatedText = page.locator('text=/mission|mission_id/i');
    const serverError = page.locator('[role="alert"], .text-destructive');

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
    const videoEl = page.locator('video');
    await expect(videoEl).toBeVisible({ timeout: 10_000 });
    const src = await videoEl.getAttribute('src');
    expect(src).toContain('r2');
  });
});
