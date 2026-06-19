import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { PinterestPublisher } from '@/land/video/publishing/providers/pinterest-publisher';

vi.mock('@/seed/utils/logger-utility', () => ({
  logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn() },
}));

describe('PinterestPublisher', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    delete process.env.PINTEREST_CLIENT_ID;
  });

  afterEach(() => {
    delete process.env.PINTEREST_CLIENT_ID;
  });

  describe('mock mode', () => {
    it('returns mock_pinterest_ id when PINTEREST_CLIENT_ID absent', async () => {
      const publisher = new PinterestPublisher('tok', 'board_123');
      const id = await publisher.upload('https://v.mp4', {
        caption: 'caption',
        hashtags: ['#pin'],
      });
      expect(id).toMatch(/^mock_pinterest_/);
    });

    it('pollStatus returns live for mock id', async () => {
      const publisher = new PinterestPublisher('tok', 'board_123');
      const s = await publisher.pollStatus('mock_pinterest_99');
      expect(s).toBe('live');
    });

    it('getMetrics returns zero metrics for mock id', async () => {
      const publisher = new PinterestPublisher('tok', 'board_123');
      const m = await publisher.getMetrics('mock_pinterest_99');
      expect(m.views).toBe(0);
      expect(m.likes).toBe(0);
    });
  });

  describe('real mode', () => {
    beforeEach(() => {
      process.env.PINTEREST_CLIENT_ID = 'pin_client_id';
    });

    it('registers upload, uploads video, creates pin, returns pin id', async () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch');

      // Source video fetch
      fetchSpy.mockResolvedValueOnce(
        new Response(new Blob(['videobytes'], { type: 'video/mp4' }), {
          status: 200,
          headers: { 'Content-Type': 'video/mp4' },
        }),
      );
      // Register video upload
      fetchSpy.mockResolvedValueOnce(
        new Response(
          JSON.stringify({ upload_id: 'upload_abc', upload_url: 'https://s3.amazonaws.com/upload-123' }),
          { status: 200 },
        ),
      );
      // PUT video to upload_url
      fetchSpy.mockResolvedValueOnce(new Response(null, { status: 200 }));
      // Create pin
      fetchSpy.mockResolvedValueOnce(
        new Response(JSON.stringify({ id: 'pin_xyz789' }), { status: 200 }),
      );

      const publisher = new PinterestPublisher('pin_access_token', 'board_abc');
      const id = await publisher.upload('https://v.mp4', {
        caption: 'my pin',
        hashtags: ['#diy', '#craft'],
        title: 'DIY Project',
        productLink: 'https://shop.example.com/product',
      });

      expect(id).toBe('pin_xyz789');
      expect(fetchSpy).toHaveBeenCalledTimes(4);

      // Verify pin creation call contains product tag
      const pinCallBody = JSON.parse(fetchSpy.mock.calls[3][1]?.body as string) as {
        media_product_tags?: unknown[];
        link?: string;
      };
      expect(pinCallBody.media_product_tags).toHaveLength(1);
      expect(pinCallBody.link).toBe('https://shop.example.com/product');

      fetchSpy.mockRestore();
    });

    it('throws error when register upload fails', async () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch');

      fetchSpy.mockResolvedValueOnce(
        new Response(new Blob(['v']), { status: 200, headers: { 'Content-Type': 'video/mp4' } }),
      );
      fetchSpy.mockResolvedValueOnce(
        new Response('Unauthorized', { status: 401 }),
      );

      const publisher = new PinterestPublisher('bad_token', 'board_abc');
      await expect(
        publisher.upload('https://v.mp4', { caption: 'test', hashtags: [] }),
      ).rejects.toThrow('Register upload failed (401)');

      fetchSpy.mockRestore();
    });

    it('pollStatus returns failed for 404 pin', async () => {
      process.env.PINTEREST_CLIENT_ID = 'pin_client_id';
      const fetchSpy = vi.spyOn(globalThis, 'fetch');
      fetchSpy.mockResolvedValueOnce(new Response(null, { status: 404 }));

      const publisher = new PinterestPublisher('tok', 'board_abc');
      const s = await publisher.pollStatus('pin_missing');
      expect(s).toBe('failed');
      fetchSpy.mockRestore();
    });

    it('creates pin without product tags when no productLink', async () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch');

      fetchSpy.mockResolvedValueOnce(
        new Response(new Blob(['v']), { status: 200, headers: { 'Content-Type': 'video/mp4' } }),
      );
      fetchSpy.mockResolvedValueOnce(
        new Response(JSON.stringify({ upload_id: 'uid', upload_url: 'https://s3.upload' }), { status: 200 }),
      );
      fetchSpy.mockResolvedValueOnce(new Response(null, { status: 200 }));
      fetchSpy.mockResolvedValueOnce(
        new Response(JSON.stringify({ id: 'pin_no_tag' }), { status: 200 }),
      );

      const publisher = new PinterestPublisher('tok', 'board_abc');
      const id = await publisher.upload('https://v.mp4', { caption: 'no link', hashtags: ['#test'] });

      expect(id).toBe('pin_no_tag');

      const pinBody = JSON.parse(fetchSpy.mock.calls[3][1]?.body as string) as {
        media_product_tags?: unknown[];
      };
      expect(pinBody.media_product_tags).toBeUndefined();

      fetchSpy.mockRestore();
    });
  });
});
