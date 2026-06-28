import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { InstagramPublisher } from '../instagram-publisher';

vi.mock('@/seed/utils/logger-utility', () => ({
  logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn() },
}));

describe('InstagramPublisher', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    delete process.env.INSTAGRAM_APP_ID;
  });

  afterEach(() => {
    delete process.env.INSTAGRAM_APP_ID;
  });

  describe('mock mode', () => {
    it('returns mock_instagram_ id when INSTAGRAM_APP_ID absent', async () => {
      const publisher = new InstagramPublisher('tok', 'ig_user_1');
      const id = await publisher.upload('https://v.mp4', {
        caption: 'caption',
        hashtags: ['#ig'],
      });
      expect(id).toMatch(/^mock_instagram_/);
    });

    it('pollStatus returns live for mock id', async () => {
      const publisher = new InstagramPublisher('tok', 'ig_user_1');
      const s = await publisher.pollStatus('mock_instagram_99');
      expect(s).toBe('live');
    });

    it('getMetrics returns zero metrics for mock id', async () => {
      const publisher = new InstagramPublisher('tok', 'ig_user_1');
      const m = await publisher.getMetrics('mock_instagram_99');
      expect(m.views).toBe(0);
      expect(m.likes).toBe(0);
    });
  });

  describe('real mode', () => {
    beforeEach(() => {
      process.env.INSTAGRAM_APP_ID = 'ig_app_id';
    });

    it('creates media container then publishes', async () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch');

      // Step 1: media container creation
      fetchSpy.mockResolvedValueOnce(
        new Response(JSON.stringify({ id: 'container_456' }), { status: 200 }),
      );
      // Step 2: media_publish
      fetchSpy.mockResolvedValueOnce(
        new Response(JSON.stringify({ id: 'ig_post_789' }), { status: 200 }),
      );

      const publisher = new InstagramPublisher('ig_access_token', 'ig_user_123');
      const id = await publisher.upload('https://v.mp4', {
        caption: 'test reel',
        hashtags: ['#reel', '#ai'],
        productLink: 'https://shop.com',
      });

      expect(id).toBe('ig_post_789');
      expect(fetchSpy).toHaveBeenCalledTimes(2);

      // Verify first call was to /media endpoint
      const firstCallUrl = fetchSpy.mock.calls[0][0] as string;
      expect(firstCallUrl).toContain('/ig_user_123/media');

      fetchSpy.mockRestore();
    });
  });
});
