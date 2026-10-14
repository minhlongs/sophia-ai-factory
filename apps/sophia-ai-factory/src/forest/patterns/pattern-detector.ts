/**
 * Pattern Detection Engine — Phase 5: Auto-Creative Playbook (COMPOUND stage)
 *
 * Heuristics-only pattern detection from experiment + performance data. NO ML.
 * Clusters top performers by shared features and computes confidence scores
 * from sample size + consistency.
 *
 * Layer: forest (infrastructure orchestrator)
 */

import { createServerClient } from '@/seed/db/client';
import type { PlaybookPattern, PatternDetectionResult } from '@/seed/types/playbook-pattern';
import {
  MIN_SAMPLE,
  queryFeatureRows,
  type RawRow,
} from './pattern-detector-queries';

export { MIN_SAMPLE, queryFeatureRows, type RawRow };

/** Minimum confidence before a pattern is surfaced */
const MIN_CONFIDENCE = 0.6;
/** Top fraction of performers treated as "winners" */
const WINNER_QUANTILE = 0.1;

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

/**
 * Detect winning patterns for a workspace from a raw feature table.
 *
 * @param featureKey  The dimension to cluster on (e.g. 'hook_type', 'channel')
 * @param metric      The performance metric to rank by (e.g. 'ctr')
 * @param workspaceId Tenant scope
 * @param source      Where the raw rows come from ('experiment' | 'memory' | 'roi')
 */
export async function detectPatterns(
  featureKey: string,
  metric: string,
  workspaceId: string,
  source: 'experiment' | 'memory' | 'roi',
): Promise<PatternDetectionResult> {
  const scannedAt = Date.now();
  const db = createServerClient();

  const rows = await queryFeatureRows(db, featureKey, metric, workspaceId, source);

  if (rows.length === 0) {
    return {
      patterns: [],
      insufficientData: true,
      reason: `No rows for feature='${featureKey}' metric='${metric}' source='${source}'`,
      scannedAt,
    };
  }

  // Rank by avg_metric descending; winners = top WINNER_QUANTILE
  rows.sort((a, b) => b.avg_metric - a.avg_metric);
  const cutoff = Math.max(1, Math.ceil(rows.length * WINNER_QUANTILE));
  const winners = rows.slice(0, cutoff);
  const allValues = rows.map((r) => r.feature_value);

  const patterns: PlaybookPattern[] = [];
  for (const w of winners) {
    const sampleSize = w.sample_size;
    // Consistency = fraction of all rows that share this feature value
    const consistency = allValues.filter((v) => v === w.feature_value).length / allValues.length;
    const confidence = computeConfidence(sampleSize, consistency);
    if (sampleSize < MIN_SAMPLE || confidence < MIN_CONFIDENCE) continue;

    const level: 'high' | 'medium' | 'low' =
      confidence >= 0.9 ? 'high' : confidence >= 0.7 ? 'medium' : 'low';

    patterns.push({
      id: `pat_${workspaceId}_${featureKey}_${w.feature_value}_${scannedAt}`,
      workspaceId,
      featureKey,
      featureValue: w.feature_value,
      metric,
      avgMetric: w.avgMetric,
      sampleSize,
      confidence: Math.round(confidence * 1000) / 1000,
      confidenceLevel: level,
      source,
      detectedAt: scannedAt,
    });
  }

  return {
    patterns,
    insufficientData: patterns.length === 0,
    reason: patterns.length === 0 ? 'No patterns met minimum sample/confidence thresholds' : undefined,
    scannedAt,
  };
}
