/**
 * Unit tests for translateScript algorithm — covers empty input, BYOK
 * absence, OpenRouter non-2xx, empty response, and happy path with mocked
 * fetch (no real network).
 */
import { describe, it, expect, vi, beforeEach, afterAll } from 'vitest';

const { mockResolveUserApiKey } = vi.hoisted(() => ({
  mockResolveUserApiKey: vi.fn(),
}));

vi.mock('@/tree/byok/resolve-user-api-key', () => ({
  resolveUserApiKey: mockResolveUserApiKey,
  isByokEnabled: () => true,
}));

import {
  translateScript,
  TranslateConfigurationError,
} from '@/land/i18n/translate-script';
import { resetOpenRouterCircuit } from '@/seed/inference/openrouter-client';

const ORIGINAL_FETCH = globalThis.fetch;
const ORIGINAL_ENV = { ...process.env };

afterAll(() => {
  globalThis.fetch = ORIGINAL_FETCH;
  process.env = ORIGINAL_ENV;
});

function stubFetch(json: unknown, status = 200): void {
  globalThis.fetch = vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    headers: { get: () => null },
    text: async () => JSON.stringify(json),
    json: async () => json,
  }) as unknown as typeof globalThis.fetch;
}

describe('translateScript', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetOpenRouterCircuit();
    mockResolveUserApiKey.mockResolvedValue('user-or-key');
    delete process.env.OPENROUTER_API_KEY;
  });

  it('rejects empty text with EMPTY_TEXT', async () => {
    await expect(
      translateScript({ userId: 'u1', text: '   ', fromLang: 'en', toLang: 'vi' }),
    ).rejects.toBeInstanceOf(TranslateConfigurationError);
  });

  it('throws BYOK_REQUIRED when no key resolved', async () => {
    mockResolveUserApiKey.mockResolvedValue(null);
    try {
      await translateScript({ userId: 'u1', text: 'Hello world', fromLang: 'en', toLang: 'vi' });
      throw new Error('should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(TranslateConfigurationError);
      expect((err as TranslateConfigurationError).code).toBe('BYOK_REQUIRED');
    }
  });

  it('returns translated text + source=user on happy path', async () => {
    stubFetch({
      choices: [{ message: { content: 'Xin chào thế giới' } }],
    });
    const result = await translateScript({
      userId: 'u1',
      text: 'Hello world',
      fromLang: 'en',
      toLang: 'vi',
    });
    expect(result.translated).toBe('Xin chào thế giới');
    expect(result.source).toBe('user');
    expect(result.charsIn).toBe('Hello world'.length);
    expect(result.charsOut).toBeGreaterThan(0);
  });

  it('caps absurdly long input to MAX_INPUT_CHARS', async () => {
    stubFetch({ choices: [{ message: { content: 'truncated translation' } }] });
    const longText = 'a'.repeat(20000);
    const result = await translateScript({
      userId: 'u1',
      text: longText,
      fromLang: 'en',
      toLang: 'vi',
    });
    expect(result.charsIn).toBeLessThanOrEqual(8000);
  });

  it('marks source=platform when env key is used', async () => {
    process.env.OPENROUTER_API_KEY = 'env-key';
    mockResolveUserApiKey.mockResolvedValue('env-key'); // BYOK off case
    stubFetch({ choices: [{ message: { content: 'translated' } }] });
    const result = await translateScript({
      userId: 'u1',
      text: 'Hello',
      fromLang: 'en',
      toLang: 'vi',
    });
    expect(result.source).toBe('platform');
  });

  it('bubbles up non-2xx as Error', async () => {
    stubFetch({ error: 'invalid_request' }, 400);
    await expect(
      translateScript({ userId: 'u1', text: 'Hello', fromLang: 'en', toLang: 'vi' }),
    ).rejects.toThrow(/400/);
  }, 15000);

  it('rejects empty translation body', async () => {
    stubFetch({ choices: [{ message: { content: '   ' } }] });
    await expect(
      translateScript({ userId: 'u1', text: 'Hello', fromLang: 'en', toLang: 'vi' }),
    ).rejects.toThrow(/empty/i);
  });
});
