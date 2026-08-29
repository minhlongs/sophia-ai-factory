/**
 * Creative Economy Dashboard — shared types for the read-only surfacing slice.
 *
 * Layer: land (business domain workflows). Imports seed only.
 *
 * Timestamp discipline (verified against producers):
 *   - performance_events / learning_velocity / creative_memory: MILLISECONDS
 *   - sop_executions.created_at: SECONDS
 * All public shapes below expose milliseconds unless the field name ends in
 * `_sec`/`Sec`. Conversions happen at each module's boundary.
 *
 * Cost semantics decision: there is no `event_type='cost'` producer. Agent
 * mission spend is written as `event_type='mission_completed'` with
 * `value_cents = costCents` (agent-mission-executor.ts). This dashboard
 * therefore treats mission_completed rows as the cost side.
 *
 * @module land/creative-economy/types
 */

import type { Result } from '@/seed/types/result';

/** Error shape returned by every creative-economy action. */
export interface DashboardError {
  code: 'NOT_AUTHENTICATED' | 'FORBIDDEN' | 'DB_ERROR' | 'VALIDATION_ERROR' | 'INTERNAL';
  message: string;
}

/** 30-day revenue/cost/net summary. */
export interface DashboardSummary {
  revenueCents: number;
  costCents: number;
  netCents: number;
  eventCount: number;
  windowDays: number;
  /** ROI percent ((revenue - cost) / cost * 100); null when cost <= 0. */
  roiPct?: number | null;
}

/** One aggregated asset row for the top-assets table. */
export interface AssetPerformanceRow {
  assetId: string;
  projectId: string;
  channel: string;
  impressions: number;
  revenueCents: number;
  costCents: number;
  /** ROI percent, null when revenue is zero (undefined ratio). */
  roiPct: number | null;
}

/** Latest learning stored in creative_memory. */
export interface MemoryInsight {
  id: string;
  category: string;
  key: string;
  title: string;
  summary: string;
  confidence: string;
  createdAtMs: number;
}

/** Health status of one auto-apply playbook installation. */
export interface PlaybookHealthRow {
  installationId: string;
  ruleId: string;
  status: 'healthy' | 'at_risk' | 'rolled_back';
  recentFailureRate: number;
  baselineFailureRate: number;
  lastRollbackAtSec: number | null;
}

/** One precomputed velocity data point from the learning_velocity table. */
export interface VelocityPoint {
  entityType: string;
  channel: string;
  velocityScore: number;
  eventCount: number;
  windowStartMs: number;
  windowEndMs: number;
}

/**
 * One mission-scoped economic measurement boundary (Phase H).
 *
 * Every cost / outcome field is nullable. A missing source datum is NULL —
 * the writer never synthesizes a value and never computes ROI. Callers that
 * need ROI must compute it themselves, and only when both revenue AND a cost
 * are present (see SOPHIA_VALUE_SCORECARD.md Group 6).
 *
 * Source-of-truth map:
 *   creative_cost   → recordSpend totals (tree/mission/repository.ts)
 *   production_cost → recordSpend totals
 *   distribution_cost → recordSpend totals
 *   revenue         → existing idempotent revenue bridges (YouTube / TikTok /
 *                     ad-revenue / sponsorship / affiliate / commerce →
 *                     performance_events)
 *   leads           → NO producer. Always NULL.
 *   conversions     → NO producer. Always NULL.
 *
 * @module land/creative-economy/types
 */
export interface CreativeEconomicSnapshot {
  id: string;
  workspaceId: string;
  missionId: string | null;
  creativeCost: number | null;
  productionCost: number | null;
  distributionCost: number | null;
  leads: number | null;
  conversions: number | null;
  revenue: number | null;
  recordedAt: number;
}

/** Union result type used by all five actions. */
export type DashboardResult<T> = Result<T, DashboardError>;
