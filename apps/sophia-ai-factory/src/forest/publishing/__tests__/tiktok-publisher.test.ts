import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const tiktokMocks = vi.hoisted(() => ({
  publishVideo: vi.fn(),
  checkPublishStatus: vi.fn(),
}));

vi.mock('@/seed/utils/logger-utility', () => ({
  logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn() },
}));

vi.mock('@/land/tiktok/tiktok-oauth-client', () => ({
  publishVideo: tiktokMocks.publishVideo,
  checkPublishStatus: tiktokMocks.checkPublishStatus,
}));

import { TikTokPublisher } from '@/land/video/publishing/providers/tiktok-publisher';

describe('TikTokPublisher', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.TIKTOK_CLIENT_KEY;
  });

  afterEach(() => {
    delete process.env.TIKTOK_CLIENT_KEY;
  });

  describe('upload — mock mode (no env)', () => {
    it('returns mock_tiktok_ id when TIKTOK_CLIENT_KEY absent', async () => {
      const publisher = new TikTokPublisher('tok');
      const id = await publisher.upload('https://example.com/v.mp4', {
        caption: 'test',
        hashtags: ['#ai'],
      });
      expect(id).toMatch(/^mock_tiktok_/);
      expect(tiktokMocks.publishVideo).not.toHaveBeenCalled();
    });

    it('pollStatus returns live for mock id', async () => {
      const publisher = new TikTokPublisher('tok');
      const status = await publisher.pollStatus('mock_tiktok_123');
      expect(status).toBe('live');
    });

    it('getMetrics returns zero metrics for mock id', async () => {
      const publisher = new TikTokPublisher('tok');
      const metrics = await publisher.getMetrics('mock_tiktok_123');
      expect(metrics.views).toBe(0);
      expect(metrics.likes).toBe(0);
    });
  });

  describe('getMetrics — real mode', () => {
    beforeEach(() => {
      process.env.TIKTOK_CLIENT_KEY = 'testkey';
    });

    it('returns zero metrics on API error', async () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch');
      fetchSpy.mockResolvedValueOnce(new Response('bad', { status: 500 }));
      const publisher = new TikTokPublisher('access_tok');
      const m = await publisher.getMetrics('pk_123');
      expect(m.views).toBe(0);
      expect(m.likes).toBe(0);
      expect(m.comments).toBe(0);
      expect(m.shares).toBe(0);
      fetchSpy.mockRestore();
    });

    it('returns zero metrics on publish complete (no separate count API)', async () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch');
      fetchSpy.mockResolvedValueOnce(
        new Response(
          JSON.stringify({ data: { status: 'PUBLISH_COMPLETE' } }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        ),
      );
      const publisher = new TikTokPublisher('access_tok');
      const m = await publisher.getMetrics('pk_123');
      expect(m.views).toBe(0); // TikTok API does not expose per-post counts via this endpoint
      expect(m.likes).toBe(0);
      fetchSpy.mockRestore();
    });

    it('returns zero metrics gracefully on network failure', async () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch');
      fetchSpy.mockRejectedValueOnce(new Error('network down'));
      const publisher = new TikTokPublisher('access_tok');
      const m = await publisher.getMetrics('pk_123');
      expect(m.views).toBe(0);
      fetchSpy.mockRestore();
    });
  });

  describe('upload — real mode (env set)', () => {
    beforeEach(() => {
      process.env.TIKTOK_CLIENT_KEY = 'testkey';
    });

    it('calls publishVideo and returns publish_id', async () => {
      tiktokMocks.publishVideo.mockResolvedValueOnce('pk_123');
      const publisher = new TikTokPublisher('access_tok');
      const id = await publisher.upload('https://example.com/v.mp4', {
        caption: 'hello world',
        hashtags: ['#ai'],
      });
      expect(id).toBe('pk_123');
      expect(tiktokMocks.publishVideo).toHaveBeenCalledWith(
        expect.objectContaining({ accessToken: 'access_tok' }),
      );
    });

    it('auth header passed via publishVideo call', async () => {
      tiktokMocks.publishVideo.mockResolvedValueOnce('pk_456');
      const publisher = new TikTokPublisher('Bearer_token_xyz');
      await publisher.upload('https://v.mp4', { caption: 'c', hashtags: [] });
      expect(tiktokMocks.publishVideo).toHaveBeenCalledWith(
        expect.objectContaining({ accessToken: 'Bearer_token_xyz' }),
      );
    });

    it('pollStatus maps PUBLISH_COMPLETE → live', async () => {
      tiktokMocks.checkPublishStatus.mockResolvedValueOnce({ status: 'PUBLISH_COMPLETE' });
      const publisher = new TikTokPublisher('tok');
      const s = await publisher.pollStatus('pk_123');
      expect(s).toBe('live');
    });

    it('pollStatus maps FAILED → failed', async () => {
      tiktokMocks.checkPublishStatus.mockResolvedValueOnce({ status: 'FAILED' });
      const publisher = new TikTokPublisher('tok');
      const s = await publisher.pollStatus('pk_123');
      expect(s).toBe('failed');
    });

    it('pollStatus returns processing for unknown status', async () => {
      tiktokMocks.checkPublishStatus.mockResolvedValueOnce({ status: 'IN_REVIEW' });
      const publisher = new TikTokPublisher('tok');
      const s = await publisher.pollStatus('pk_123');
      expect(s).toBe('processing');
    });
  });
});
