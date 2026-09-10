/**
 * Heuristic Performance Scorer (Performance Model v1)
 * Layer: tree (domain-specific reusable)
 *
 * Computes a deterministic, explainable composite score from performance_events metrics.
 * Uses engagement-rate + velocity + retention weighted by config.
 * Returns { predictedQuartile, confidence, factors[] } for interpretability.
 *
 * @module tree/performance/scoring
 */

import { getD1 } from '@/seed/db/client';
import { PerformanceError } from './errors';

// ─── Config (DEFAULT_CONFIG pattern like land/intelligence/types.ts) ──────────

export interface ScorerConfig {
  weights: {
    engagementRate: number;
    velocity: number;
    retention: number;
  };
  // Velocity normalization: events per day at which velocity saturates to 1.0
  velocitySaturation: number;
  // Engagement rate above which engagement saturates
  engagementSaturation: number;
  // Minimum events needed for meaningful score
  minEventsThreshold: number;
  // Quartile boundaries (0-1 normalized score)
  quartileBoundaries: [number, number, number]; // Q1/Q2, Q2/Q3, Q3/Q4 boundaries
}

export const DEFAULT_CONFIG: ScorerConfig = {
  weights: {
    engagementRate: 0.4,
    velocity: 0.35,
    retention: 0.25,
  },
  velocitySaturation: 100, // 100 events/day → velocity = 1.0
  engagementSaturation: 0.15, // 15% engagement rate → engagement = 1.0
  minEventsThreshold: 5,
  quartileBoundaries: [0.25, 0.5, 0.75],
};

// ─── Input metrics shape (aggregated from performance_events) ────────────────

export interface PerformanceMetrics {
  assetId: string;
  workspaceId: string;
  channel: string;
  // Raw event counts
  impressions: number;
  views: number;
  clicks: number;
  likes: number;
  shares: number;
  saves: number;
  follows: number;
  conversions: number;
  revenueEvents: number;
  // Derived metrics
  totalEngagements: number; // likes + shares + saves + follows + comments
  engagementRate: number; // totalEngagements / views (or impressions if views=0)
  velocity: number; // events per day over observation window
  retention3s: number; // from metrics_json or computed
  retention30s: number; // from metrics_json or computed
  // Time window
  windowStart: number; // epoch ms
  windowEnd: number; // epoch ms
  eventCount: number; // total performance_events rows in window
}

// ─── Output types ────────────────────────────────────────────────────────────

export interface ScoreFactor {
  name: 'engagementRate' | 'velocity' | 'retention';
  rawValue: number;
  normalizedValue: number; // 0-1 after saturation/clamping
  weight: number;
  contribution: number; // normalizedValue * weight
  description: string;
}

export interface ScoreResult {
  assetId: string;
  workspaceId: string;
  channel: string;
  score: number; // 0-1 composite
  predictedQuartile: 1 | 2 | 3 | 4;
  confidence: 'low' | 'medium' | 'high';
  factors: ScoreFactor[];
  computedAt: number;
}

