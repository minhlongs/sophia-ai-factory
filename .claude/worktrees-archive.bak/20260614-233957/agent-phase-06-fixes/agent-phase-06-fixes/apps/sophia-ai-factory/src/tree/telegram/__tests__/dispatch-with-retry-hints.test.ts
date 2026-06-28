/**
 * Unit tests: dispatch-with-retry-hints
 *
 * Wave 19 Phase 05 (M2). Verifies error classification for Inngest retry hints:
 *  - Success returns publisher result unchanged
 *  - 429 → plain Error with `cause.retryAfterSec`
 *  - 4xx (not 429) → NonRetriableError
 *  - 5xx → plain Error
 *  - Network error → plain Error
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NonRetriableError, RetryAfterError } from 'inngest';
import { dispatchTelegramWithRetryHints } from '../dispatch-with-retry-hints';
import type { TelegramPublishInput } from '@/forest/publishing/providers/telegram-publisher';

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

const BASE_INPUT: TelegramPublishInput = {
  jobId: 'job-001',
  userId: 'user-abc',
  videoUrl: 'https://pub-test.r2.dev/video.mp4',
  chatId: '123456789',
  caption: 'Test caption',
};

function mockTelegramResponse(opts: { status: number; body?: unknown; headers?: Record<string, string> }) {
  const bodyStr = opts.body == null ? '' : typeof opts.body === 'string' ? opts.body : JSON.stringify(opts.body);
  mockFetch.mockResolvedValueOnce({
    ok: opts.status >= 200 && opts.status < 300,
    status: opts.status,
    headers: new Map(Object.entries(opts.headers ?? {})),
    json: () => Promise.resolve(opts.body && typeof opts.body !== 'string' ? opts.body : JSON.parse(bodyStr || '{}')),
    text: () => Promise.resolve(bodyStr),
  });
}

describe('dispatchTelegramWithRetryHints', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.TELEGRAM_BOT_TOKEN = 'test-token-abc123xyz';
  });

  afterEach(() => {
    delete process.env.TELEGRAM_BOT_TOKEN;
  });

  it('200 success → returns publisher result', async () => {
    mockTelegramResponse({
      status: 200,
      body: {
        ok: true,
        result: { message_id: 42, chat: { id: 123456789, type: 'private' } },
      },
    });

    const result = await dispatchTelegramWithRetryHints(BASE_INPUT);

    expect(result.externalPostId).toBe('42');
    expect(result.externalUrl).toBe('https://t.me/message/42');
  });

  it('429 with body parameters.retry_after → RetryAfterError honoring body retry_after', async () => {
    mockTelegramResponse({
      status: 429,
      body: { ok: false, error_code: 429, parameters: { retry_after: 5 } },
      headers: { 'Retry-After': '60' },
    });

    let caught: Error | null = null;
    try {
      await dispatchTelegramWithRetryHints(BASE_INPUT);
    } catch (err) {
      caught = err as Error;
    }

    expect(caught).toBeInstanceOf(RetryAfterError);
    expect(caught).not.toBeInstanceOf(NonRetriableError);
    const cause = (caught as Error & { cause?: { retryAfterSec?: number; status?: number } }).cause;
    expect(cause?.retryAfterSec).toBe(5); // body parameters.retry_after wins over header
    expect(cause?.status).toBe(429);
    expect(caught?.message).toContain('Rate limited (429)');
  });

  it('429 with header only → RetryAfterError using header value', async () => {
    mockTelegramResponse({
      status: 429,
      body: 'plain text not json',
      headers: { 'Retry-After': '30' },
    });

    let caught: Error | null = null;
    try {
      await dispatchTelegramWithRetryHints(BASE_INPUT);
    } catch (err) {
      caught = err as Error;
    }

    expect(caught).toBeInstanceOf(RetryAfterError);
    const cause = (caught as Error & { cause?: { retryAfterSec?: number } }).cause;
    expect(cause?.retryAfterSec).toBe(30);
  });

  it('400 invalid chat → NonRetriableError', async () => {
    mockTelegramResponse({
      status: 400,
      body: { ok: false, error_code: 400, description: 'Bad Request: chat not found' },
    });

    let caught: Error | null = null;
    try {
      await dispatchTelegramWithRetryHints(BASE_INPUT);
    } catch (err) {
      caught = err as Error;
    }

    expect(caught).toBeInstanceOf(NonRetriableError);
    expect(caught?.message).toContain('chat not found');
  });

  it('401 invalid token → NonRetriableError', async () => {
    mockTelegramResponse({ status: 401, body: 'Unauthorized' });

    let caught: Error | null = null;
    try {
      await dispatchTelegramWithRetryHints(BASE_INPUT);
    } catch (err) {
      caught = err as Error;
    }

    expect(caught).toBeInstanceOf(NonRetriableError);
    expect(caught?.message).toContain('Auth error 401');
  });

  it('503 service unavailable → plain Error (retryable)', async () => {
    mockTelegramResponse({
      status: 503,
      body: { ok: false, error_code: 503, description: 'Service Unavailable' },
    });

    let caught: Error | null = null;
    try {
      await dispatchTelegramWithRetryHints(BASE_INPUT);
    } catch (err) {
      caught = err as Error;
    }

    expect(caught).toBeInstanceOf(Error);
    expect(caught).not.toBeInstanceOf(NonRetriableError);
    expect(caught?.message).toContain('Service Unavailable');
  });

  it('network error (fetch throws) → plain Error', async () => {
    mockFetch.mockRejectedValueOnce(new Error('ECONNREFUSED'));

    let caught: Error | null = null;
    try {
      await dispatchTelegramWithRetryHints(BASE_INPUT);
    } catch (err) {
      caught = err as Error;
    }

    expect(caught).toBeInstanceOf(Error);
    expect(caught).not.toBeInstanceOf(NonRetriableError);
    expect(caught?.message).toContain('Network error');
  });

  it('does NOT log bot token in plain form on 429', async () => {
    process.env.TELEGRAM_BOT_TOKEN = 'super-secret-full-token-99999';
    mockTelegramResponse({
      status: 429,
      body: { ok: false, error_code: 429, parameters: { retry_after: 5 } },
    });

    let errorMsg = '';
    try {
      await dispatchTelegramWithRetryHints(BASE_INPUT);
    } catch (err) {
      errorMsg = err instanceof Error ? err.message : String(err);
    }

    expect(errorMsg).not.toContain('super-secret-full-token-99999');
    expect(errorMsg).toContain('botsuper'); // masked form
  });
});
