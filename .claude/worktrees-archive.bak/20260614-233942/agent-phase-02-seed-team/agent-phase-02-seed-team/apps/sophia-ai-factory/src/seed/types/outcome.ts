/**
 * Outcome tracking types — metrics recorded after SOP execution completes.
 * Used by outcome-tracking-repo.ts to persist and query performance data.
 * @module seed/types/outcome
 */

// ── Metric type enum ──────────────────────────────────────────────────────────

/** Supported metric categories for SOP execution outcomes. */
export type OutcomeMetricType =
  | 'video_views'
  | 'click_through_rate'
  | 'revenue_cents'
  | 'engagement_rate'
  | 'subscriber_gain'
  | 'share_count'
  | 'comment_count';

// ── Row types ─────────────────────────────────────────────────────────────────

/** Single outcome metric row (camelCase, post-mapping from DB snake_case). */
export interface OutcomeMetric {
  id: string;
  executionId: string;
  sopId: string;
  userId: string;
  metricType: OutcomeMetricType;
  metricValue: number;
  source?: string;
  recordedAt: number; // Unix seconds
}

// ── Aggregate types ───────────────────────────────────────────────────────────

/** Aggregated outcome summary for a single SOP over a time period. */
export interface OutcomeSummary {
  sopId: string;
  totalExecutions: number;
  avgViews: number;
  avgCtr: number;
  totalRevenueCents: number;
  avgEngagement: number;
  period: { fromDate?: number; toDate?: number };
}

/** Per-SOP outcome summary for a specific creator/user. */
export interface CreatorSopOutcome {
  sopId: string;
  userId: string;
  executionCount: number;
  metrics: Partial<Record<OutcomeMetricType, number>>; // avg per metric_type
}
