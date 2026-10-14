import {
  type PlatformType,
  type ViralityMetrics,
  type PlatformWeights,
  DEFAULT_VIRALITY_WEIGHTS,
  normalizePlatform,
} from './types';

/**
 * Computes platform-weighted virality score [0, 1] with division-by-zero protection.
 */
export function calculatePlatformViralityScore(
  platform: PlatformType | string,
  metrics: ViralityMetrics,
  weights?: PlatformWeights
): number {
  if (!metrics || typeof metrics !== 'object') {
    return 0;
  }

  const normalizedPlatform = normalizePlatform(platform);
  const activeWeights: PlatformWeights =
    weights && Object.keys(weights).length > 0
      ? weights
      : DEFAULT_VIRALITY_WEIGHTS[normalizedPlatform];

  let weightedSum = 0;
  let totalWeight = 0;

  for (const [key, weight] of Object.entries(activeWeights)) {
    if (typeof weight !== 'number' || isNaN(weight) || weight <= 0) {
      continue;
    }
    const rawVal = metrics[key];
    const val = typeof rawVal === 'number' && !isNaN(rawVal) ? Math.max(0, Math.min(1, rawVal)) : 0;
    weightedSum += weight * val;
    totalWeight += weight;
  }

  if (totalWeight <= 0) {
    return 0;
  }

  const score = weightedSum / totalWeight;
  return Number(Math.max(0, Math.min(1, score)).toFixed(4));
}
