/**
 * telegram-mock.ts — Playwright route interceptor for Telegram Bot API.
 *
 * Intercepts all calls to https://api.telegram.org/** and returns
 * a stub success response matching the real Bot API shape.
 *
 * Usage:
 *   import { mockTelegramBotApi } from './_fixtures/telegram-mock';
 *   await mockTelegramBotApi(page);
 *
 * Mirrors the response shape used by telegram-publisher.ts unit tests.
 */

import type { Page } from '@playwright/test';

export interface TelegramMockOptions {
  /** Chat ID to return in mock responses (default: '123456789') */
  chatId?: number;
  /** Username to return in mock responses (default: 'e2etestuser') */
  username?: string;
}

/**
 * Install a Playwright route handler for all Telegram Bot API calls.
 * Returns stub { ok: true, result: { message_id, chat } } for sendMessage / sendVideo.
 * Returns stub { ok: true, result: { id, username, type: 'private' } } for getChat.
 */
export async function mockTelegramBotApi(
  page: Page,
  opts: TelegramMockOptions = {},
): Promise<void> {
  const chatId = opts.chatId ?? 123_456_789;
  const username = opts.username ?? 'e2etestuser';

  await page.route('https://api.telegram.org/**', async (route) => {
    const url = route.request().url();

    // getChat → return chat info
    if (url.includes('/getChat')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          ok: true,
          result: {
            id: chatId,
            type: 'private',
            username,
            first_name: 'E2E',
            last_name: 'Test',
          },
        }),
      });
      return;
    }

    // sendMessage, sendVideo, sendPhoto, or any other Bot API method
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        ok: true,
        result: {
          message_id: 12_345,
          chat: {
            id: chatId,
            username,
            type: 'private',
            first_name: 'E2E',
          },
          date: Math.floor(Date.now() / 1000),
          text: '[e2e-mock]',
        },
      }),
    });
  });
}