// ─── Pure core scorer ────────────────────────────────────────────────────────

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
  // engagements / max(views, impressions) — avoid division by zero
  const engagementDenominator = Math.max(metrics.views, metrics.impressions, 1);
  const rawEngagementRate = metrics.totalEngagements / engagementDenominator;
  const normalizedEngagement = Math.min(
    rawEngagementRate / config.engagementSaturation,
    1.0,
  );

  // --- Velocity ---
  const windowDays = Math.max(
    (metrics.windowEnd - metrics.windowStart) / (1000 * 60 * 60 * 24),
    1 / 24, // minimum 1 hour to avoid division by zero
  );
  const rawVelocity = metrics.eventCount / windowDays;
  const normalizedVelocity = Math.min(rawVelocity / config.velocitySaturation, 1.0);

  // --- Retention ---
  // Use retention30s as primary, fallback to retention3s, default to 0.5 if unavailable
  const rawRetention =
    metrics.retention30s > 0
      ? metrics.retention30s
      : metrics.retention3s > 0
        ? metrics.retention3s
        : 0.5;
  // retention is already 0-1 from metrics_json
  const normalizedRetention = Math.max(0, Math.min(rawRetention, 1.0));

  // --- Composite score ---
  const {
    weights: { engagementRate: wEng, velocity: wVel, retention: wRet },
  } = config;

  const engagementContribution = normalizedEngagement * wEng;
  const velocityContribution = normalizedVelocity * wVel;
  const retentionContribution = normalizedRetention * wRet;

  const score = engagementContribution + velocityContribution + retentionContribution;
  const clampedScore = Math.max(0, Math.min(score, 1.0));

  // --- Quartile prediction ---
  const [q1, q2, q3] = config.quartileBoundaries;
  let predictedQuartile: 1 | 2 | 3 | 4;
  if (clampedScore < q1) predictedQuartile = 1;
  else if (clampedScore < q2) predictedQuartile = 2;
  else if (clampedScore < q3) predictedQuartile = 3;
  else predictedQuartile = 4;

  // --- Confidence ---
  // High: enough events AND all components have meaningful data
  // Medium: enough events but some components weak
  // Low: insufficient events
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

  // --- Factors for explainability ---
  const factors: ScoreFactor[] = [
    {
      name: 'engagementRate',
      rawValue: rawEngagementRate,
      normalizedValue: normalizedEngagement,
      weight: wEng,
      contribution: engagementContribution,
      description: `Engagement rate: ${(rawEngagementRate * 100).toFixed(2)}% (${metrics.totalEngagements} engagements / ${engagementDenominator} views)`,
    },
    {
      name: 'velocity',
      rawValue: rawVelocity,
      normalizedValue: normalizedVelocity,
      weight: wVel,
      contribution: velocityContribution,
      description: `Velocity: ${rawVelocity.toFixed(2)} events/day over ${windowDays.toFixed(1)} days (${metrics.eventCount} events)`,
    },
    {
      name: 'retention',
      rawValue: rawRetention,
      normalizedValue: normalizedRetention,
      weight: wRet,
      contribution: retentionContribution,
      description: `Retention (30s): ${(rawRetention * 100).toFixed(1)}%` + (metrics.retention30s === 0 ? ' (fallback)' : ''),
    },
  ];

  return {
    assetId: metrics.assetId,
    workspaceId: metrics.workspaceId,
    channel: metrics.channel,
    score: clampedScore,
    predictedQuartile,
    confidence,
    factors,
    computedAt: now,
  };
}

// ─── DB-backed aggregation helper ────────────────────────────────────────────

interface AggregationOptions {
  assetId?: string;
  workspaceId: string;
  channel?: string;
  windowStart: number;
  windowEnd: number;
}

interface PerformanceEventRow {
  asset_id: string;
  channel: string | null;
  event_type: string;
  count: number;
  metrics_json: string;
  recorded_at: number;
}

/** Mutable per-asset event counters over the aggregation window. */
interface EventTotals {
  impressions: number;
  views: number;
  clicks: number;
  likes: number;
  shares: number;
  saves: number;
  follows: number;
  conversions: number;
  revenueEvents: number;
}

/** Mutable retention accumulators parsed from metrics_json. */
interface RetentionAccumulator {
  r3sSum: number;
  r30sSum: number;
  count: number;
}

const EVENT_COUNT_KEYS: Record<string, keyof EventTotals> = {
  impression: 'impressions',
  view: 'views',
  click: 'clicks',
  like: 'likes',
  share: 'shares',
  save: 'saves',
  follow: 'follows',
  conversion: 'conversions',
  revenue: 'revenueEvents',
};

function newEventTotals(): EventTotals {
  return {
    impressions: 0,
    views: 0,
    clicks: 0,
    likes: 0,
    shares: 0,
    saves: 0,
    follows: 0,
    conversions: 0,
    revenueEvents: 0,
  };
}

