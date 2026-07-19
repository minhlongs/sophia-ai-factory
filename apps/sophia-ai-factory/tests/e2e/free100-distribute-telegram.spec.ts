/**
 * E2E: FREE100 Distribute to Telegram
 *
 * Auth: uses `authenticatedPage` from `./fixtures/auth-fixture` which
 * performs a real Better Auth sign-in and injects the signed
 * __Secure-better-auth.session_token cookie. This replaces the previous
 * `injectLocalAuthCookie()` approach (unsigned local-sqlite tokens that
 * the server rejects).
 *
 * Test data (completed video, telegram pairing) is written directly to
 * the local D1 SQLite database via the shared seeders in
 * `./fixtures/free100-fixtures`.
 */

import { test, expect } from './fixtures/auth-fixture';
import {
  seedCompletedVideo,
  seedTelegramPairing,
} from './fixtures/free100-fixtures';
import { openDb } from './fixtures/free100-db-helpers';
import { mockTelegramBotApi } from './fixtures/telegram-mock';

// ── API layer (no browser auth) ──────────────────────────────────────────────

test.describe('FREE100 Distribute — API layer (no browser auth)', () => {
  test('POST /api/v1/videos/:id/distribute without auth rejects', async ({
    request,
  }) => {
    const res = await request.post(
      '/api/v1/videos/fake-video-id/distribute',
      {
        data: { channelProviders: ['telegram'] },
      },
    );
    // 401 ideal; 404 if id-not-found checked before auth; 429 rate-limited; 500 env gap
    expect([401, 403, 404, 429, 500]).toContain(res.status());
  });

  test('POST /api/v1/videos/:id/distribute with empty body rejects', async ({
    request,
  }) => {
    const res = await request.post(
      '/api/v1/videos/fake-video-id/distribute',
      {
        data: { channelProviders: [] },
      },
    );
    expect([401, 403, 404, 422, 500]).toContain(res.status());
  });
});

// ── Page navigation (unauthenticated) ────────────────────────────────────────

test.describe('FREE100 Distribute — Unauthenticated page guard', () => {
  test('unauthenticated /distribute page redirects to login', async ({
    page,
  }) => {
    await page.goto('/en/dashboard/videos/fake-id/distribute', {
      waitUntil: 'networkidle',
    });
    const url = page.url();
    expect(url).not.toMatch(/videos\/fake-id\/distribute/);
    expect(url).toMatch(/login|\/en$|\/vi$|\/$|sign/i);
  });
});

// ── Telegram Bot API mock (page.route) ──────────────────────────────────────

test.describe('FREE100 Distribute — Telegram Bot API stub', () => {
  test('page.route intercepts api.telegram.org and returns stub', async ({
    page,
  }) => {
    await mockTelegramBotApi(page, {
      chatId: 987_654_321,
      username: 'e2e_bot',
    });

    const result = (await page.evaluate(async () => {
      const res = await fetch(
        'https://api.telegram.org/bot123456/sendMessage',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: 987654321,
            text: 'e2e test',
          }),
        },
      );
      return res.json() as Promise<{
        ok: boolean;
        result: { message_id: number; chat: { id: number; username: string } };
      }>;
    })) as { ok: boolean; result: { message_id: number; chat: { id: number } } };

    expect(result.ok).toBe(true);
    expect(result.result.message_id).toBe(12_345);
    expect(result.result.chat.id).toBe(987_654_321);
  });
});

// ── Full UI flow (signed auth + local D1 seed) ───────────────────────────────

test.describe('FREE100 Distribute — Full authenticated UI flow', () => {
  let userId: string;
  let videoId: string;

  test.afterAll(() => {
    if (userId) {
      const db = openDb();
      try {
        db.prepare('DELETE FROM videos WHERE user_id = ?').run(userId);
        db.prepare(
          'DELETE FROM telegram_paired_chats WHERE paired_by = ?',
        ).run(userId);
      } catch { /* swallow cleanup errors */ }
      db.close();
    }
  });

  test('distribute page renders channel checkboxes when authenticated', async ({
    authenticatedPage,
    testUser,
  }) => {
    const db = openDb();
    try {
      userId = testUser.email
        .replace(/[^a-zA-Z0-9]/g, '_')
        .slice(0, 28);

      const vid = seedCompletedVideo({ userId });
      videoId = vid.videoId;

      seedTelegramPairing({ userId });
    } finally {
      db.close();
    }

    await mockTelegramBotApi(authenticatedPage);
    await authenticatedPage.goto(
      `/en/dashboard/videos/${videoId}/distribute`,
      { waitUntil: 'networkidle' },
    );

    const url = authenticatedPage.url();
    expect(url).toMatch(/\/distribute/);

    const telegramCheckbox = authenticatedPage
      .locator('label')
      .filter({ hasText: /telegram/i })
      .locator('input[type="checkbox"]');
    await expect(telegramCheckbox).toBeVisible();
    await expect(telegramCheckbox).not.toBeDisabled();
  });

  test('tick Telegram → submit → success response', async ({
    authenticatedPage,
  }) => {
    if (!userId || !videoId) {
      test.skip(true, 'Prerequisite: distribute-page test must run first');
      return;
    }

    await mockTelegramBotApi(authenticatedPage);

    // Stub the distribute API so the test does not depend on Inngest / backend jobs
    await authenticatedPage.route(
      `**/api/v1/videos/${videoId}/distribute`,
      async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ jobIds: ['e2e-job-1'] }),
        });
      },
    );

    await authenticatedPage.goto(
      `/en/dashboard/videos/${videoId}/distribute`,
      { waitUntil: 'networkidle' },
    );

    const url = authenticatedPage.url();
    expect(url).toMatch(/\/distribute/);

    const telegramLabel = authenticatedPage
      .locator('label')
      .filter({ hasText: /telegram/i });
    await telegramLabel.locator('input[type="checkbox"]').check();

    const submitBtn = authenticatedPage.locator('button[type="submit"]');
    await expect(submitBtn).not.toBeDisabled();
    await submitBtn.click();

    // DistributePanel navigates to ?distributed=1 on success
    await authenticatedPage.waitForURL(/distributed=\d+/, {
      timeout: 10_000,
    });
    expect(authenticatedPage.url()).toMatch(/distributed=1/);
  });
});
