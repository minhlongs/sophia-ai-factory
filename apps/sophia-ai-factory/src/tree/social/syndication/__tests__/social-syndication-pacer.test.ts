import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  evaluateSyndicationPacing,
  MAX_DAILY_UPLOADS,
  MIN_CHANNEL_INTERVAL_MS,
} from '../social-syndication-pacer';

describe('evaluateSyndicationPacing', () => {
  const baseNow = 1775580000000;

  beforeEach(() => {
    vi.spyOn(Math, 'random').mockReturnValue(0.5); // Fixed jitter for predictable tests
  });

  it('allows scheduling for fresh channel with staggered delay', () => {
    const result = evaluateSyndicationPacing(
      {
        channelId: 'chan_tiktok_1',
        platform: 'tiktok',
        todayPublishedCount: 0,
        lastPublishedAtMs: null,
      },
      baseNow,
    );

    expect(result.allowed).toBe(true);
    expect(result.reason).toBe('STAGGERED_OK');
    // 45 mins + 0 + 2.5 min jitter = 47.5 min = 2,850,000 ms
    expect(result.delayMs).toBe(47.5 * 60 * 1000);
    expect(result.nextAvailableAtMs).toBe(baseNow + 47.5 * 60 * 1000);
  });

  it('rejects upload if 3-hour minimum interval has not elapsed', () => {
    const twoHoursAgo = baseNow - 2 * 60 * 60 * 1000;
    const result = evaluateSyndicationPacing(
      {
        channelId: 'chan_yt_1',
        platform: 'youtube',
        todayPublishedCount: 1,
        lastPublishedAtMs: twoHoursAgo,
      },
      baseNow,
    );

    expect(result.allowed).toBe(false);
    expect(result.reason).toBe('MIN_INTERVAL_NOT_MET');
    expect(result.delayMs).toBe(1 * 60 * 60 * 1000); // 1 hour left
    expect(result.nextAvailableAtMs).toBe(twoHoursAgo + MIN_CHANNEL_INTERVAL_MS);
  });

  it('rejects upload if daily cap of 4 has been reached', () => {
    const fourHoursAgo = baseNow - 4 * 60 * 60 * 1000;
    const result = evaluateSyndicationPacing(
      {
        channelId: 'chan_x_1',
        platform: 'x',
        todayPublishedCount: MAX_DAILY_UPLOADS,
        lastPublishedAtMs: fourHoursAgo,
      },
      baseNow,
    );

    expect(result.allowed).toBe(false);
    expect(result.reason).toBe('MAX_DAILY_QUOTA_REACHED');
    expect(result.delayMs).toBeGreaterThan(0);
  });

  it('scales delay progressively as todayPublishedCount increases', () => {
    const fourHoursAgo = baseNow - 4 * 60 * 60 * 1000;
    const count1 = evaluateSyndicationPacing(
      {
        channelId: 'chan_tiktok_2',
        platform: 'tiktok',
        todayPublishedCount: 1,
        lastPublishedAtMs: fourHoursAgo,
      },
      baseNow,
    );

    const count2 = evaluateSyndicationPacing(
      {
        channelId: 'chan_tiktok_2',
        platform: 'tiktok',
        todayPublishedCount: 2,
        lastPublishedAtMs: fourHoursAgo,
      },
      baseNow,
    );

    expect(count1.allowed).toBe(true);
    expect(count2.allowed).toBe(true);
    expect(count2.delayMs).toBeGreaterThan(count1.delayMs);
  });
});
