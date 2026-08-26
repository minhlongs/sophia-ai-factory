/**
 * Production Monitoring — shared types for the autonomous-factory dashboard.
 *
 * Layer: land (business domain workflows). Imports seed only.
 *
 * Timestamp discipline (verified against migration 0257 + 0240):
 *   - production_graph_runs.created_at/started_at/ended_at: MILLISECONDS
 *   - agent_approvals.created_at/resolved_at/timeout_at: SECONDS (unixepoch())
 * All public shapes expose milliseconds; conversions happen at the SQL boundary.
 *
 * @module land/production-monitoring/types
 */

import type { Result } from '@/seed/types/result';

/** Error shape returned by every production-monitoring action. */
export interface ProductionMonitoringError {
  code: 'NOT_AUTHENTICATED' | 'FORBIDDEN' | 'VALIDATION_ERROR' | 'INTERNAL';
  message: string;
}

/** Union result type used by production-monitoring actions. */
export type ProductionMonitoringResult<T> = Result<T, ProductionMonitoringError>;

/**
 * The six roadmap KPIs for the autonomous production pipeline.
 * All ratios are percentages in [0, 100]; null = undefined ratio (no data).
 */
export interface ProductionDashboardSummary {
  /** completed / (completed + failed) over production_graph_runs; null when no terminal runs. */
  completionPct: number | null;
  /** Median hours from approval created_at to resolved_at; null when no resolved approvals. */
  approvalTurnaroundMedianHours: number | null;
  /** completed runs with retry_count > 0 / all completed runs; null when no completed runs. */
  retrySuccessPct: number | null;
  /** Mean total_cost_cents over terminal runs; null when no terminal runs. */
  avgSpendPerRunCents: number | null;
  /** Runs currently queued, running, or awaiting approval. */
  activeRuns: number;
  /** Approvals still pending a human decision. */
  pendingApprovals: number;
}

/** One pending approval row surfaced on the dashboard. */
export interface PendingApprovalRow {
  id: string;
  agentRunId: string;
  actionType: string;
  actionSummary: string;
  /** Estimated cost in INTEGER cents; null when the producer did not estimate. */
  estimatedCostCents: number | null;
  createdAtMs: number;
  /** Deadline in milliseconds; null when no timeout was set. */
  timeoutAtMs: number | null;
}
