import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ReplicateVideoService, ReplicateClientError } from './replicate-video-service';
import { ProviderInvalidKeyError, ProviderQuotaExceededError, ProviderNetworkError } from '@/seed/services/errors';

function makeResponse(status: number, body: unknown, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', ...headers },
  }) as unknown as Response;
}

function buildService(timeoutMs = 5 * 60 * 1000): ReplicateVideoService {
  return new ReplicateVideoService({
    apiKey: 'r8_test-api-key-0000000000000000000000000000000000',
    timeoutMs,
  });
}

describe('ReplicateVideoService', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  describe('createVideo', () => {
    it('returns prediction ID on success', async () => {
      const service = buildService();
      const predictionId = 'pred-abc-123';
      vi.spyOn(globalThis, 'fetch').mockResolvedValue(
        makeResponse(201, { id: predictionId, status: 'starting' }),
      );

      const result = await service.createVideo({
        avatarId: 'https://example.com/face.png',
        voiceId: 'https://example.com/audio.mp3',
        title: 'test',
      });

      expect(result).toBe(predictionId);
      expect(globalThis.fetch).toHaveBeenCalledOnce();
    });

    it('throws invalid key on 401 Unauthorized', async () => {
      const service = buildService();
      vi.spyOn(globalThis, 'fetch').mockResolvedValue(
        makeResponse(401, { detail: 'Unauthorized' }),
      );

      await expect(
        service.createVideo({ avatarId: 'a.png', voiceId: 'b.mp3' }),
      ).rejects.toThrow(ProviderInvalidKeyError);
    });

    it('throws invalid key on 403 Forbidden', async () => {
      const service = buildService();
      vi.spyOn(globalThis, 'fetch').mockResolvedValue(
        makeResponse(403, { detail: 'Forbidden' }),
      );

      await expect(
        service.createVideo({ avatarId: 'a.png', voiceId: 'b.mp3' }),
      ).rejects.toThrow(ProviderInvalidKeyError);
    });

    it('throws quota exceeded on 402', async () => {
      const service = buildService();
      vi.spyOn(globalThis, 'fetch').mockResolvedValue(
        makeResponse(402, { detail: 'Insufficient credits' }),
      );

      await expect(
        service.createVideo({ avatarId: 'a.png', voiceId: 'b.mp3' }),
      ).rejects.toThrow(ProviderQuotaExceededError);
    });

    it('throws quota exceeded on 429', async () => {
      const service = buildService();
      vi.spyOn(globalThis, 'fetch').mockResolvedValue(
        makeResponse(429, { detail: 'Rate limited' }),
      );

      await expect(
        service.createVideo({ avatarId: 'a.png', voiceId: 'b.mp3' }),
      ).rejects.toThrow(ProviderQuotaExceededError);
    });

    it('handles timeout correctly (uses real timers — AbortController requires native setTimeout)', async () => {
      const service = buildService(100);
      vi.spyOn(globalThis, 'fetch').mockImplementation(
        (_url: string, init?: RequestInit): Promise<Response> => {
          const signal = init?.signal as AbortSignal | undefined;
          return new Promise<Response>((resolve, reject) => {
            const timer = setTimeout(
              () => resolve(makeResponse(200, { id: 'pred', status: 'starting' })),
              5000,
            );
            signal?.addEventListener('abort', () => {
              clearTimeout(timer);
              reject(new DOMException('The user aborted a request.', 'AbortError'));
            });
          });
        },
      );

      await expect(
        service.createVideo({ avatarId: 'a.png', voiceId: 'b.mp3' }),
      ).rejects.toThrow(/timeout/i);
    });
  });

  describe('getVideoStatus', () => {
    it('returns status with correct mapping', async () => {
      const service = buildService();
      vi.spyOn(globalThis, 'fetch').mockResolvedValue(
        makeResponse(200, { id: 'pred-1', status: 'succeeded', output: 'https://r2.example.com/x.mp4' }),
      );

      const result = await service.getVideoStatus('pred-1');

      expect(result.status).toBe('completed');
      expect(result.video_url).toBe('https://r2.example.com/x.mp4');
    });

    it('maps failed status', async () => {
      const service = buildService();
      vi.spyOn(globalThis, 'fetch').mockResolvedValue(
        makeResponse(200, { id: 'pred-1', status: 'failed', error: 'Model error' }),
      );

      const result = await service.getVideoStatus('pred-1');

      expect(result.status).toBe('failed');
      expect(result.error).toBe('Model error');
    });
  });
});
