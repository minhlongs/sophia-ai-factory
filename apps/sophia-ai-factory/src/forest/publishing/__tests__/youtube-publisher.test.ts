import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Buffer } from 'node:buffer';

vi.mock('@/seed/utils/logger-utility', () => ({
  logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn() },
}));

import { YouTubePublisher } from '@/land/video/publishing/providers/youtube-publisher';

describe('YouTubePublisher', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    delete process.env.YOUTUBE_CLIENT_ID;
  });

  afterEach(() => {
    delete process.env.YOUTUBE_CLIENT_ID;
  });

  describe('mock mode', () => {
    it('returns mock_youtube_ id when YOUTUBE_CLIENT_ID absent', async () => {
      const publisher = new YouTubePublisher('tok');
      const result = await publisher.publish('https://v.mp4', {
        caption: 'caption',
        hashtags: ['#yt'],
      });
      expect(result.externalPostId).toMatch(/^mock_youtube_/);
      expect(result.success).toBe(true);
    });

    it('getStatus returns live for mock id', async () => {
      const publisher = new YouTubePublisher('tok');
      const s = await publisher.getStatus('mock_youtube_99');
      expect(s).toBe('live');
    });

    it('getMetrics returns zero metrics for mock id', async () => {
      const publisher = new YouTubePublisher('tok');
      const m = await publisher.getMetrics('mock_youtube_99');
      expect(m.views).toBe(0);
      expect(m.likes).toBe(0);
      expect(m.comments).toBe(0);
    });
  });

  describe('real mode', () => {
    beforeEach(() => {
      process.env.YOUTUBE_CLIENT_ID = 'yt_client_id';
    });

    it('sends Authorization header on upload init', async () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch');

      // Mock source video fetch
      fetchSpy.mockResolvedValueOnce(
        new Response(Buffer.from('videobytes'), {
          status: 200,
          headers: { 'Content-Type': 'video/mp4' },
        }),
      );
      // Mock init resumable upload → returns Location header
      fetchSpy.mockResolvedValueOnce(
        new Response(null, {
          status: 200,
          headers: { Location: 'https://upload.googleapis.com/resumable/123' },
        }),
      );
      // Mock actual upload
      fetchSpy.mockResolvedValueOnce(
        new Response(JSON.stringify({ id: 'yt_abc123' }), { status: 200 }),
      );

      const publisher = new YouTubePublisher('yt_access_token');
      const result = await publisher.publish('https://v.mp4', {
        caption: 'my video',
        hashtags: ['#ai'],
        title: 'Test Shorts',
      });

      expect(result).toEqual({ success: true, externalPostId: 'yt_abc123' });

      // Check Authorization header on the resumable init call (index 1)
      const initCall = fetchSpy.mock.calls[1];
      expect((initCall[1] as RequestInit)?.headers).toMatchObject({
        Authorization: 'Bearer yt_access_token',
      });

      fetchSpy.mockRestore();
    });

    it('getStatus returns processing for in-progress upload', async () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch');
      fetchSpy.mockResolvedValueOnce(
        new Response(
          JSON.stringify({ items: [{ id: 'yt_1', status: { uploadStatus: 'uploading' } }] }),
          { status: 200 },
        ),
      );

      const publisher = new YouTubePublisher('tok');
      const s = await publisher.getStatus('yt_1');
      expect(s).toBe('processing');
      fetchSpy.mockRestore();
    });

    it('getStatus returns live for processed video', async () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch');
      fetchSpy.mockResolvedValueOnce(
        new Response(
          JSON.stringify({ items: [{ id: 'yt_1', status: { uploadStatus: 'processed' } }] }),
          { status: 200 },
        ),
      );

      const publisher = new YouTubePublisher('tok');
      const s = await publisher.getStatus('yt_1');
      expect(s).toBe('live');
      fetchSpy.mockRestore();
    });
  });
});
