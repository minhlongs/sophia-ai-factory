/**
 * FishSpeechClient Tests
 *
 * Covers:
 * - generateSpeech: successful generation returns audioUrl + durationSec
 * - generateSpeech: sends correct Authorization header (fal.ai Key format)
 * - generateSpeech: passes voice + language params
 * - Error: 429 rate limit
 * - Error: 402 payment required
 * - Error: 400 invalid input
 * - Error: missing audio URL in response
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { FishSpeechClient, FishSpeechClientError } from '../generation/fish-speech-client';

const TEST_API_KEY = 'fal_test_key_abc';

function makeClient(): FishSpeechClient {
  return new FishSpeechClient({ apiKey: TEST_API_KEY });
}

describe('FishSpeechClient.generateSpeech()', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('returns audioUrl and durationSec on success', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          audio: { url: 'https://fal.media/audio/output.mp3' },
          duration: 12.5,
        }),
      }),
    );

    const client = makeClient();
    const result = await client.generateSpeech({ text: 'Hello, world!' });

    expect(result.audioUrl).toBe('https://fal.media/audio/output.mp3');
    expect(result.durationSec).toBe(12.5);
  });

  it('sends Authorization: Key {apiKey} header', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ audio: { url: 'https://fal.media/x.mp3' }, duration: 3 }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const client = makeClient();
    await client.generateSpeech({ text: 'Test' });

    const [, options] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect((options.headers as Record<string, string>)['Authorization']).toBe(`Key ${TEST_API_KEY}`);
  });

  it('includes voice and language in request input', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ audio: { url: 'https://fal.media/x.mp3' }, duration: 4 }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const client = makeClient();
    await client.generateSpeech({ text: 'Xin chào', voice: 'vi-female', language: 'vi' });

    const [, options] = fetchMock.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(options.body as string) as { input: Record<string, unknown> };
    expect(body.input.voice).toBe('vi-female');
    expect(body.input.language).toBe('vi');
    expect(body.input.text).toBe('Xin chào');
  });

  it('returns durationSec=0 when duration absent in response', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ audio: { url: 'https://fal.media/a.mp3' } }),
      }),
    );

    const client = makeClient();
    const result = await client.generateSpeech({ text: 'No duration' });

    expect(result.durationSec).toBe(0);
  });

  it('throws FishSpeechClientError when audio URL missing', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ audio: {} }),
      }),
    );

    const client = makeClient();
    await expect(client.generateSpeech({ text: 'No URL' })).rejects.toThrow(FishSpeechClientError);
  });

  it('throws FishSpeechClientError(429) on rate limit', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 429,
        text: async () => 'Too many requests',
      }),
    );

    const client = makeClient();
    await expect(client.generateSpeech({ text: 'test' })).rejects.toMatchObject({ statusCode: 429 });
  });

  it('throws FishSpeechClientError(402) on payment required', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 402,
        text: async () => 'Credits exhausted',
      }),
    );

    const client = makeClient();
    await expect(client.generateSpeech({ text: 'test' })).rejects.toMatchObject({ statusCode: 402 });
  });

  it('throws FishSpeechClientError(400) on invalid input', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 400,
        text: async () => 'Invalid language code',
      }),
    );

    const client = makeClient();
    await expect(client.generateSpeech({ text: '' })).rejects.toMatchObject({ statusCode: 400 });
  });

  it('throws FishSpeechClientError for generic non-2xx', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        text: async () => 'Internal server error',
      }),
    );

    const client = makeClient();
    await expect(client.generateSpeech({ text: 'err' })).rejects.toMatchObject({ statusCode: 500 });
  });
});
