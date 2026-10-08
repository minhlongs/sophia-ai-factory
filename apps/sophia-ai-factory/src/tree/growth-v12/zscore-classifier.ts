/**
 * Pure Domain Algorithm: Retention Z-Score Classifier
 * Calculates standard retention deviations and flags alpha viral performers.
 * Layer: tree/growth-v12 | Max LOC: < 200 | Zero :any
 * @module tree/growth-v12/zscore-classifier
 */

import type {
  VideoRetentionProfile,
  ChannelBaselineMetrics,
  VideoViralityClass,
} from '@/seed/types/growth-triad-v12';
import { FLYWHEEL_CONFIG } from '@/seed/config/growth/flywheel-weights';

export interface ZScoreClassificationResult {
  zScore: number;
  classification: VideoViralityClass;
  isEligibleForReseed: boolean;
  confidence: 'HIGH' | 'LOW';
}

export function classifyVideoRetention(
  profile: VideoRetentionProfile,
  baseline?: ChannelBaselineMetrics | null,
): ZScoreClassificationResult {
  const fallback = FLYWHEEL_CONFIG.DEFAULT_CHANNEL_BASELINES[profile.platform];
  const mean = baseline?.meanRetentionPercent ?? fallback.meanRetention;
  const stdDev = Math.max(baseline?.stdDevRetentionPercent ?? fallback.stdDev, 1.0);

  // Z = (X - μ) / σ
  const rawZ = (profile.avgRetentionPercent - mean) / stdDev;
  const zScore = Math.round(rawZ * 100) / 100;

  const isLowSample = profile.views < FLYWHEEL_CONFIG.MIN_SAMPLE_VIEWS_FOR_ZSCORE;
  const confidence = isLowSample ? 'LOW' : 'HIGH';

  let classification: VideoViralityClass = 'STEADY';
  if (zScore >= FLYWHEEL_CONFIG.Z_SCORE_ALPHA_VIRAL_THRESHOLD) {
    classification = 'ALPHA_VIRAL';
  } else if (zScore < FLYWHEEL_CONFIG.Z_SCORE_STAGNANT_THRESHOLD) {
    classification = 'STAGNANT';
  }

  // Reseed only when high confidence and viral
  const isEligibleForReseed = classification === 'ALPHA_VIRAL' && confidence === 'HIGH';

  return {
    zScore,
    classification,
    isEligibleForReseed,
    confidence,
  };
}
