/**
 * Billing Anomaly Alert — fires when a workspace's MCU spend rate
 * exceeds the trailing-window baseline by a configurable multiplier.
 *
 * Layer: forest (infrastructure orchestrator). Imports tree only.
 * Dispatch path: createRealtimeAlert (tree/alerts) → user_alerts D1 table.
 * MED-1 compliant: imports from @/tree/alerts, NOT @/land/alerts.
 *
 * @module forest/alerts/billing-anomaly-alert
 */

import { createRealtimeAlert } from '@/tree/alerts/realtime-alert-service';
import { logger } from '@/seed/utils/logger-utility';

/**
 * Fire a platform alert when a billing anomaly is detected for a workspace.
 * Recipient = the workspace owner's user_id (tenant-facing).
 * Idempotent: caller is responsible for KV throttle before invoking.
 */
export async function triggerBillingAnomalyAlert(params: {
  userId: string;
  workspaceId: string;
  currentSpendCents: number;
  baselineSpendCents: number;
  multiplier: number;
}): Promise<string | null> {
  try {
    const ratio = params.baselineSpendCents > 0
      ? (params.currentSpendCents / params.baselineSpendCents).toFixed(2)
      : 'inf';

    return await createRealtimeAlert({
      userId: params.userId,
      licenseNonce: '',
      type: 'platform.billing_anomaly',
      severity: 'medium',
      title: 'Billing Anomaly Detected',
      message: `Spend ${ratio}x above baseline ($${(params.currentSpendCents / 100).toFixed(2)} vs $${((params.baselineSpendCents) / 100).toFixed(2)} expected).`,
      metadata: {
        workspaceId: params.workspaceId,
        currentSpendCents: params.currentSpendCents,
        baselineSpendCents: params.baselineSpendCents,
        multiplier: params.multiplier,
        ratio,
        reason: 'BILLING_ANOMALY',
      },
      expiresAt: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
    });
  } catch (err) {
    logger.error('[billing-anomaly-alert] dispatch failed', {
      userId: params.userId,
      error: err instanceof Error ? err.message : String(err),
    });
    return null;
  }
}
