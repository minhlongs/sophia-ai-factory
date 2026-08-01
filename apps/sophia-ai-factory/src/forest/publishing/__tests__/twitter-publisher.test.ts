import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { TwitterPublisher } from '@/land/video/publishing/providers/twitter-publisher';

vi.mock('@/seed/utils/logger-utility', () => ({
  logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn() },
}));

describe('TwitterPublisher', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    delete process.env.TWITTER_CLIENT_ID;
  });

  afterEach(() => {
    delete process.env.TWITTER_CLIENT_ID;
  });

  describe('mock mode', () => {
    it('returns mock_twitter_ id when TWITTER_CLIENT_ID absent', async () => {
      const publisher = new TwitterPublisher('tok');
      const id = await publisher.publish('https://v.mp4', { caption: 'hi', hashtags: ['#x'] });
      expect(id.externalPostId).toMatch(/^mock_twitter_/);
    });

    it('pollStatus returns live for mock id', async () => {
      const publisher = new TwitterPublisher('tok');
      expect(await publisher.getStatus('mock_twitter_99')).toBe('live');
    });

    it('getMetrics returns zero metrics for mock id', async () => {
      const publisher = new TwitterPublisher('tok');
      const m = await publisher.getMetrics('mock_twitter_99');
      expect(m.views).toBe(0);
      expect(m.likes).toBe(0);
    });
  });

  describe('real mode', () => {
    beforeEach(() => {
      process.env.TWITTER_CLIENT_ID = 'x_client_id';
    });

    it('runs INIT/APPEND/FINALIZE then creates tweet', async () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch');
      // Step: fetch video (1MB)
      const buf = new ArrayBuffer(1024 * 1024);
      fetchSpy.mockResolvedValueOnce(new Response(buf, { status: 200 }));
      // INIT
      fetchSpy.mockResolvedValueOnce(
        new Response(JSON.stringify({ data: { id: 'media_42' } }), { status: 200 }),
      );
      // APPEND chunk 0
      fetchSpy.mockResolvedValueOnce(new Response('', { status: 200 }));
      // FINALIZE
      fetchSpy.mockResolvedValueOnce(new Response('', { status: 200 }));
      // Create tweet
      fetchSpy.mockResolvedValueOnce(
        new Response(JSON.stringify({ data: { id: 'tweet_999' } }), { status: 201 }),
      );

      const publisher = new TwitterPublisher('access_token');
      const id = await publisher.publish('https://v.mp4', {
        caption: 'short caption',
        hashtags: ['#ai'],
      });

      expect(id.externalPostId).toBe('tweet_999');
      // 1 video fetch + 1 INIT + 1 APPEND + 1 FINALIZE + 1 tweet
      expect(fetchSpy.mock.calls.length).toBeGreaterThanOrEqual(5);

      // Verify INIT URL
      const initUrl = fetchSpy.mock.calls[1][0] as string;
      expect(initUrl).toContain('/2/media/upload');

      fetchSpy.mockRestore();
    });

    it('throws when tweet creation fails', async () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch');
      const buf = new ArrayBuffer(1024);
      fetchSpy.mockResolvedValueOnce(new Response(buf, { status: 200 }));
      fetchSpy.mockResolvedValueOnce(
        new Response(JSON.stringify({ data: { id: 'm' } }), { status: 200 }),
      );
      fetchSpy.mockResolvedValueOnce(new Response('', { status: 200 }));
      fetchSpy.mockResolvedValueOnce(new Response('', { status: 200 }));
      fetchSpy.mockResolvedValueOnce(new Response('rate_limited', { status: 429 }));

      const publisher = new TwitterPublisher('tok');
      const _errResult = await publisher.publish('https://v.mp4', { caption: 'test', hashtags: [] });
    expect(_errResult.success).toBe(false);
    expect(_errResult.error).toMatch('X /2/tweets failed');
      fetchSpy.mockRestore();
    });

    it('pollStatus returns failed for 404', async () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch');
      fetchSpy.mockResolvedValueOnce(new Response('', { status: 404 }));
      const publisher = new TwitterPublisher('tok');
      expect(await publisher.getStatus('tweet_404')).toBe('failed');
      fetchSpy.mockRestore();
    });

    it('getMetrics maps public_metrics correctly', async () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch');
      fetchSpy.mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            data: {
              public_metrics: {
                impression_count: 5000, like_count: 100, reply_count: 20,
                retweet_count: 30, quote_count: 5,
              },
            },
          }),
          { status: 200 },
        ),
      );
      const publisher = new TwitterPublisher('tok');
      const m = await publisher.getMetrics('tweet_1');
      expect(m.views).toBe(5000);
      expect(m.likes).toBe(100);
      expect(m.comments).toBe(20);
      expect(m.shares).toBe(35);
      fetchSpy.mockRestore();
    });
  });
});
