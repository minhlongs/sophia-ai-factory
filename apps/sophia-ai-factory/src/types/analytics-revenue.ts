/**
 * Revenue analytics types — NOWPayments-backed ARR/MRR snapshot.
 *
 * Used by:
 * - GET /api/analytics/revenue
 * - <RevenueCard /> component
 * - Phase 04 LTV calculator (consumes byTier)
 */

import type { Tier } from '@/types';

// ── Tier revenue breakdown ──────────────────────────────────────────────────

/** Per-tier revenue row returned from D1 aggregate queries */
export interface TierRevenueRow {
  tier: Tier;
  /** Number of active customers on this tier */
  customers: number;
  /** Monthly Recurring Revenue for this tier (USD) */
  mrr: number;
  /** Annual Recurring Revenue = mrr × 12 */
  arr: number;
}

// ── Trend data ──────────────────────────────────────────────────────────────

/** Single data point for the ARR/MRR trend sparkline */
export interface ARRTrendPoint {
  /** ISO date string YYYY-MM-DD */
  date: string;
  arr: number;
  mrr: number;
}

// ── Full snapshot ───────────────────────────────────────────────────────────

/** Complete revenue snapshot returned by the API */
export interface RevenueSnapshot {
  /** Annual Recurring Revenue = mrr × 12 (USD) */
  arr: number;
  /** Monthly Recurring Revenue (USD) */
  mrr: number;
  /** MRR growth % vs 30 days ago; null when no prior data */
  mrrGrowthPct: number | null;
  /** Per-tier breakdown */
  byTier: TierRevenueRow[];
  /** Daily trend data for sparkline (ordered ascending) */
  trend30d: ARRTrendPoint[];
  /** ISO 8601 — start of the requested period */
  periodStart: string;
  /** ISO 8601 — end of the requested period */
  periodEnd: string;
}

// ── Query params ────────────────────────────────────────────────────────────

/** Validated period filter values */
export type RevenuePeriod = '30d' | '90d' | '12m';

/** Validated query params for GET /api/analytics/revenue */
export interface RevenueQueryParams {
  period: RevenuePeriod;
  /** Cross-tenant filter — admin only */
  org_id?: string;
}
