/**
 * @file survival-retention-engine.ts
 * @description Zero-IO domain engine for Kaplan-Meier Viewer Survival Analysis & Drop-Off Cliff Detection
 * @layer tree
 */

import type {
  RetentionSecondBucket,
  SurvivalCurvePoint,
  RetentionCliff,
  RetentionTrimStatus,
} from '@/seed/types/growth-triad-v6-types';

/**
 * Computes the Kaplan-Meier product-limit survival curve from second-by-second bucket data.
 * S(t) = Product_{t_i <= t} (1 - d_i / n_i)
 */
export function computeKaplanMeierSurvivalCurve(
  buckets: RetentionSecondBucket[]
): SurvivalCurvePoint[] {
  if (buckets.length === 0) return [];

  const sorted = [...buckets].sort((a, b) => a.second - b.second);
  let currentSurvival = 1.0;
  const curve: SurvivalCurvePoint[] = [];

  for (let i = 0; i < sorted.length; i++) {
    const b = sorted[i];
    const dropRate = b.viewers > 0 ? b.dropoffs / b.viewers : 0;
    const previousSurvival = currentSurvival;
    currentSurvival = currentSurvival * (1 - Math.min(1, dropRate));

    const dropRatePerSec = previousSurvival - currentSurvival;

    curve.push({
      second: b.second,
      survivalRate: Number(currentSurvival.toFixed(4)),
      dropRatePerSec: Number(dropRatePerSec.toFixed(4)),
    });
  }

  return curve;
}

/**
 * Detects cliff drop-offs where retention falls faster than cliffThreshold per second.
 */
export function detectRetentionCliffs(
  curve: SurvivalCurvePoint[],
  cliffThreshold = 0.08
): RetentionCliff[] {
  const cliffs: RetentionCliff[] = [];

  for (let i = 0; i < curve.length; i++) {
    const pt = curve[i];
    if (pt.dropRatePerSec >= cliffThreshold) {
      const startSecond = pt.second;
      let endSecond = pt.second;
      let maxDrop = pt.dropRatePerSec;

      while (
        i + 1 < curve.length &&
        curve[i + 1].dropRatePerSec >= cliffThreshold / 2
      ) {
        i++;
        endSecond = curve[i].second;
        if (curve[i].dropRatePerSec > maxDrop) {
          maxDrop = curve[i].dropRatePerSec;
        }
      }

      const trimDuration = Math.max(1, endSecond - startSecond + 1);
      cliffs.push({
        startSecond,
        endSecond,
        dropSeverity: Number(maxDrop.toFixed(4)),
        recommendedTrimSec: trimDuration,
      });
    }
  }

  return cliffs;
}

/**
 * Evaluates overall video retention status based on 30-second benchmark and cliff counts.
 */
export function evaluateRetentionStatus(
  thirtySecRetention: number,
  cliffs: RetentionCliff[]
): RetentionTrimStatus {
  if (cliffs.length === 0 && thirtySecRetention >= 0.7) {
    return 'PACING_OPTIMIZED';
  }
  if (cliffs.length > 0) {
    return thirtySecRetention < 0.5 ? 'TRIM_RECOMMENDED' : 'CLIFF_DETECTED';
  }
  return 'MONITORING';
}
