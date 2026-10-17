/**
 * Production Monitoring — Pending Approvals & KPI Math Helpers
 *
 * @module land/production-monitoring/dashboard-approvals
 */

import { createServerClient } from '@/seed/db/client';
import { success, failure } from '@/seed/types/result';
import { logger } from '@/seed/utils/logger-utility';
import { toError } from '@/seed/utils/to-error';
import type {
  PendingApprovalRow,
  ProductionMonitoringResult,
} from './types';

export interface RunAggregateRow {
  completed_count: number | null;
  failed_count: number | null;
  retried_completed_count: number | null;
  terminal_cost_cents: number | null;
  active_runs: number | null;
}

export interface ApprovalDurationRow {
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
export function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

/** Median of a pre-sorted ascending array; null when empty. */
export function medianOfSorted(values: number[]): number | null {
  if (values.length === 0) return null;
  const mid = Math.floor(values.length / 2);
  if (values.length % 2 === 1) return values[mid];
  return (values[mid - 1] + values[mid]) / 2;
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
