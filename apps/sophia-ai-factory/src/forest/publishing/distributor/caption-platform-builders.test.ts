import { describe, expect, it } from 'vitest';
import type { ViralPlatform } from '@/seed/types/growth';
import { buildPlatformCaptionText } from './caption-platform-builders';

function caption(platform: ViralPlatform, overrides: Partial<Parameters<typeof buildPlatformCaptionText>[0]> = {}) {
  return buildPlatformCaptionText({
    platform,
    videoTitle: 'A short title',
    scriptText: 'A narrated script',
    trackedUrl: 'https://example.test/track',
    telegramDeepLink: 'https://t.me/example',
    tags: '#AI #Creator',
    ...overrides,
  });
}

describe('buildPlatformCaptionText', () => {
  it('uses script text for TikTok and falls back to the title when it is empty', () => {
    expect(caption('tiktok')).toContain('A narrated script');
    expect(caption('tiktok', { scriptText: '' })).toContain('A short title');
    expect(caption('tiktok', { tags: 'x'.repeat(2300) })).toHaveLength(2200);
  });

  it('builds YouTube Shorts captions with and without a script', () => {
    expect(caption('youtube_shorts')).toContain('A narrated script');
    expect(caption('youtube_shorts', { scriptText: undefined })).toContain('A short title #Shorts');
  });

  it('handles Twitter title fit, truncation, fallback suffix, and empty tags', () => {
    expect(caption('twitter')).toContain('A short title');
    expect(caption('x', { videoTitle: 'x'.repeat(400) })).toContain('...');
    const partialTitle = caption('twitter', { trackedUrl: `https://${'u'.repeat(220)}` });
    expect(partialTitle.length).toBeLessThanOrEqual(280);
    const noTitleRoom = caption('x', {
      videoTitle: 'x'.repeat(400),
      trackedUrl: `https://${'u'.repeat(350)}`,
      tags: '',
    });
    expect(noTitleRoom).toHaveLength(280);
    expect(noTitleRoom).not.toContain('#AI');
  });

  it('caps Instagram and Facebook lead-ins and supports the defensive default', () => {
    expect(caption('instagram_reels')).toContain('A narrated script');
    expect(caption('instagram_reels', { scriptText: '' })).toContain('A short title');
    expect(caption('facebook_reels')).toContain('A narrated script');
    expect(caption('facebook_reels', { scriptText: '' })).toContain('A short title');
    expect(caption('linkedin' as ViralPlatform)).toBe(
      'A short title\n\nhttps://example.test/track\nhttps://t.me/example\n#AI #Creator',
    );
  });
});
