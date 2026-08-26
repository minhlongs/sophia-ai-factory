/**
 * Production alert triggers — alerts emitted by the autonomous production pipeline.
 *
 * Three triggers matching the three production failure modes:
 *   1. RETRIES_EXHAUSTED — run cancelled because max retries exhausted
 *   2. Approval expired — approval pending beyond its timeout_at deadline
 *   3. Budget cap — run total_cost_cents reached or exceeded the mission-type cap
 *
 * Uses createRealtimeAlert from the same tree/alerts layer. The caller owns
 * user/nonce resolution; these are pure dispatch functions.
 *
 * @module tree/alerts/production-alert-triggers
 */

import { createRealtimeAlert } from './realtime-alert-mutations';
import type { AlertSeverity } from './realtime-alert-types';

/**
 * Fire an alert when a production run is cancelled because retries are exhausted.
 * Triggered by the rollback cron or graph runner when retry_count >= max_auto_retries.
 */
export async function triggerRetriesExhaustedAlert(params: {
  userId: string;
  licenseNonce: string;
  graphRunId: string;
  missionId: string;
  retryCount: number;
  maxRetries: number;
}): Promise<string | null> {
  return createRealtimeAlert({
    userId: params.userId,
    licenseNonce: params.licenseNonce,
    type: 'production.run_cancelled',
    severity: 'high',
    title: 'Production Run Cancelled — Retries Exhausted',
    message: `Run ${params.graphRunId.slice(0, 8)} was cancelled after ${params.retryCount}/${params.maxRetries} retries.`,
    metadata: {
      graphRunId: params.graphRunId,
      missionId: params.missionId,
      retryCount: params.retryCount,
      maxRetries: params.maxRetries,
      reason: 'RETRIES_EXHAUSTED',
    },
    expiresAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
  });
}

/**
 * Fire an alert when an approval has expired past its timeout_at deadline.
 * Triggered by the approval timeout cron (approval-timeout-cron.ts).
 */
export async function triggerApprovalExpiredAlert(params: {
  userId: string;
  licenseNonce: string;
  approvalId: string;
  agentRunId: string;
  actionType: string;
  timeoutMs: number;
  elapsedMs: number;
}): Promise<string | null> {
  const hoursOver = Math.max(0, Math.round((params.elapsedMs - params.timeoutMs) / 3_600_000 * 10) / 10);

  return createRealtimeAlert({
    userId: params.userId,
    licenseNonce: params.licenseNonce,
    type: 'production.approval_expired',
    severity: hoursOver > 4 ? 'critical' : 'medium',
    title: 'Approval Deadline Expired',
    message: `Approval ${params.approvalId.slice(0, 8)} for action "${params.actionType}" has expired${hoursOver > 0 ? ` (was ${hoursOver}h overdue)` : ''}.`,
    metadata: {
      approvalId: params.approvalId,
      agentRunId: params.agentRunId,
      actionType: params.actionType,
      timeoutMs: params.timeoutMs,
      elapsedMs: params.elapsedMs,
      hoursOverdue: hoursOver,
    },
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
  });
}

/**
 * Fire an alert when a run's total cost has reached the mission-type budget cap.
 * Triggered by the rollback cron or graph runner after a cost update.
 */
export async function triggerBudgetCapAlert(params: {
  userId: string;
  licenseNonce: string;
  graphRunId: string;
  missionId: string;
  totalCostCents: number;
  budgetCapCents: number;
}): Promise<string | null> {
  const pct = params.budgetCapCents > 0
    ? Math.round((params.totalCostCents / params.budgetCapCents) * 100)
    : 100;

  const severity: AlertSeverity = pct >= 100 ? 'high' : 'medium';

  return createRealtimeAlert({
    userId: params.userId,
    licenseNonce: params.licenseNonce,
    type: 'production.budget_cap',
    severity,
    title: pct >= 100 ? 'Budget Cap Reached' : 'Budget Cap Warning',
    message: pct >= 100
      ? `Run ${params.graphRunId.slice(0, 8)} reached the budget cap ($${(params.totalCostCents / 100).toFixed(2)}).`
      : `Run ${params.graphRunId.slice(0, 8)} is at ${pct}% of its budget cap ($${(params.totalCostCents / 100).toFixed(2)} / $${(params.budgetCapCents / 100).toFixed(2)}).`,
    metadata: {
      graphRunId: params.graphRunId,
      missionId: params.missionId,
      totalCostCents: params.totalCostCents,
      budgetCapCents: params.budgetCapCents,
      percentUsed: pct,
    },
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
  });
}
