/**
 * Unit tests for cloneVoice algorithm — validation guards, BYOK absence,
 * upstream failures, and happy path with mocked fetch (no real network).
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
  cloneVoice,
  validateCloneInput,
  VoiceCloneConfigurationError,
} from '@/land/voice/clone-voice';

const ORIGINAL_FETCH = globalThis.fetch;
const ORIGINAL_ENV = { ...process.env };
afterAll(() => {
  globalThis.fetch = ORIGINAL_FETCH;
  process.env = ORIGINAL_ENV;
});

function makeBlob(size: number): Blob {
  // Use real Blob backed by a typed array so jsdom FormData accepts it.
  return new Blob([new Uint8Array(size)], { type: 'audio/mpeg' });
}

function stubFetchSequence(steps: Array<{ ok: boolean; status?: number; body?: unknown; blobSize?: number }>): void {
  let i = 0;
  globalThis.fetch = vi.fn().mockImplementation(async () => {
    const step = steps[i++] ?? steps[steps.length - 1];
    return {
      ok: step.ok,
      status: step.status ?? (step.ok ? 200 : 500),
      blob: async () => makeBlob(step.blobSize ?? 1024),
      json: async () => step.body ?? {},
      text: async () => JSON.stringify(step.body ?? {}),
    } as unknown as Response;
  }) as unknown as typeof globalThis.fetch;
}

describe('validateCloneInput', () => {
  it('rejects empty name', () => {
    expect(() => validateCloneInput({ userId: 'u1', name: '', audioUrls: ['x'] })).toThrow(VoiceCloneConfigurationError);
  });
  it('rejects empty audio list', () => {
    expect(() => validateCloneInput({ userId: 'u1', name: 'Bob', audioUrls: [] })).toThrow(/at least one/i);
  });
  it('rejects > 25 samples', () => {
    expect(() =>
      validateCloneInput({
        userId: 'u1',
        name: 'Bob',
        audioUrls: Array.from({ length: 26 }, (_, i) => `https://x.com/${i}.mp3`),
      }),
    ).toThrow(/max 25/i);
  });
  it('accepts minimal valid input', () => {
    expect(() =>
      validateCloneInput({ userId: 'u1', name: 'Bob', audioUrls: ['https://x.com/a.mp3'] }),
    ).not.toThrow();
  });
});

describe('cloneVoice', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockResolveUserApiKey.mockResolvedValue('user-eleven-key');
    delete process.env.ELEVENLABS_API_KEY;
  });

  it('throws BYOK_REQUIRED when no key resolved', async () => {
    mockResolveUserApiKey.mockResolvedValue(null);
    try {
      await cloneVoice({ userId: 'u1', name: 'Bob', audioUrls: ['https://x.com/a.mp3'] });
      throw new Error('should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(VoiceCloneConfigurationError);
      expect((err as VoiceCloneConfigurationError).code).toBe('BYOK_REQUIRED');
    }
  });

  it('returns voiceId on happy path', async () => {
    stubFetchSequence([
      { ok: true, blobSize: 50_000 },                                  // sample download
      { ok: true, body: { voice_id: 'v_abc123' } },                    // ElevenLabs add
    ]);
    const result = await cloneVoice({
      userId: 'u1',
      name: 'Tho voice',
      audioUrls: ['https://r2.example/sample.mp3'],
      description: 'My main voice',
    });
    expect(result.voiceId).toBe('v_abc123');
    expect(result.name).toBe('Tho voice');
    expect(result.samplesUploaded).toBe(1);
    expect(result.source).toBe('user');
  });

  it('marks source=platform when env key used', async () => {
    process.env.ELEVENLABS_API_KEY = 'env-key';
    mockResolveUserApiKey.mockResolvedValue('env-key');
    stubFetchSequence([
      { ok: true, blobSize: 1000 },
      { ok: true, body: { voice_id: 'v_env' } },
    ]);
    const result = await cloneVoice({
      userId: 'u1',
      name: 'Bot voice',
      audioUrls: ['https://r2.example/a.mp3'],
    });
    expect(result.source).toBe('platform');
  });

  it('rejects sample > 11 MB with SAMPLE_TOO_LARGE', async () => {
    stubFetchSequence([{ ok: true, blobSize: 12 * 1024 * 1024 }]);
    try {
      await cloneVoice({ userId: 'u1', name: 'Big', audioUrls: ['https://x.com/big.mp3'] });
      throw new Error('should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(VoiceCloneConfigurationError);
      expect((err as VoiceCloneConfigurationError).code).toBe('SAMPLE_TOO_LARGE');
    }
  });

  it('bubbles up ElevenLabs non-2xx', async () => {
    stubFetchSequence([
      { ok: true, blobSize: 1000 },
      { ok: false, status: 400, body: { detail: { message: 'voice name taken' } } },
    ]);
    await expect(
      cloneVoice({ userId: 'u1', name: 'Dup', audioUrls: ['https://x.com/a.mp3'] }),
    ).rejects.toThrow(/400/);
  });

  it('rejects empty voice_id response', async () => {
    stubFetchSequence([
      { ok: true, blobSize: 1000 },
      { ok: true, body: {} },
    ]);
    await expect(
      cloneVoice({ userId: 'u1', name: 'Empty', audioUrls: ['https://x.com/a.mp3'] }),
    ).rejects.toThrow(/no voice_id/i);
  });
});
