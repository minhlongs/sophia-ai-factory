import { describe, it, expect, vi, beforeEach } from 'vitest';
import { pollDidVideo, pollHeyGenVideo } from './video-generate-visual';
import * as circuitBreaker from '@/seed/security/circuit-breaker';
import * as userApiKeyStore from '@/tree/byok/user-api-key-store';
import * as didClient from '@/forest/did/did-client';
import * as heygenClientModule from '@/land/heygen/heygen-client';

describe('video-generate-visual — visual polling & circuit breaker hardening', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.restoreAllMocks();
  });

  describe('pollDidVideo', () => {
    it('returns null videoUrl immediately if circuit breaker is open', async () => {
      vi.spyOn(circuitBreaker, 'shouldAllowRequest').mockReturnValue(false);

      const sleep = vi.fn().mockResolvedValue(undefined);
      const res = await pollDidVideo('user-1', 'prompt', sleep);

      expect(res).toEqual({ videoUrl: null, provider: 'd-id' });
      expect(sleep).not.toHaveBeenCalled();
    });

    it('returns null videoUrl if no API key is found for user', async () => {
      vi.spyOn(circuitBreaker, 'shouldAllowRequest').mockReturnValue(true);
      vi.spyOn(userApiKeyStore, 'getUserApiKey').mockResolvedValue(null);

      const sleep = vi.fn().mockResolvedValue(undefined);
      const res = await pollDidVideo('user-1', 'prompt', sleep);

      expect(res).toEqual({ videoUrl: null, provider: 'd-id' });
    });

    it('polls and returns completed videoUrl when done', async () => {
      vi.spyOn(circuitBreaker, 'shouldAllowRequest').mockReturnValue(true);
      vi.spyOn(userApiKeyStore, 'getUserApiKey').mockResolvedValue('test-did-key');
      vi.spyOn(didClient, 'createDidTalk').mockResolvedValue({ id: 'talk-123' } as never);
      const recordSuccessSpy = vi.spyOn(circuitBreaker, 'recordSuccess').mockReturnValue({} as never);

      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ status: 'done', result_url: 'https://cdn.d-id.com/video.mp4' }),
      });
      vi.stubGlobal('fetch', fetchMock);

      const sleep = vi.fn().mockResolvedValue(undefined);
      const res = await pollDidVideo('user-1', 'prompt', sleep);

      expect(res).toEqual({ videoUrl: 'https://cdn.d-id.com/video.mp4', provider: 'd-id' });
      expect(recordSuccessSpy).toHaveBeenCalledWith('did');
      expect(sleep).toHaveBeenCalledWith('did-poll-0', expect.any(Number));
    });

    it('trips circuit breaker and breaks on non-ok HTTP responses', async () => {
      vi.spyOn(circuitBreaker, 'shouldAllowRequest').mockReturnValue(true);
      vi.spyOn(userApiKeyStore, 'getUserApiKey').mockResolvedValue('test-did-key');
      vi.spyOn(didClient, 'createDidTalk').mockResolvedValue({ id: 'talk-123' } as never);
      const recordFailureSpy = vi.spyOn(circuitBreaker, 'recordFailure').mockReturnValue({} as never);

      const fetchMock = vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        json: async () => ({ error: 'internal error' }),
      });
      vi.stubGlobal('fetch', fetchMock);

      const sleep = vi.fn().mockResolvedValue(undefined);
      const res = await pollDidVideo('user-1', 'prompt', sleep);

      expect(res).toEqual({ videoUrl: null, provider: 'd-id' });
      expect(recordFailureSpy).toHaveBeenCalledWith('did', expect.any(String));
    });
  });

  describe('pollHeyGenVideo', () => {
    it('returns null videoUrl when heygenClient is unavailable', async () => {
      vi.spyOn(heygenClientModule, 'getHeyGenClient').mockResolvedValue(null);

      const sleep = vi.fn().mockResolvedValue(undefined);
      const res = await pollHeyGenVideo('user-1', 'prompt', 'mission-1', sleep);

      expect(res).toEqual({ videoUrl: null, provider: 'heygen' });
    });

    it('polls and returns video URL upon completion', async () => {
      const mockClient = {
        createVideo: vi.fn().mockResolvedValue('heygen-video-456'),
        getVideoStatus: vi.fn().mockResolvedValue({
          status: 'completed',
          video_url: 'https://heygen.com/video.mp4',
        }),
      };
      vi.spyOn(heygenClientModule, 'getHeyGenClient').mockResolvedValue(mockClient as never);

      const sleep = vi.fn().mockResolvedValue(undefined);
      const res = await pollHeyGenVideo('user-1', 'prompt', 'mission-1', sleep);

      expect(res).toEqual({ videoUrl: 'https://heygen.com/video.mp4', provider: 'heygen' });
      expect(mockClient.createVideo).toHaveBeenCalled();
      expect(sleep).toHaveBeenCalledWith('heygen-poll-0', expect.any(Number));
    });
  });
});
