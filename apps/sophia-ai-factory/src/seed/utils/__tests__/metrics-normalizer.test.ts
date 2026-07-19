import { describe, it, expect } from 'vitest';
import { normalizeMetrics } from '../metrics-normalizer';
import type { MetricsJson } from '@/seed/types/channel-provider';

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeRaw(overrides: Partial<MetricsJson> = {}): MetricsJson {
  return {
    views: 1000,
    likes: 50,
    comments: 10,
    shares: 5,
    ...overrides,
  };
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('normalizeMetrics', () => {
  it('normalizes complete metrics', () => {
    const raw = makeRaw();
    const result = normalizeMetrics(raw, 'youtube', 'post-123');

    expect(result).toEqual({
      views: 1000,
      likes: 50,
      comments: 10,
      shares: 5,
      engagementRate: 6.5, // (50+10+5)/1000*100 = 6.5
      platform: 'youtube',
      postId: 'post-123',
      collectedAt: expect.any(Number),
    });
  });

  it('defaults missing fields to 0', () => {
    const raw = makeRaw({ likes: undefined, comments: undefined, shares: undefined });
    const result = normalizeMetrics(raw, 'tiktok', 'post-456');

    expect(result.views).toBe(1000);
    expect(result.likes).toBe(0);
    expect(result.comments).toBe(0);
    expect(result.shares).toBe(0);
  });

  it('handles zero views without divide-by-zero', () => {
    const raw = makeRaw({ views: 0, likes: 10, comments: 5, shares: 3 });
    const result = normalizeMetrics(raw, 'telegram', 'post-789');

    expect(result.views).toBe(0);
    expect(result.engagementRate).toBe(0);
  });

  it('computes correct engagementRate for high engagement', () => {
    const raw = makeRaw({ views: 500, likes: 200, comments: 50, shares: 25 });
    const result = normalizeMetrics(raw, 'instagram', 'post-abc');

    expect(result.engagementRate).toBeCloseTo(55, 1); // (275/500)*100 = 55
  });

  it('includes collectedAt as current timestamp', () => {
    const before = Date.now();
    const result = normalizeMetrics(makeRaw(), 'facebook', 'p1');
    const after = Date.now();

    expect(result.collectedAt).toBeGreaterThanOrEqual(before);
    expect(result.collectedAt).toBeLessThanOrEqual(after);
  });

  it('preserves platform and postId in output', () => {
    const result = normalizeMetrics(makeRaw(), 'youtube', 'yt-999');
    expect(result.platform).toBe('youtube');
    expect(result.postId).toBe('yt-999');
  });
});
