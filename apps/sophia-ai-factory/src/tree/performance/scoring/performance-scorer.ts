/**
 * Composite Performance Scorer and Workspace Asset Scoring
 * Layer: tree (domain-specific reusable)
 *
 * @module tree/performance/scoring/performance-scorer
 */

import {
  DEFAULT_CONFIG,
  type PerformanceMetrics,
  type ScoreResult,
  type ScorerConfig,
} from './types';
import { computeEngagementFactor } from './engagement-scorer';
import { computeVelocityFactor, computeRetentionFactor } from './retention-scorer';
import { aggregateMetricsFromEvents } from './event-aggregator';

/**
 * Compute composite score from pre-aggregated metrics.
 * Pure function — no side effects, fully deterministic.
 */
export function computeScore(
  metrics: PerformanceMetrics,
  config: ScorerConfig = DEFAULT_CONFIG,
  now: number = Date.now(),
): ScoreResult {
  // --- Engagement Rate ---
  const eng = computeEngagementFactor(metrics, config);

  // --- Velocity ---
  const vel = computeVelocityFactor(metrics, config);

  // --- Retention ---
  const ret = computeRetentionFactor(metrics, config);

  // --- Composite score ---
  const score = eng.contribution + vel.contribution + ret.contribution;
  const clampedScore = Math.max(0, Math.min(score, 1.0));

  // --- Quartile prediction ---
  const [q1, q2, q3] = config.quartileBoundaries;
  let predictedQuartile: 1 | 2 | 3 | 4;
  if (clampedScore < q1) predictedQuartile = 1;
  else if (clampedScore < q2) predictedQuartile = 2;
  else if (clampedScore < q3) predictedQuartile = 3;
  else predictedQuartile = 4;

  // --- Confidence ---
  let confidence: 'low' | 'medium' | 'high';
  const hasEngagementData = metrics.views > 0 || metrics.impressions > 0;
  const hasRetentionData = metrics.retention30s > 0 || metrics.retention3s > 0;
  const hasVelocityData = metrics.eventCount > 0;

  if (metrics.eventCount >= config.minEventsThreshold && hasEngagementData && hasVelocityData) {
    confidence = hasRetentionData ? 'high' : 'medium';
  } else if (metrics.eventCount >= 2 && hasVelocityData) {
    confidence = 'medium';
  } else {
    confidence = 'low';
  }

  return {
    assetId: metrics.assetId,
    workspaceId: metrics.workspaceId,
    channel: metrics.channel,
    score: clampedScore,
    predictedQuartile,
    confidence,
    factors: [eng.factor, vel.factor, ret.factor],
    computedAt: now,
  };
}

/**
 * Score assets for a workspace over a time window.
 * Reads from performance_events, aggregates, and applies heuristic scorer.
 */
export async function scoreWorkspaceAssets(
  workspaceId: string,
  opts?: {
    assetId?: string;
    channel?: string;
    windowStart?: number;
    windowEnd?: number;
    config?: Partial<ScorerConfig>;
  },
): Promise<ScoreResult[]> {
  const windowEnd = opts?.windowEnd ?? Date.now();
  const windowStart = opts?.windowStart ?? windowEnd - 14 * 24 * 60 * 60 * 1000; // default 14 days
  const config = { ...DEFAULT_CONFIG, ...opts?.config };

  const metricsList = await aggregateMetricsFromEvents({
    workspaceId,
    assetId: opts?.assetId,
    channel: opts?.channel,
    windowStart,
    windowEnd,
  });

  return metricsList.map((metrics) => computeScore(metrics, config));
}

/**
 * Score a single asset by ID.
 */
export async function scoreAsset(
  assetId: string,
  workspaceId: string,
  opts?: {
    channel?: string;
    windowStart?: number;
    windowEnd?: number;
    config?: Partial<ScorerConfig>;
  },
): Promise<ScoreResult | null> {
  const results = await scoreWorkspaceAssets(workspaceId, {
    assetId,
    channel: opts?.channel,
    windowStart: opts?.windowStart,
    windowEnd: opts?.windowEnd,
    config: opts?.config,
  });
  return results[0] ?? null;
}
