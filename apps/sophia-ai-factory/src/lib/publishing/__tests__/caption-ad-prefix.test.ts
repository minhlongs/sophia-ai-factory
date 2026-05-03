/**
 * caption-ad-prefix.test.ts
 *
 * Tests that TikTok publisher prefixes captions with #ad per FTC requirements.
 * Phase 14: FTC compliance — requires #ad disclosure on all affiliate content.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => ({
  publishVideo: vi.fn().mockResolvedValue('tiktok-post-id-123'),
  checkPublishStatus: vi.fn().mockResolvedValue({ status: 'PUBLISH_COMPLETE' }),
}));

vi.mock('@/lib/tiktok/tiktok-oauth-client', () => ({
  publishVideo: mocks.publishVideo,
  checkPublishStatus: mocks.checkPublishStatus,
}));

vi.mock('@/seed/utils/logger-utility', () => ({
  logger: { warn: vi.fn(), info: vi.fn(), error: vi.fn() },
}));

import { TikTokPublisher } from '../tiktok-publisher';

describe('TikTokPublisher — FTC caption prefix', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv('TIKTOK_CLIENT_KEY', 'test-key');
  });

  it('prepends #ad to caption if missing', async () => {
    const publisher = new TikTokPublisher('access-token');
    await publisher.upload('https://cdn.example.com/video.mp4', {
      caption: 'Check out this product!',
      hashtags: ['promo'],
    });

    const calledTitle = mocks.publishVideo.mock.calls[0][0].title as string;
    expect(calledTitle.startsWith('#ad ')).toBe(true);
    expect(calledTitle).toContain('Check out this product!');
  });

  it('does not double-prefix if caption already starts with #ad', async () => {
    const publisher = new TikTokPublisher('access-token');
    await publisher.upload('https://cdn.example.com/video.mp4', {
      caption: '#ad Great product here',
      hashtags: [],
    });

    const calledTitle = mocks.publishVideo.mock.calls[0][0].title as string;
    expect(calledTitle.startsWith('#ad #ad')).toBe(false);
    expect(calledTitle).toBe('#ad Great product here');
  });

  it('truncates caption with prefix to 150 chars', async () => {
    const longCaption = 'A'.repeat(200);
    const publisher = new TikTokPublisher('access-token');
    await publisher.upload('https://cdn.example.com/video.mp4', {
      caption: longCaption,
      hashtags: [],
    });

    const calledTitle = mocks.publishVideo.mock.calls[0][0].title as string;
    expect(calledTitle.length).toBeLessThanOrEqual(150);
    expect(calledTitle.startsWith('#ad ')).toBe(true);
  });
});
