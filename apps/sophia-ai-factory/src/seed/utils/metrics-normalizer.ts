/**
 * Metrics Normalizer — cross-platform metric normalization.
 *
 * Different platforms report metrics differently (some include reach,
 * some don't have shares). Normalize to a common shape with safe defaults.
 */

import type { MetricsJson } from '@/seed/types/channel-provider';

/** Normalized metrics — common shape across all channels. */
export interface NormalizedMetrics {
  views: number;
  likes: number;
  comments: number;
  shares: number;
  engagementRate: number; // computed: (likes + comments + shares) / views * 100
  platform: string;
  postId: string;
  collectedAt: number;
}

/**
 * Normalize raw platform metrics into a common format.
 *
 * - Missing fields default to 0
 * - engagementRate is computed safely (avoids divide-by-zero)
 * - returns empty object if views are 0 and no other engagement
 */
export function normalizeMetrics(
  raw: MetricsJson,
  platform: string,
  postId: string,
): NormalizedMetrics {
  const views = raw.views ?? 0;
  const likes = raw.likes ?? 0;
  const comments = raw.comments ?? 0;
  const shares = raw.shares ?? 0;
  const collectedAt = Date.now();

  const engagementRate =
    views > 0 ? ((likes + comments + shares) / views) * 100 : 0;

  return {
    views,
    likes,
    comments,
    shares,
    engagementRate,
    platform,
    postId,
    collectedAt,
  };
}