function accumulateRetention(metricsJson: string, acc: RetentionAccumulator): void {
  try {
    const metrics = JSON.parse(metricsJson) as Record<string, unknown>;
    if (typeof metrics.retention3s === 'number') {
      acc.r3sSum += metrics.retention3s;
      acc.count++;
    }
    if (typeof metrics.retention30s === 'number') {
      acc.r30sSum += metrics.retention30s;
      acc.count++;
    }
  } catch {
    // ignore malformed metrics_json
  }
}

/** Reduce all rows of one asset|channel group into a single metrics entry. */
function buildAssetMetrics(key: string, assetRows: PerformanceEventRow[], workspaceId: string): PerformanceMetrics {
  const [assetId, channel] = key.split('|');
  const totals = newEventTotals();
  const retention: RetentionAccumulator = { r3sSum: 0, r30sSum: 0, count: 0 };

  for (const row of assetRows) {
    const totalKey = EVENT_COUNT_KEYS[row.event_type];
    if (totalKey) {
      totals[totalKey] += row.count;
    }
    accumulateRetention(row.metrics_json, retention);
  }

  const totalEngagements = totals.likes + totals.shares + totals.saves + totals.follows;
  const engagementDenominator = Math.max(totals.views, totals.impressions, 1);

  return {
    assetId,
    workspaceId,
    channel,
    impressions: totals.impressions,
    views: totals.views,
    clicks: totals.clicks,
    likes: totals.likes,
    shares: totals.shares,
    saves: totals.saves,
    follows: totals.follows,
    conversions: totals.conversions,
    revenueEvents: totals.revenueEvents,
    totalEngagements,
    engagementRate: totalEngagements / engagementDenominator,
    velocity: 0, // computed in computeScore
    retention3s: retention.count > 0 ? retention.r3sSum / retention.count : 0,
    retention30s: retention.count > 0 ? retention.r30sSum / retention.count : 0,
    windowStart: Math.min(...assetRows.map((r) => r.recorded_at)),
    windowEnd: Math.max(...assetRows.map((r) => r.recorded_at)),
    eventCount: assetRows.length,
  };
}

async function aggregateMetricsFromEvents(
  opts: AggregationOptions,
): Promise<PerformanceMetrics[]> {
  const db = await getD1();
  if (!db) throw new PerformanceError('D1_UNAVAILABLE', 'D1 not available');

  const conditions = ['workspace_id = ?1', 'recorded_at >= ?2', 'recorded_at <= ?3'];
  const params: unknown[] = [opts.workspaceId, opts.windowStart, opts.windowEnd];
  let idx = 4;

  if (opts.assetId) {
    conditions.push(`asset_id = ?${idx}`);
    params.push(opts.assetId);
    idx++;
  }
  if (opts.channel) {
    conditions.push(`channel = ?${idx}`);
    params.push(opts.channel);
    idx++;
  }

  const where = conditions.join(' AND ');

  const result = await db
    .prepare(
      `SELECT
         asset_id,
         channel,
         event_type,
         count,
         metrics_json,
         recorded_at
       FROM performance_events
       WHERE ${where}
       ORDER BY recorded_at ASC`,
    )
    .bind(...params)
    .all<PerformanceEventRow>();

  const rows = result.results ?? [];
  if (rows.length === 0) {
    return [];
  }

  // Group by asset_id + channel
  const byAssetChannel = new Map<string, PerformanceEventRow[]>();

  for (const row of rows) {
    const key = `${row.asset_id}|${row.channel ?? 'unknown'}`;
    if (!byAssetChannel.has(key)) byAssetChannel.set(key, []);
    byAssetChannel.get(key)!.push(row);
  }

  const metricsList: PerformanceMetrics[] = [];

  for (const [key, assetRows] of byAssetChannel) {
    metricsList.push(buildAssetMetrics(key, assetRows, opts.workspaceId));
  }

  return metricsList;
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