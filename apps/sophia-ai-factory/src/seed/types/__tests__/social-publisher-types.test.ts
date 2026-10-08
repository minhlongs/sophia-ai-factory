import { describe, it, expect } from 'vitest';
import { toSocialPlatform, type PublishJobStatus } from '../social-publisher-types';

describe('social-publisher-types', () => {
  it('maps various raw platform strings accurately', () => {
    expect(toSocialPlatform('youtube_shorts')).toBe('YOUTUBE_SHORTS');
    expect(toSocialPlatform('YOUTUBE_SHORTS')).toBe('YOUTUBE_SHORTS');
    expect(toSocialPlatform('youtube')).toBe('YOUTUBE_SHORTS');
    expect(toSocialPlatform('tiktok')).toBe('TIKTOK_V2');
    expect(toSocialPlatform('TIKTOK_V2')).toBe('TIKTOK_V2');
    expect(toSocialPlatform('instagram_reels')).toBe('INSTAGRAM_REELS');
    expect(toSocialPlatform('reels')).toBe('INSTAGRAM_REELS');
    expect(toSocialPlatform('unknown')).toBe('YOUTUBE_SHORTS');
  });

  it('allows DRAFT as a valid PublishJobStatus', () => {
    const status: PublishJobStatus = 'DRAFT';
    expect(status).toBe('DRAFT');
  });
});
