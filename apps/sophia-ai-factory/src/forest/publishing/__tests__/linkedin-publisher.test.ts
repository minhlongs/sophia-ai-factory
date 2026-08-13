import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('@/seed/utils/logger-utility', () => ({
  logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn() },
}));

vi.mock('@/seed/security/circuit-breaker', () => ({
  shouldAllowRequest: vi.fn().mockReturnValue(true),
  recordSuccess: vi.fn(),
  recordFailure: vi.fn(),
}));

vi.mock('@/seed/types/failure-kind', () => ({
  classifyError: vi.fn().mockReturnValue('SERVER_ERROR'),
}));

import { LinkedInPublisher } from '@/land/video/publishing/providers/linkedin-publisher';

const AUTHOR_URN = 'urn:li:person:ABC123';

describe('LinkedInPublisher', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.LINKEDIN_CLIENT_ID;
  });

  afterEach(() => {
    delete process.env.LINKEDIN_CLIENT_ID;
  });

  describe('mock mode', () => {
    it('returns mock_linkedin_ id when LINKEDIN_CLIENT_ID absent', async () => {
      const publisher = new LinkedInPublisher('tok', AUTHOR_URN);
      const id = await publisher.upload('https://v.mp4', {
        caption: 'caption',
        hashtags: ['#li'],
      });
      expect(id).toMatch(/^mock_linkedin_/);
    });

    it('pollStatus returns live for mock id', async () => {
      const publisher = new LinkedInPublisher('tok', AUTHOR_URN);
      const s = await publisher.pollStatus('mock_linkedin_99');
      expect(s).toBe('live');
    });

    it('getMetrics returns zero metrics for mock id', async () => {
      const publisher = new LinkedInPublisher('tok', AUTHOR_URN);
      const m = await publisher.getMetrics('mock_linkedin_99');
      expect(m.views).toBe(0);
      expect(m.likes).toBe(0);
      expect(m.comments).toBe(0);
      expect(m.shares).toBe(0);
    });
  });

  describe('real mode', () => {
    beforeEach(() => {
      process.env.LINKEDIN_CLIENT_ID = 'li_client_id';
    });

    it('registers upload, uploads video, creates post, returns URN', async () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch');

      // Source video fetch
      fetchSpy.mockResolvedValueOnce(
        new Response('videobytes', {
          status: 200,
          headers: { 'Content-Type': 'video/mp4' },
        }),
      );
      // Register upload
      fetchSpy.mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            value: {
              uploadMechanism: {
                'com.linkedin.digitalmedia.uploading.MediaUploadHttpRequest': {
                  uploadUrl: 'https://api.linkedin.com/media/upload/123',
                },
              },
              asset: 'urn:li:digitalmediaAsset:asset123',
            },
          }),
          { status: 200 },
        ),
      );
      // PUT video
      fetchSpy.mockResolvedValueOnce(new Response(null, { status: 201 }));
      // Create post
      fetchSpy.mockResolvedValueOnce(
        new Response(JSON.stringify({ id: 'urn:li:ugcPost:post123' }), { status: 201 }),
      );

      const publisher = new LinkedInPublisher('li_access_token', AUTHOR_URN);
      const id = await publisher.upload('https://v.mp4', {
        caption: 'my linkedin post',
        hashtags: ['#career', '#ai'],
        title: 'AI Update',
      });

      expect(id).toBe('urn:li:ugcPost:post123');
      expect(fetchSpy).toHaveBeenCalledTimes(4);

      // Verify register call has correct owner URN
      const registerBody = JSON.parse(fetchSpy.mock.calls[1][1]?.body as string) as {
        registerUploadRequest: { owner: string };
      };
      expect(registerBody.registerUploadRequest.owner).toBe(AUTHOR_URN);

      fetchSpy.mockRestore();
    });

    it('throws error when register upload fails', async () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch');

      fetchSpy.mockResolvedValueOnce(
        new Response('v', { status: 200, headers: { 'Content-Type': 'video/mp4' } }),
      );
      fetchSpy.mockResolvedValueOnce(new Response('Forbidden', { status: 403 }));

      const publisher = new LinkedInPublisher('bad_token', AUTHOR_URN);
      await expect(
        publisher.upload('https://v.mp4', { caption: 'test', hashtags: [] }),
      ).rejects.toThrow('Register upload failed (403)');

      fetchSpy.mockRestore();
    });

    it('pollStatus returns failed for 404 post', async () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch');
      fetchSpy.mockResolvedValueOnce(new Response(null, { status: 404 }));

      const publisher = new LinkedInPublisher('tok', AUTHOR_URN);
      const s = await publisher.pollStatus('urn:li:ugcPost:missing');
      expect(s).toBe('failed');
      fetchSpy.mockRestore();
    });

    it('truncates commentary to MAX_COMMENTARY_LEN', async () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch');
      const longCaption = 'x'.repeat(4000);

      fetchSpy.mockResolvedValueOnce(
        new Response('v', { status: 200, headers: { 'Content-Type': 'video/mp4' } }),
      );
      fetchSpy.mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            value: {
              uploadMechanism: {
                'com.linkedin.digitalmedia.uploading.MediaUploadHttpRequest': {
                  uploadUrl: 'https://upload.li/123',
                },
              },
              asset: 'urn:li:digitalmediaAsset:a1',
            },
          }),
          { status: 200 },
        ),
      );
      fetchSpy.mockResolvedValueOnce(new Response(null, { status: 201 }));
      fetchSpy.mockResolvedValueOnce(
        new Response(JSON.stringify({ id: 'urn:li:ugcPost:p1' }), { status: 201 }),
      );

      const publisher = new LinkedInPublisher('tok', AUTHOR_URN);
      await publisher.upload('https://v.mp4', { caption: longCaption, hashtags: [] });

      const postBody = JSON.parse(fetchSpy.mock.calls[3][1]?.body as string) as {
        commentary: string;
      };
      expect(postBody.commentary.length).toBeLessThanOrEqual(3000);

      fetchSpy.mockRestore();
    });

    it('getMetrics returns zero on API error', async () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch');
      fetchSpy.mockResolvedValueOnce(new Response('Not Found', { status: 404 }));

      const publisher = new LinkedInPublisher('tok', AUTHOR_URN);
      const m = await publisher.getMetrics('urn:li:ugcPost:missing');
      expect(m.views).toBe(0);
      fetchSpy.mockRestore();
    });
  });
});
