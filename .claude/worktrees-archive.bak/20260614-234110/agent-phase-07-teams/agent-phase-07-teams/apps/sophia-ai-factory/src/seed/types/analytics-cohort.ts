/**
 * Cohort retention, churn, and LTV analytics types.
 *
 * Used by:
 * - GET /api/analytics/cohorts
 * - <CohortRetentionChart />, <ChurnTimeline />, <LTVCalculator />
 * - Phase 04 cohort / churn / ltv calculators
 */

import type { Tier } from '@/seed/types';

// ── Cohort retention ────────────────────────────────────────────────────────

/**
 * One row in the retention heatmap.
 * Month 0 is always 100 (signup month itself).
 */
export interface CohortRow {
  /** ISO YYYY-MM or "unknown" for NULL created_at */
  cohortMonth: string;
  /** Number of users who signed up in this cohort month */
  usersAtStart: number;
  /**
   * Retention percentage at each subsequent month offset.
   * Index 0 = signup month (100%), index 1 = month 1, etc.
   * Max 12 months tracked.
   */
  retentionByMonth: number[];
}

/** Full cohort retention matrix returned by the retention endpoint */
export interface CohortRetentionMatrix {
  cohorts: CohortRow[];
  /** Months tracked (1–24) */
  monthsTracked: number;
}

// ── Churn timeline ──────────────────────────────────────────────────────────

/** A single tier change / cancellation event */
export interface ChurnEvent {
  userId: string;
  /** Tier before the change, or null for first activation */
  fromTier: string | null;
  /** Tier after the change, or null for cancellation */
  toTier: string | null;
  /** ISO 8601 datetime string */
  eventDate: string;
  eventType: 'upgrade' | 'downgrade' | 'cancel' | 'activate';
}

/** One data point in the churn timeline */
export interface ChurnTimelinePoint {
  /** ISO YYYY-MM-DD */
  date: string;
  /** Users who cancelled (to_tier = null) */
  churnedCount: number;
  /** Users who downgraded to a lower tier */
  downgradedCount: number;
  /** Active users at start of this period (for rate calc) */
  activeAtStart: number;
  /** churnedCount / activeAtStart; 0 when activeAtStart = 0 */
  churnRate: number;
}

/** Churn timeline result returned by the churn endpoint */
export interface ChurnTimeline {
  points: ChurnTimelinePoint[];
  /** Average monthly churn rate over the window */
  avgMonthlyChurnRate: number;
  downgrades: ChurnEvent[];
  cancellations: ChurnEvent[];
}

// ── LTV ─────────────────────────────────────────────────────────────────────

/** LTV metrics for a single tier */
export interface TierLTVRow {
  tier: Tier;
  /** Average Revenue Per User (USD/month) */
  arpu: number;
  /** Average lifetime in months (capped at 24) */
  avgLifetimeMonths: number;
  /** LTV = arpu × avgLifetimeMonths */
  ltv: number;
  /** Number of active customers in this tier */
  customers: number;
}

/** Full LTV result returned by the ltv endpoint */
export interface LTVByTier {
  tiers: TierLTVRow[];
  /** LTV:CAC ratio per tier — populated only if cac provided in request */
  ltvCacRatios?: Record<string, number | null>;
}

/** Optional CAC override map passed as query param */
export type CACOverrideMap = Partial<Record<Tier, number>>;

// ── API query params ─────────────────────────────────────────────────────────

export type CohortMetric = 'retention' | 'churn' | 'ltv';

export interface CohortQueryParams {
  metric: CohortMetric;
  /** Optional tier filter (applies to retention + churn) */
  tier?: Tier;
  /** Number of months to track (1–24, default 12) */
  months: number;
}
