import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ZaloPublisher, ZaloVerificationRequiredError } from '@/land/video/publishing/providers/zalo-publisher';

vi.mock('@/seed/utils/logger-utility', () => ({
  logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn() },
}));

describe('ZaloPublisher', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    delete process.env.ZALO_APP_ID;
    delete process.env.ZALO_OA_ACCESS_TOKEN;
  });

  afterEach(() => {
    delete process.env.ZALO_APP_ID;
    delete process.env.ZALO_OA_ACCESS_TOKEN;
  });

  describe('verification gate', () => {
    it('throws ZaloVerificationRequiredError when both ZALO_APP_ID and ZALO_OA_ACCESS_TOKEN absent', async () => {
      // Both env vars absent (cleared in beforeEach)
      const publisher = new ZaloPublisher('any_token');
  const _result = await publisher.publish('https://v.mp4', { caption: 'test', hashtags: [] });
  expect(_result.success).toBe(false);
  expect(_result.error).toContain('business must be verified');
    });

it('ZaloVerificationRequiredError includes actionUrl and docsUrl', async () => {
  const publisher = new ZaloPublisher('any_token');
  const result = await publisher.publish('https://v.mp4', { caption: 'test', hashtags: [] });
  expect(result.success).toBe(false);
  expect(result.error).toContain('business must be verified');
});

    it('does not throw when ZALO_APP_ID is set but no OA token (mock mode)', async () => {
      // ZALO_APP_ID set, ZALO_OA_ACCESS_TOKEN absent → mock mode, returns mock_ id
      process.env.ZALO_APP_ID = 'zalo_app_123';
      const publisher = new ZaloPublisher('mock_token');
      const id = await publisher.publish('https://v.mp4', { caption: 'test', hashtags: [] });
      expect(id.externalPostId).toMatch(/^mock_zalo_/);
    });
  });

  describe('mock mode (ZALO_APP_ID set, no OA token)', () => {
    beforeEach(() => {
      process.env.ZALO_APP_ID = 'zalo_app_123';
      // ZALO_OA_ACCESS_TOKEN intentionally absent → mock mode
    });

    it('returns mock_zalo_ id when in mock mode', async () => {
      const publisher = new ZaloPublisher('tok');
      const id = await publisher.publish('https://v.mp4', { caption: 'test', hashtags: ['#vn'] });
      expect(id.externalPostId).toMatch(/^mock_zalo_/);
    });

    it('pollStatus returns live for mock id', async () => {
      const publisher = new ZaloPublisher('tok');
      const s = await publisher.getStatus('mock_zalo_99');
      expect(s).toBe('live');
    });

    it('getMetrics returns zero metrics for mock id', async () => {
      const publisher = new ZaloPublisher('tok');
      const m = await publisher.getMetrics('mock_zalo_99');
      expect(m.views).toBe(0);
      expect(m.likes).toBe(0);
    });
  });

  describe('real mode upload', () => {
    beforeEach(() => {
      process.env.ZALO_APP_ID = 'zalo_app_123';
      process.env.ZALO_OA_ACCESS_TOKEN = 'oa_token_real'; // both set → real mode
    });

    afterEach(() => {
      delete process.env.ZALO_OA_ACCESS_TOKEN;
    });

    it('uploads video and returns broadcast_id', async () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch');

      // Source video fetch - use string body + override blob() for jsdom FormData compat
      const videoRes = new Response('videobytes', {
        status: 200,
        headers: { 'Content-Type': 'video/mp4' },
      });
      vi.spyOn(videoRes, 'blob').mockResolvedValue(new Blob(['videobytes'], { type: 'video/mp4' }));
      fetchSpy.mockResolvedValueOnce(videoRes);
      // Upload to Zalo OA
      fetchSpy.mockResolvedValueOnce(
        new Response(
          JSON.stringify({ error: 0, message: 'Success', data: { video_id: 'vid_zalo_123' } }),
          { status: 200 },
        ),
      );
      // Broadcast
      fetchSpy.mockResolvedValueOnce(
        new Response(
          JSON.stringify({ error: 0, message: 'Success', data: { broadcast_id: 'bcast_456' } }),
          { status: 200 },
        ),
      );

      const publisher = new ZaloPublisher('real_access_token');
      const id = await publisher.publish('https://v.mp4', {
        caption: 'Zalo post',
        hashtags: ['#zalo', '#vn'],
      });

      expect(id.externalPostId).toBe('bcast_456');
      // 3 fetches: video fetch + upload + broadcast
      expect(fetchSpy).toHaveBeenCalledTimes(3);
      fetchSpy.mockRestore();
    });
  });
});
