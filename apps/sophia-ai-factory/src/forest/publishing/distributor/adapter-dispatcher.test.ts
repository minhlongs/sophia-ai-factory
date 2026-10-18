import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ViralPlatform, ViralPublishInput } from '@/seed/types/growth';
import { facebookAdapter } from '@/tree/publishing/facebook-adapter';
import { instagramAdapter } from '../instagram-adapter';
import { tiktokAdapter } from '../tiktok-adapter';
import { youtubeAdapter } from '../youtube-adapter';
import * as urlHelpers from './adapter-url-helpers';
import { dispatchPlatformUpload } from './adapter-dispatcher';

const input = (overrides: Partial<ViralPublishInput> = {}): ViralPublishInput => ({
  videoId: 'video-1',
  videoTitle: 'A video title',
  niche: 'ai_automation',
  hookArchetype: 'curiosity_gap',
  platforms: ['tiktok'],
  videoUrl: 'https://example.test/video.mp4',
  byokKeys: {
    tiktokApiKey: 'tiktok-token',
    youtubeApiKey: 'youtube-token',
    twitterApiKey: 'x-token',
  },
  ...overrides,
});

const published = (platformVideoId: string, url?: string) => ({
  platformVideoId,
  status: 'published' as const,
  url,
});

describe('dispatchPlatformUpload', () => {
  afterEach(() => vi.restoreAllMocks());

  it('simulates when a key or video URL is missing and marks scheduled simulations', async () => {
    vi.spyOn(urlHelpers, 'resolveByokKey').mockReturnValue(undefined);
    const simulatedUrl = vi.spyOn(urlHelpers, 'getSimulatedPostUrl').mockReturnValue('https://x.test/simulated');
    const noKey = await dispatchPlatformUpload('tiktok', input(), 'caption');
    expect(noKey.status).toBe('published');
    expect(noKey.postUrl).toBe('https://x.test/simulated');

    vi.spyOn(urlHelpers, 'resolveByokKey').mockReturnValue('token');
    const missingVideo = await dispatchPlatformUpload(
      'youtube_shorts',
      input({ videoUrl: undefined, scheduledAt: Date.UTC(2026, 0, 1) }),
      'caption',
    );
    expect(missingVideo.status).toBe('scheduled');
    expect(simulatedUrl).toHaveBeenCalledWith('youtube_shorts', missingVideo.postId);
  });

  it('uploads TikTok and falls back to its canonical post URL when the adapter omits one', async () => {
    vi.spyOn(urlHelpers, 'resolveByokKey').mockReturnValue('tiktok-token');
    vi.spyOn(tiktokAdapter, 'uploadVideo').mockResolvedValue(published('tt-1'));

    await expect(dispatchPlatformUpload('tiktok', input(), 'x'.repeat(200))).resolves.toEqual({
      postId: 'tt-1',
      status: 'published',
      postUrl: 'https://www.tiktok.com/@creator/video/tt-1',
    });
  });

  it('passes scheduled time to YouTube and handles both permalink outcomes', async () => {
    vi.spyOn(urlHelpers, 'resolveByokKey').mockReturnValue('youtube-token');
    const upload = vi.spyOn(youtubeAdapter, 'uploadVideo')
      .mockResolvedValueOnce(published('yt-1', 'https://youtube.test/yt-1'))
      .mockResolvedValueOnce(published('yt-2'));
    const scheduledAt = Date.UTC(2026, 0, 1);

    await expect(dispatchPlatformUpload('youtube_shorts', input({ scheduledAt }), 'caption')).resolves.toEqual({
      postId: 'yt-1',
      status: 'scheduled',
      postUrl: 'https://youtube.test/yt-1',
    });
    await expect(dispatchPlatformUpload('youtube_shorts', input({ scheduledAt: undefined }), 'caption')).resolves.toEqual({
      postId: 'yt-2',
      status: 'published',
      postUrl: 'https://www.youtube.com/shorts/yt-2',
    });
    expect(upload.mock.calls[0]?.[1].scheduledAt).toBe(new Date(scheduledAt).toISOString());
    expect(upload.mock.calls[1]?.[1].scheduledAt).toBeUndefined();
  });

  it('dispatches Instagram and Facebook reels with adapter URLs and fallback URLs', async () => {
    vi.spyOn(urlHelpers, 'resolveByokKey').mockReturnValue('meta-token');
    vi.spyOn(instagramAdapter, 'uploadVideo')
      .mockResolvedValueOnce(published('ig-1', 'https://instagram.test/ig-1'))
      .mockResolvedValueOnce(published('ig-2'));
    vi.spyOn(facebookAdapter, 'uploadVideo')
      .mockResolvedValueOnce(published('fb-1', 'https://facebook.test/fb-1'))
      .mockResolvedValueOnce(published('fb-2'));

    await expect(dispatchPlatformUpload('instagram_reels', input(), 'caption')).resolves.toMatchObject({
      postUrl: 'https://instagram.test/ig-1',
    });
    await expect(dispatchPlatformUpload('instagram_reels', input(), 'caption')).resolves.toMatchObject({
      postUrl: 'https://www.instagram.com/reel/ig-2',
    });
    await expect(dispatchPlatformUpload('facebook_reels', input(), 'caption')).resolves.toMatchObject({
      postUrl: 'https://facebook.test/fb-1',
    });
    await expect(dispatchPlatformUpload('facebook_reels', input(), 'caption')).resolves.toMatchObject({
      postUrl: 'https://www.facebook.com/reel/fb-2',
    });
  });

  it('uses the shared X tweet dispatcher for both aliases and the defensive fallback for unknown platforms', async () => {
    vi.spyOn(urlHelpers, 'resolveByokKey').mockReturnValue('x-token');
    const tweetResult = { postId: 'tweet-1', postUrl: 'https://x.com/i/status/tweet-1', status: 'published' as const };
    const tweet = vi.spyOn(urlHelpers, 'dispatchXTweet').mockResolvedValue(tweetResult);

    await expect(dispatchPlatformUpload('twitter', input(), 'caption')).resolves.toEqual(tweetResult);
    await expect(dispatchPlatformUpload('x', input(), 'caption')).resolves.toEqual(tweetResult);
    expect(tweet).toHaveBeenCalledTimes(2);

    const unknown = await dispatchPlatformUpload('linkedin' as ViralPlatform, input(), 'caption');
    expect(unknown).toMatchObject({ postUrl: undefined, status: 'simulated' });
  });
});
