/**
 * @vitest-environment node
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  fetchPilotHeyGenByokStatus,
  submitPilotHeyGenByokVideo,
} from '../pilot-heygen-byok-client';

describe('pilot-heygen-byok-client core hardening', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllGlobals();
  });

  it('rejects empty and >5000 char scripts pre-flight before calling HeyGen', async () => {
    await expect(
      submitPilotHeyGenByokVideo({
        userId: 'u_pf',
        apiKey: 'hg-key',
        script: '   ',
        title: 'Test',
      }),
    ).rejects.toThrow('HEYGEN_SCRIPT_EMPTY');

    await expect(
      submitPilotHeyGenByokVideo({
        userId: 'u_pf',
        apiKey: 'hg-key',
        script: 'a'.repeat(5001),
        title: 'Test',
      }),
    ).rejects.toThrow('HEYGEN_SCRIPT_TOO_LONG');
  });

  it('parses upstream error.code, retry-after, and request-id on HTTP failure', async () => {
    const mockFetch = vi.fn().mockResolvedValueOnce({
      ok: false,
      status: 429,
      headers: new Headers({
        'retry-after': '30',
        'x-heygen-request-id': 'req_99',
      }),
      json: () => Promise.resolve({ error: { code: 'rate_limit_exceeded' } }),
    });
    vi.stubGlobal('fetch', mockFetch);

    await expect(
      submitPilotHeyGenByokVideo({
        userId: 'u_err',
        apiKey: 'hg-key',
        script: 'Hello world script',
        title: 'Test',
      }),
    ).rejects.toThrow('HEYGEN_SUBMIT_HTTP_429:rate_limit_exceeded|retry_after=30|req=req_99');
  });

  it('keeps completed without video_url as recoverable processing (assetPending), recovers when video_url appears, and extracts detailed error object', async () => {
    const mockFetch = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ data: { status: 'completed' } }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            data: {
              status: 'completed',
              video_url: 'https://resource.heygen.ai/video/vid_1.mp4',
              duration: 42,
            },
          }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            data: {
              status: 'failed',
              error: { code: 'avatar_expired', message: 'Avatar retired', detail: 'Use v3' },
            },
          }),
      });
    vi.stubGlobal('fetch', mockFetch);

    const noUrl = await fetchPilotHeyGenByokStatus({
      userId: 'u_st',
      apiKey: 'hg-key',
      videoId: 'vid_1',
    });
    expect(noUrl.status).toBe('processing');
    expect(noUrl.assetPending).toBe(true);
    expect(noUrl.warningCode).toBe('HEYGEN_COMPLETED_ASSET_PENDING');

    const recovered = await fetchPilotHeyGenByokStatus({
      userId: 'u_st',
      apiKey: 'hg-key',
      videoId: 'vid_1',
    });
    expect(recovered.status).toBe('completed');
    expect(recovered.mediaUrl).toBe('https://resource.heygen.ai/video/vid_1.mp4');
    expect(recovered.durationSec).toBe(42);

    const detailedErr = await fetchPilotHeyGenByokStatus({
      userId: 'u_st',
      apiKey: 'hg-key',
      videoId: 'vid_2',
    });
    expect(detailedErr.status).toBe('failed');
    expect(detailedErr.errorMessage).toContain('avatar_expired');
    expect(detailedErr.errorMessage).toContain('Avatar retired');
  });
});
