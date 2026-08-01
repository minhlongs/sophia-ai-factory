import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { FacebookPublisher } from '@/land/video/publishing/providers/facebook-publisher';

vi.mock('@/seed/utils/logger-utility', () => ({
  logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn() },
}));

describe('FacebookPublisher', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    delete process.env.FACEBOOK_APP_ID;
  });

  afterEach(() => {
    delete process.env.FACEBOOK_APP_ID;
  });

  describe('mock mode', () => {
    it('returns mock_facebook_ id when FACEBOOK_APP_ID absent', async () => {
      const publisher = new FacebookPublisher('tok', 'page_1');
      const id = await publisher.publish('https://v.mp4', { caption: 'caption', hashtags: ['#fb'] });
      expect(id.externalPostId).toMatch(/^mock_facebook_/);
    });

    it('pollStatus returns live for mock id', async () => {
      const publisher = new FacebookPublisher('tok', 'page_1');
      const s = await publisher.getStatus('mock_facebook_99');
      expect(s).toBe('live');
    });

    it('getMetrics returns zero metrics for mock id', async () => {
      const publisher = new FacebookPublisher('tok', 'page_1');
      const m = await publisher.getMetrics('mock_facebook_99');
      expect(m.views).toBe(0);
      expect(m.likes).toBe(0);
    });
  });

  describe('real mode', () => {
    beforeEach(() => {
      process.env.FACEBOOK_APP_ID = 'fb_app_id';
    });

    it('publishes a reel via /video_reels (single-call file_url path)', async () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch');
      fetchSpy.mockResolvedValueOnce(
        new Response(JSON.stringify({ id: 'fb_video_789' }), { status: 200 }),
      );

      const publisher = new FacebookPublisher('page_token', 'page_42');
      const id = await publisher.publish('https://v.mp4', {
        caption: 'test reel',
        hashtags: ['#reel', '#ai'],
        productLink: 'https://shop.com',
      });

      expect(id.externalPostId).toBe('fb_video_789');
      expect(fetchSpy).toHaveBeenCalledTimes(1);
      const url = fetchSpy.mock.calls[0][0] as string;
      expect(url).toContain('/page_42/video_reels');
      const body = JSON.parse((fetchSpy.mock.calls[0][1] as RequestInit).body as string) as Record<string, unknown>;
      expect(body.video_url).toBe('https://v.mp4');
      expect(body.video_state).toBe('PUBLISHED');
      expect(String(body.description)).toContain('#ad');
      fetchSpy.mockRestore();
    });

    it('throws when /video_reels returns non-200', async () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch');
      fetchSpy.mockResolvedValueOnce(new Response('quota_exceeded', { status: 429 }));

      const publisher = new FacebookPublisher('page_token', 'page_42');
      const _errResult = await publisher.publish('https://v.mp4', { caption: 'test', hashtags: [] });
    expect(_errResult.success).toBe(false);
    expect(_errResult.error).toMatch('Facebook video_reels publish failed');
      fetchSpy.mockRestore();
    });

    it('pollStatus maps video_status correctly', async () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch');
      fetchSpy.mockResolvedValueOnce(
        new Response(JSON.stringify({ status: { video_status: 'ready' } }), { status: 200 }),
      );
      const publisher = new FacebookPublisher('tok', 'page_1');
      const s = await publisher.getStatus('fb_video_1');
      expect(s).toBe('live');
      fetchSpy.mockRestore();
    });

    it('getMetrics aggregates reaction totals', async () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch');
      fetchSpy.mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            data: [
              { name: 'total_video_views', values: [{ value: 1000 }] },
              { name: 'total_video_impressions', values: [{ value: 1500 }] },
              { name: 'post_video_likes_by_reaction_type', values: [{ value: { LIKE: 50, LOVE: 10 } }] },
            ],
          }),
          { status: 200 },
        ),
      );
      const publisher = new FacebookPublisher('tok', 'page_1');
      const m = await publisher.getMetrics('fb_video_1');
      expect(m.views).toBe(1000);
      expect(m.reach).toBe(1500);
      expect(m.likes).toBe(60);
      fetchSpy.mockRestore();
    });
  });
});
