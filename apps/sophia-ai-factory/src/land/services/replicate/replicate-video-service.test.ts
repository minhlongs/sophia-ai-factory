import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  ReplicateVideoService,
  mapStatus,
  extractOutputUrl,
} from './replicate-video-service';
import { ProviderNetworkError } from '@/seed/services/errors';
import { reset } from '@/seed/security/circuit-breaker';

vi.mock('@/land/video/storage/r2-binding', () => ({
  getVideoBucket: vi.fn().mockResolvedValue(null),
}));

describe('ReplicateVideoService', () => {
  const service = new ReplicateVideoService({
    apiKey: 'test-replicate-key',
    baseUrl: 'https://api.replicate.com/v1',
    modelOwner: 'devxpy',
    modelName: 'wav2lip',
    timeoutMs: 5000,
  });

  beforeEach(() => {
    vi.restoreAllMocks();
    reset('replicate');
  });

  it('maps Replicate job statuses to VideoStatus correctly', () => {
    expect(mapStatus('starting')).toBe('processing');
    expect(mapStatus('processing')).toBe('processing');
    expect(mapStatus('succeeded')).toBe('completed');
    expect(mapStatus('failed')).toBe('failed');
    expect(mapStatus('canceled')).toBe('failed');
  });

  it('extracts output URL correctly from single string or array', () => {
    expect(extractOutputUrl({ id: '1', status: 'succeeded', output: 'https://video.mp4' })).toBe('https://video.mp4');
    expect(extractOutputUrl({ id: '1', status: 'succeeded', output: ['https://video1.mp4', 'https://video2.mp4'] })).toBe('https://video1.mp4');
    expect(extractOutputUrl({ id: '1', status: 'succeeded' })).toBeUndefined();
  });

  it('returns empty lists for avatars and voices', async () => {
    expect(await service.listAvatars()).toEqual([]);
    expect(await service.listVoices()).toEqual([]);
  });

  it('successfully creates a video prediction', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify({ id: 'pred-123', status: 'starting' }), {
        status: 201,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    const videoId = await service.createVideo({
      avatarId: 'https://face.jpg',
      voiceId: 'https://audio.mp3',
      script: 'Test script',
      title: 'Test video',
    });

    expect(videoId).toBe('pred-123');
  });

  it('handles 401 response and throws ProviderNetworkError', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify({ detail: 'Invalid API token' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    await expect(
      service.createVideo({
        avatarId: 'https://face.jpg',
        voiceId: 'https://audio.mp3',
        script: 'Test script',
      }),
    ).rejects.toThrow(ProviderNetworkError);
  });

  it('handles 429 response and throws ProviderNetworkError', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify({ detail: 'Rate limit exceeded' }), {
        status: 429,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    await expect(
      service.createVideo({
        avatarId: 'https://face.jpg',
        voiceId: 'https://audio.mp3',
        script: 'Test script',
      }),
    ).rejects.toThrow(ProviderNetworkError);
  });

  it('gets video status and maps to VideoStatus', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          id: 'pred-123',
          status: 'succeeded',
          output: 'https://replicate.delivery/output.mp4',
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        },
      ),
    );

    const status = await service.getVideoStatus('pred-123');
    expect(status.status).toBe('completed');
    expect(status.video_url).toBe('https://replicate.delivery/output.mp4');
  });
});
