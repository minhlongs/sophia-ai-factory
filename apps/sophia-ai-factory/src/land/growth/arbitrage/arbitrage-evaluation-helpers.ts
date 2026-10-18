/**
 * Platform score aggregation and evaluation builders for arbitrage coordinator.
 * @module land/growth/arbitrage/arbitrage-evaluation-helpers
 */

import type {
  DestinationPlatform,
  PlatformMetricProfile,
} from './types';
import { calculatePlatformViralityScore } from './traffic-pacer';

export const DEFAULT_ARBITRAGE_PLATFORMS: DestinationPlatform[] = [
  'TIKTOK',
  'YOUTUBE_SHORTS',
  'INSTAGRAM_REELS',
];

export function computePlatformScores(
  metrics: Partial<Record<DestinationPlatform, PlatformMetricProfile>> = {},
): {
  platformScores: Record<DestinationPlatform, number>;
  avgScore: number;
} {
  const platformScores: Record<DestinationPlatform, number> = {
    TIKTOK: calculatePlatformViralityScore(
      'TIKTOK',
      metrics.TIKTOK ?? { platform: 'TIKTOK' },
    ),
    YOUTUBE_SHORTS: calculatePlatformViralityScore(
      'YOUTUBE_SHORTS',
      metrics.YOUTUBE_SHORTS ?? { platform: 'YOUTUBE_SHORTS' },
    ),
    INSTAGRAM_REELS: calculatePlatformViralityScore(
      'INSTAGRAM_REELS',
      metrics.INSTAGRAM_REELS ?? { platform: 'INSTAGRAM_REELS' },
    ),
  };

  const avgScore =
    (platformScores.TIKTOK +
      platformScores.YOUTUBE_SHORTS +
      platformScores.INSTAGRAM_REELS) /
    3;

  return { platformScores, avgScore };
}
