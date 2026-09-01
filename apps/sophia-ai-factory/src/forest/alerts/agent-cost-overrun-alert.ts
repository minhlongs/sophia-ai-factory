/**
 * Agent Cost Overrun Alert — fires when a mission's spend approaches or
 * exceeds its budget, or when hourly burn rate projects over-budget.
 *
 * Layer: forest (infrastructure orchestrator). Imports tree only.
 * Dispatch path: createRealtimeAlert (tree/alerts) → user_alerts D1 table.
 * MED-1 compliant: imports from @/tree/alerts, NOT @/land/alerts.
 *
 * @module forest/alerts/agent-cost-overrun-alert
 */

import { createRealtimeAlert } from '@/tree/alerts/realtime-alert-service';
import { logger } from '@/seed/utils/logger-utility';

/**
 * Fire a tenant alert when agent cost overrun is detected.
 * Recipient = workspace owner user_id (tenant-facing, customer money).
 * Idempotent: caller is responsible for KV throttle before invoking.
 */
export interface AgentCostOverrunAlertParams {
  missionId: string;
  workspaceId: string;
  ownerUserId: string;
  budgetCents: number;
  spentCents: number;
  spendPercent: number;
  projectedPercent?: number;
  hourlyBurnRateCents: number;
  timeframeEnd: number;
  severity: 'high' | 'critical';
}

export async function triggerAgentCostOverrunAlert(
  params: AgentCostOverrunAlertParams
): Promise<string | null> {
  try {
    const budgetDollars = (params.budgetCents / 100).toFixed(2);
    const spentDollars = (params.spentCents / 100).toFixed(2);
    const hourlyBurnDollars = (params.hourlyBurnRateCents / 100).toFixed(2);
    const spendPercent = Math.round(params.spendPercent * 100) / 100;
    const projectedPercent = params.projectedPercent
      ? Math.round(params.projectedPercent * 100) / 100
      : null;

    const isCritical = params.severity === 'critical';

    const title = isCritical
      ? `⚠️ Mission ${params.missionId} OVER BUDGET`
      : `Mission ${params.missionId} budget at ${spendPercent}%`;

    const message = isCritical
      ? `Mission ${params.missionId} OVER BUDGET: ${spendPercent}% ($${spentDollars}/$${budgetDollars}). Immediate review required.`
      : `Mission ${params.missionId} at ${spendPercent}% of budget ($${spentDollars}/$${budgetDollars}). Projected: ${projectedPercent ?? 'N/A'}%. Hourly burn: $${hourlyBurnDollars}/hr.`;

    return await createRealtimeAlert({
      userId: params.ownerUserId,
      licenseNonce: '',
      type: 'platform.agent_cost_overrun',
      severity: isCritical ? 'critical' : 'high',
      title,
      message,
      metadata: {
        missionId: params.missionId,
        workspaceId: params.workspaceId,
        ownerUserId: params.ownerUserId,
        budgetCents: params.budgetCents,
        spentCents: params.spentCents,
        budgetDollars,
        spentDollars,
        spendPercent,
        projectedPercent,
        hourlyBurnRateCents: params.hourlyBurnRateCents,
        hourlyBurnDollars,
        timeframeEnd: params.timeframeEnd,
        reason: 'AGENT_COST_OVERRUN',
      },
      expiresAt: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000), // 3 days
    });
  } catch (err) {
    logger.error('[agent-cost-overrun-alert] dispatch failed', {
      missionId: params.missionId,
      workspaceId: params.workspaceId,
      error: err instanceof Error ? err.message : String(err),
    });
    return null;
  }
}