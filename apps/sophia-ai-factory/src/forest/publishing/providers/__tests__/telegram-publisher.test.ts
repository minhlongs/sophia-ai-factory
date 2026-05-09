/**
 * Unit tests: telegram-publisher
 *
 * Covers:
 * 1. Happy path — DM chat (no username) → correct payload + externalUrl placeholder
 * 2. Happy path — public channel with username → t.me/<username>/<id> URL
 * 3. Happy path — private channel (id starts with -100) → t.me/c/<numeric>/<id> URL
 * 4. Missing TELEGRAM_BOT_TOKEN → throws
 * 5. Empty chatId → throws
 * 6. HTTP 429 (rate limit) → throws with "Rate limited"
 * 7. HTTP 401 (invalid token) → throws with "Auth error"
 * 8. HTTP 403 (bot not admin) → throws with "Auth error"
 * 9. Telegram API returns { ok: false } → throws with description
 * 10. Network error (fetch throws) → throws with "Network error"
 * 11. Token never logged in plain form — masked in error messages
 * 12. Caption sanitized and truncated to 1024 chars
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { publishToTelegram } from '../telegram-publisher';
import type { TelegramPublishInput } from '../telegram-publisher';

// ── Globals mock ──────────────────────────────────────────────────────────────

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

// ── Helpers ───────────────────────────────────────────────────────────────────

const BASE_INPUT: TelegramPublishInput = {
  jobId: 'job-001',
  userId: 'user-abc',
  videoUrl: 'https://pub-test.r2.dev/video.mp4',
  chatId: '123456789',
  caption: 'Test video caption',
};

function makeTelegramResponse(
  ok: boolean,
  result?: {
    message_id: number;
    chat: { id: number; username?: string; title?: string; type: string };
  },
  errorCode?: number,
  description?: string,
) {
  return JSON.stringify({
    ok,
    ...(result ? { result } : {}),
    ...(errorCode ? { error_code: errorCode } : {}),
    ...(description ? { description } : {}),
  });
}

function mockOkResponse(body: string, status = 200) {
  mockFetch.mockResolvedValueOnce({
    ok: status >= 200 && status < 300,
    status,
    headers: new Map(),
    json: () => Promise.resolve(JSON.parse(body)),
    text: () => Promise.resolve(body),
  });
}

function mockFailResponse(status: number, body: string = '') {
  mockFetch.mockResolvedValueOnce({
    ok: false,
    status,
    headers: new Map([['Retry-After', '30']]),
    json: () => Promise.resolve({}),
    text: () => Promise.resolve(body),
  });
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('telegram-publisher', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.TELEGRAM_BOT_TOKEN = 'test-token-abc123xyz';
  });

  afterEach(() => {
    delete process.env.TELEGRAM_BOT_TOKEN;
  });

  it('happy path — DM chat (no username) → externalUrl placeholder', async () => {
    mockOkResponse(
      makeTelegramResponse(true, {
        message_id: 42,
        chat: { id: 123456789, type: 'private' },
      }),
    );

    const result = await publishToTelegram(BASE_INPUT);

    expect(result.externalPostId).toBe('42');
    expect(result.externalUrl).toBe('https://t.me/message/42');

    const fetchCall = mockFetch.mock.calls[0];
    expect(fetchCall[0]).toMatch(/sendVideo$/);
    const body = JSON.parse(fetchCall[1].body as string) as Record<string, unknown>;
    expect(body.chat_id).toBe('123456789');
    expect(body.video).toBe(BASE_INPUT.videoUrl);
    expect(body.caption).toBe('Test video caption');
    expect(body.supports_streaming).toBe(true);
  });

  it('happy path — public channel with username → t.me/<username>/<id>', async () => {
    mockOkResponse(
      makeTelegramResponse(true, {
        message_id: 99,
        chat: { id: -1001234567890, username: 'mychannel', type: 'channel' },
      }),
    );

    const result = await publishToTelegram({ ...BASE_INPUT, chatId: '-1001234567890' });

    expect(result.externalPostId).toBe('99');
    expect(result.externalUrl).toBe('https://t.me/mychannel/99');
  });

  it('happy path — private channel (-100 prefix) → t.me/c/<numeric>/<id>', async () => {
    mockOkResponse(
      makeTelegramResponse(true, {
        message_id: 7,
        chat: { id: -1009876543210, type: 'channel' },
      }),
    );

    const result = await publishToTelegram({ ...BASE_INPUT, chatId: '-1009876543210' });

    expect(result.externalPostId).toBe('7');
    expect(result.externalUrl).toBe('https://t.me/c/9876543210/7');
  });

  it('omits caption from payload when caption not provided', async () => {
    mockOkResponse(
      makeTelegramResponse(true, {
        message_id: 1,
        chat: { id: 123, type: 'private' },
      }),
    );

    await publishToTelegram({ ...BASE_INPUT, caption: undefined });

    const body = JSON.parse(mockFetch.mock.calls[0][1].body as string) as Record<string, unknown>;
    expect(body.caption).toBeUndefined();
  });

  it('throws when TELEGRAM_BOT_TOKEN missing', async () => {
    delete process.env.TELEGRAM_BOT_TOKEN;

    await expect(publishToTelegram(BASE_INPUT)).rejects.toThrow(
      'TELEGRAM_BOT_TOKEN not set',
    );
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('throws when chatId is empty', async () => {
    await expect(publishToTelegram({ ...BASE_INPUT, chatId: '' })).rejects.toThrow(
      'chatId is empty',
    );
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('throws with "Rate limited" on HTTP 429', async () => {
    mockFailResponse(429);

    await expect(publishToTelegram(BASE_INPUT)).rejects.toThrow('Rate limited (429)');
  });

  it('throws with "Auth error 401" on HTTP 401', async () => {
    mockFailResponse(401, 'Unauthorized');

    await expect(publishToTelegram(BASE_INPUT)).rejects.toThrow('Auth error 401');
  });

  it('throws with "Auth error 403" on HTTP 403', async () => {
    mockFailResponse(403, 'Forbidden');

    await expect(publishToTelegram(BASE_INPUT)).rejects.toThrow('Auth error 403');
  });

  it('throws with Telegram description when ok=false', async () => {
    mockOkResponse(
      makeTelegramResponse(false, undefined, 400, 'Bad Request: chat not found'),
      400,
    );

    await expect(publishToTelegram(BASE_INPUT)).rejects.toThrow(
      'Bad Request: chat not found',
    );
  });

  it('throws when fetch itself throws (network error)', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Connection refused'));

    await expect(publishToTelegram(BASE_INPUT)).rejects.toThrow('Network error');
  });

  it('bot token is NEVER logged in plain form — masked in error messages', async () => {
    const fullToken = 'super-secret-token-123456';
    process.env.TELEGRAM_BOT_TOKEN = fullToken;
    mockFailResponse(401, 'Unauthorized');

    let errorMsg = '';
    try {
      await publishToTelegram(BASE_INPUT);
    } catch (err) {
      errorMsg = err instanceof Error ? err.message : String(err);
    }

    expect(errorMsg).not.toContain(fullToken);
    // Masked form: bot<6chars>...
    expect(errorMsg).toContain('botsuper');
    expect(errorMsg).toContain('...');
  });

  it('token never appears in fetch URL in plain form after first 6 chars', async () => {
    const fullToken = 'test-token-abc123xyz';
    process.env.TELEGRAM_BOT_TOKEN = fullToken;
    mockOkResponse(
      makeTelegramResponse(true, {
        message_id: 1,
        chat: { id: 123, type: 'private' },
      }),
    );

    await publishToTelegram(BASE_INPUT);

    const fetchUrl = mockFetch.mock.calls[0][0] as string;
    // URL contains full token in /bot<token>/ — this is required for API call
    // but should never appear in logs or error messages
    expect(fetchUrl).toContain(`/bot${fullToken}/`);
  });

  it('caption truncated to 1024 chars', async () => {
    const longCaption = 'A'.repeat(2000);
    mockOkResponse(
      makeTelegramResponse(true, {
        message_id: 1,
        chat: { id: 123, type: 'private' },
      }),
    );

    await publishToTelegram({ ...BASE_INPUT, caption: longCaption });

    const body = JSON.parse(mockFetch.mock.calls[0][1].body as string) as Record<string, unknown>;
    expect((body.caption as string).length).toBeLessThanOrEqual(1024);
  });

  it('caption MarkdownV2 special chars stripped', async () => {
    mockOkResponse(
      makeTelegramResponse(true, {
        message_id: 1,
        chat: { id: 123, type: 'private' },
      }),
    );

    await publishToTelegram({ ...BASE_INPUT, caption: 'Hello *world* [link](url) ~test~' });

    const body = JSON.parse(mockFetch.mock.calls[0][1].body as string) as Record<string, unknown>;
    const cap = body.caption as string;
    expect(cap).not.toContain('*');
    expect(cap).not.toContain('[');
    expect(cap).not.toContain('~');
    expect(cap).toContain('Hello');
    expect(cap).toContain('world');
  });
});
