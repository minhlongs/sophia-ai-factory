/**
 * traffic-pacer.ts — Land Layer
 * Virality scoring and opportunistic compute routing
 */

import type {
  DestinationPlatform,
  PlatformMetricProfile,
  ComputeArbitrageDecision,
} from './types';

/**
 * Calculates platform virality score in [0.0, 1.0] based on platform-specific retention hooks.
 */
export function calculatePlatformViralityScore(
  platform: DestinationPlatform,
  metrics: PlatformMetricProfile
): number {
  switch (platform) {
    case 'TIKTOK': {
      const completion = metrics.completionRate ?? 0.75;
      const rewatch = metrics.rewatchRate ?? 0.25;
      // TikTok governing weights: Completion (0.55) + Rewatch (0.45)
      return Math.min(1.0, Number((completion * 0.55 + rewatch * 0.45).toFixed(3)));
    }
    case 'YOUTUBE_SHORTS': {
      const viewedVsSwiped = metrics.viewedVsSwipedRate ?? 0.8;
      const completion = metrics.completionRate ?? 0.7;
      // YouTube Shorts weights: Viewed vs Swiped (0.65) + Completion (0.35)
      return Math.min(1.0, Number((viewedVsSwiped * 0.65 + completion * 0.35).toFixed(3)));
    }
    case 'INSTAGRAM_REELS': {
      const dmShare = metrics.dmShareRate ?? 0.65;
      const save = metrics.saveRate ?? 0.35;
      // IG Reels weights: DM Share (0.60) + Save (0.40)
      return Math.min(1.0, Number((dmShare * 0.60 + save * 0.40).toFixed(3)));
    }
  }
}

/**
 * Determines opportunistic compute regime and estimated cost savings.
 */
export function determineComputeArbitrage(
  averageViralityScore: number,
  urgency: 'HIGH' | 'NORMAL' | 'LOW' = 'NORMAL',
  estimatedTokenCostUsd = 1.2
): ComputeArbitrageDecision {
  if (averageViralityScore >= 0.82 || urgency === 'HIGH') {
    return {
      regime: 'REALTIME_PHOTOREAL',
      targetProvider: 'HeyGen Photoreal',
      estimatedCostSavingsUsd: 0.0,
      reason: 'High virality probability requires premium cinematic model render.',
    };
  }

  if (averageViralityScore < 0.55 || urgency === 'LOW') {
    const savings = Number((estimatedTokenCostUsd * 0.42).toFixed(2));
    return {
      regime: 'OFF_PEAK_QUEUE',
      targetProvider: 'Off-Peak Batch Worker',
      estimatedCostSavingsUsd: savings,
      reason: 'Non-urgent batch scheduled for off-peak window (02:00-08:00 UTC).',
    };
  }

  const savings = Number((estimatedTokenCostUsd * 0.25).toFixed(2));
  return {
    regime: 'EXPRESS_DEGRADED',
    targetProvider: 'D-ID Express',
    estimatedCostSavingsUsd: savings,
    reason: 'Balanced virality score allows fast express model with cost degradation.',
  };
}
