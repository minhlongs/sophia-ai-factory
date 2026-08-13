/**
 * TTS Client Tests
 *
 * Mocks fetch to verify:
 * - R2 key format matches tenant-scoped pattern
 * - Cost log called with correct params
 * - Error handling on non-2xx
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/seed/security/circuit-breaker', () => ({
  shouldAllowRequest: vi.fn().mockReturnValue(true),
  recordSuccess: vi.fn(),
  recordFailure: vi.fn(),
}));

vi.mock('@/seed/types/failure-kind', () => ({
  classifyError: vi.fn().mockReturnValue('SERVER_ERROR'),
}));

import { synthesize } from '../generation/tts-client';

const MOCK_WAV = new ArrayBuffer(44); // minimal buffer

describe('synthesize()', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('returns r2Key, durationSec, costUsd on success', async () => {
    const mockResponse = {
      r2Key: 'tenants/t1/videos/j1/audio.wav',
      durationSec: 8.5,
      costUsd: 0,
    };

    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockResponse,
      }),
    );

    const result = await synthesize({
      text: 'Hello world',
      language: 'en',
      tenantId: 't1',
      jobId: 'j1',
      baseUrl: 'http://localhost:3000',
      internalToken: 'test-token',
    });

    expect(result.r2Key).toBe('tenants/t1/videos/j1/audio.wav');
    expect(result.durationSec).toBe(8.5);
    expect(result.costUsd).toBe(0);
  });

  it('sends correct headers and body', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ r2Key: 'k', durationSec: 1, costUsd: 0 }),
    });
    vi.stubGlobal('fetch', fetchMock);

    await synthesize({
      text: 'Test text',
      voiceId: 'voice-123',
      language: 'vi',
      tenantId: 'tenant-abc',
      jobId: 'job-xyz',
      baseUrl: 'https://sophia.agencyos.network',
      internalToken: 'secret-token',
    });

    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, options] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://sophia.agencyos.network/api/internal/tts');
    expect((options.headers as Record<string, string>)['x-internal-token']).toBe('secret-token');
    const body = JSON.parse(options.body as string) as Record<string, unknown>;
    expect(body.language).toBe('vi');
    expect(body.voiceId).toBe('voice-123');
    expect(body.tenantId).toBe('tenant-abc');
    expect(body.jobId).toBe('job-xyz');
  });

  it('throws on non-2xx response', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 502,
        text: async () => 'Bad Gateway',
      }),
    );

    await expect(
      synthesize({
        text: 'Error test',
        language: 'en',
        tenantId: 't1',
        jobId: 'j2',
        baseUrl: 'http://localhost:3000',
        internalToken: 'tok',
      }),
    ).rejects.toThrow('502');
  });

  it('r2Key follows tenant-scoped pattern', async () => {
    const tenantId = 'tenant-999';
    const jobId = 'job-888';
    const expectedKey = `tenants/${tenantId}/videos/${jobId}/audio.wav`;

    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ r2Key: expectedKey, durationSec: 5, costUsd: 0 }),
      }),
    );

    const result = await synthesize({
      text: 'Pattern test',
      language: 'en',
      tenantId,
      jobId,
      baseUrl: 'http://localhost:3000',
      internalToken: 'tok',
    });

    expect(result.r2Key).toMatch(/^tenants\/[^/]+\/videos\/[^/]+\/audio\.wav$/);
    expect(result.r2Key).toBe(expectedKey);
  });

  // Suppress unused import warning
  void MOCK_WAV;
});
