/**
 * Feature extraction, bucketing, and confidence scoring for pattern detection.
 *
 * @module forest/patterns/pattern-feature-bucketing
 */

import { MIN_SAMPLE } from './pattern-detector-queries';

/**
 * Compute confidence from sample size and consistency.
 * - sample_size: larger samples → higher confidence (logarithmic, saturating)
 * - consistency: how tight the distribution is (lower stddev → higher)
 * Returns 0..1.
 */
export function computeConfidence(sampleSize: number, consistency: number): number {
  if (sampleSize < MIN_SAMPLE) return 0;
  // Sample size contribution: saturates at ~50 samples
  const sampleScore = Math.min(1, Math.log2(sampleSize + 1) / Math.log2(51));
  // Consistency contribution: 1 = perfect, 0 = no consistency
  const consistencyScore = Math.max(0, Math.min(1, consistency));
  return sampleScore * 0.6 + consistencyScore * 0.4;
}

/**
 * Extract a feature value from a raw row. Feature-specific parsing keeps the
 * detector honest — e.g. duration buckets, posting-time buckets.
 */
export function extractFeature(featureKey: string, raw: Record<string, unknown>): string {
  const value = raw[featureKey];
  if (value == null) return 'unknown';
  if (featureKey === 'duration') return bucketDuration(String(value));
  if (featureKey === 'posting_time') return bucketPostingTime(String(value));
  return String(value);
}

/** Bucket durations into 15s/30s/60s/90s+/long */
export function bucketDuration(seconds: string): string {
  if (seconds === '' || seconds == null) return 'unknown';
  const n = Number(seconds);
  if (!Number.isFinite(n)) return 'unknown';
  if (n <= 15) return '0-15s';
  if (n <= 30) return '16-30s';
  if (n <= 60) return '31-60s';
  if (n <= 90) return '61-90s';
  return '90s+';
}

/**
 * Bucket posting time into prime/shoulder/off-peak.
 * Uses UTC hours explicitly so behavior is deterministic regardless
 * of the machine's local timezone.
 */
export function bucketPostingTime(iso: string): string {
  const d = new Date(iso);
  const h = Number.isFinite(d.getUTCHours()) ? d.getUTCHours() : -1;
  if (h < 0) return 'unknown';
  if (h >= 6 && h < 9) return 'prime'; // early morning UTC
  if (h >= 17 && h < 21) return 'prime'; // evening UTC
  if (h >= 9 && h < 17) return 'shoulder'; // workday UTC
  return 'off-peak';
}
