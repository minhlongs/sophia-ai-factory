/**
 * Production Monitoring — dashboard summary for the autonomous factory.
 *
 * Computes the six roadmap KPIs (pipeline completion %, approval turnaround
 * median, retry success %, spend/run, active runs, pending approvals) from
 * production_graph_runs (migration 0257) and agent_approvals (migration 0240).
 *
 * Pure read module: no auth here. Callers (server page / server action) must
 * resolve and verify workspace membership before invoking these functions.
 *
 * Timestamp discipline: production_graph_runs stores MILLISECONDS;
 * agent_approvals stores SECONDS — converted to ms at this boundary.
 *
 * @module land/production-monitoring/dashboard-summary
 */

import { createServerClient } from '@/seed/db/client';
import { success, failure } from '@/seed/types/result';
import { logger } from '@/seed/utils/logger-utility';
import { toError } from '@/seed/utils/to-error';
import type {
  PendingApprovalRow,
  ProductionDashboardSummary,
  ProductionMonitoringResult,
} from './types';

interface RunAggregateRow {
  completed_count: number | null;
  failed_count: number | null;
  retried_completed_count: number | null;
  terminal_cost_cents: number | null;
  active_runs: number | null;
}

interface ApprovalDurationRow {
  duration_sec: number;
}

interface PendingApprovalDbRow {
  id: string;
  agent_run_id: string;
  action_type: string;
  action_summary: string;
  estimated_cost_cents: number | null;
  created_at: number;
  timeout_at: number | null;
}

/** Round to one decimal place (KPI display precision). */
function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

/** Median of a pre-sorted ascending array; null when empty. */
function medianOfSorted(values: number[]): number | null {
  if (values.length === 0) return null;
  const mid = Math.floor(values.length / 2);
  if (values.length % 2 === 1) return values[mid];
  return (values[mid - 1] + values[mid]) / 2;
}

/**
 * Compute the six production KPIs for a workspace.
 * Empty database is safe: every ratio degrades to null, counts to 0.
 */
export async function getProductionDashboardSummary(
  workspaceId: string,
): Promise<ProductionMonitoringResult<ProductionDashboardSummary>> {
  try {
    const db = createServerClient();

    const runRow = await db
      .prepare(
        `SELECT
           SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) AS completed_count,
           SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) AS failed_count,
           SUM(CASE WHEN status = 'completed' AND retry_count > 0 THEN 1 ELSE 0 END) AS retried_completed_count,
           SUM(CASE WHEN status IN ('completed', 'failed') THEN total_cost_cents ELSE 0 END) AS terminal_cost_cents,
           SUM(CASE WHEN status IN ('queued', 'running', 'awaiting_approval') THEN 1 ELSE 0 END) AS active_runs
         FROM production_graph_runs
         WHERE workspace_id = ?1`,
      )
      .bind(workspaceId)
      .first<RunAggregateRow>();

    const completed = runRow?.completed_count ?? 0;
    const failed = runRow?.failed_count ?? 0;
    const retriedCompleted = runRow?.retried_completed_count ?? 0;
    const terminalCostCents = runRow?.terminal_cost_cents ?? 0;
    const activeRuns = runRow?.active_runs ?? 0;
    const terminalCount = completed + failed;

    // Approval turnaround: durations of resolved approvals, ascending for median.
    // agent_approvals has no workspace column — scope via the owning agent run.
    const durationRows = await db
      .prepare(
        `SELECT (aa.resolved_at - aa.created_at) AS duration_sec
         FROM agent_approvals aa
         JOIN agent_runs ar ON ar.id = aa.agent_run_id
         WHERE ar.workspace_id = ?1
           AND aa.status IN ('approved', 'rejected')
           AND aa.resolved_at IS NOT NULL
         ORDER BY duration_sec ASC`,
      )
      .bind(workspaceId)
      .all<ApprovalDurationRow>();

    const durationsSec = (durationRows.results ?? []).map((r) => r.duration_sec);
    const medianSec = medianOfSorted(durationsSec);

    const pendingRow = await db
      .prepare(
        `SELECT COUNT(*) AS pending_count
         FROM agent_approvals aa
         JOIN agent_runs ar ON ar.id = aa.agent_run_id
         WHERE ar.workspace_id = ?1 AND aa.status = 'pending'`,
      )
      .bind(workspaceId)
      .first<{ pending_count: number | null }>();

    return success({
      completionPct: terminalCount > 0 ? round1((completed / terminalCount) * 100) : null,
      approvalTurnaroundMedianHours:
        medianSec !== null ? round1(medianSec / 3600) : null,
      retrySuccessPct: completed > 0 ? round1((retriedCompleted / completed) * 100) : null,
      avgSpendPerRunCents:
        terminalCount > 0 ? Math.round(terminalCostCents / terminalCount) : null,
      activeRuns,
      pendingApprovals: pendingRow?.pending_count ?? 0,
    });
  } catch (err) {
    const error = toError(err);
    logger.error('[ProductionMonitoring] getProductionDashboardSummary failed', error);
    return failure({ code: 'INTERNAL', message: error.message });
  }
}

/**
 * List pending approvals for a workspace, oldest first.
 * Scoped via the owning agent run (agent_approvals has no workspace column).
 */
export async function getPendingApprovals(
  workspaceId: string,
  limit: number,
): Promise<ProductionMonitoringResult<PendingApprovalRow[]>> {
  try {
    const db = createServerClient();

    const rows = await db
      .prepare(
        `SELECT aa.id, aa.agent_run_id, aa.action_type, aa.action_summary,
                aa.estimated_cost_cents, aa.created_at, aa.timeout_at
         FROM agent_approvals aa
         JOIN agent_runs ar ON ar.id = aa.agent_run_id
         WHERE ar.workspace_id = ?1 AND aa.status = 'pending'
         ORDER BY aa.created_at ASC
         LIMIT ?2`,
      )
      .bind(workspaceId, limit)
      .all<PendingApprovalDbRow>();

    const approvals = (rows.results ?? []).map((r) => ({
      id: r.id,
      agentRunId: r.agent_run_id,
      actionType: r.action_type,
      actionSummary: r.action_summary,
      estimatedCostCents: r.estimated_cost_cents,
      createdAtMs: r.created_at * 1000,
      timeoutAtMs: r.timeout_at !== null ? r.timeout_at * 1000 : null,
    }));

    return success(approvals);
  } catch (err) {
    const error = toError(err);
    logger.error('[ProductionMonitoring] getPendingApprovals failed', error);
    return failure({ code: 'INTERNAL', message: error.message });
  }
}
