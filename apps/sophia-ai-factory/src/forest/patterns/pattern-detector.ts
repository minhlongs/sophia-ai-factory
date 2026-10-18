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
import {
  computeConfidence,
  extractFeature,
  bucketDuration,
  bucketPostingTime,
} from './pattern-feature-bucketing';

export {
  MIN_SAMPLE,
  queryFeatureRows,
  type RawRow,
  computeConfidence,
  extractFeature,
  bucketDuration,
  bucketPostingTime,
};

/** Minimum confidence before a pattern is surfaced */
const MIN_CONFIDENCE = 0.6;
/** Top fraction of performers treated as "winners" */
const WINNER_QUANTILE = 0.1;

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
