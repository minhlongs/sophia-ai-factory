/**
 * Creative Quality Drift Alert — fires when creative acceptance rate drops
 * significantly below the 7-day hourly baseline, or SOP quality degrades.
 *
 * Layer: forest (infrastructure orchestrator). Imports tree only.
 * Dispatch path: createRealtimeAlert (tree/alerts) → user_alerts D1 table.
 * MED-1 compliant: imports from @/tree/alerts, NOT @/land/alerts.
 *
 * @module forest/alerts/creative-quality-drift-alert
 */

import { createRealtimeAlert } from '@/tree/alerts/realtime-alert-service';
import { logger } from '@/seed/utils/logger-utility';
import { SYNTHETIC_USER_ID } from '@/seed/config/synthetic-monitoring';

/**
 * Fire a platform alert when creative quality drift is detected.
 * Recipient = synthetic-monitor user (platform-level, systemic issue).
 * Idempotent: caller is responsible for KV throttle before invoking.
 */
export interface CreativeQualityDriftAlertParams {
  workspaceId: string;
  currentAcceptanceRate: number;
  baselineAcceptanceRate: number;
  driftRatio: number;
  acceptedCount: number;
  rejectedCount: number;
  sopTemplateId?: string;
  currentSopQuality?: number;
  baselineSopQuality?: number;
}

export async function triggerCreativeQualityDriftAlert(
  params: CreativeQualityDriftAlertParams
): Promise<string | null> {
  try {
    const currentRatePct = Math.round(params.currentAcceptanceRate * 10000) / 100;
    const baselineRatePct = Math.round(params.baselineAcceptanceRate * 10000) / 100;
    const driftRatio = Math.round(params.driftRatio * 100) / 100;

    // Determine severity
    const severity = params.driftRatio < 0.70 ? 'high' : 'medium';

    // Build SOP quality message if available
    let sopPart = '';
    if (params.sopTemplateId && params.currentSopQuality !== undefined && params.baselineSopQuality !== undefined) {
      const currentSopPct = Math.round(params.currentSopQuality * 10000) / 100;
      const baselineSopPct = Math.round(params.baselineSopQuality * 10000) / 100;
      sopPart = ` SOP quality: ${currentSopPct}% (baseline: ${baselineSopPct}%).`;
    }

    return await createRealtimeAlert({
      userId: SYNTHETIC_USER_ID,
      licenseNonce: '',
      type: 'platform.creative_quality_drift',
      severity,
      title: `Creative quality drift detected for workspace ${params.workspaceId}`,
      message: `Creative quality drift detected for workspace ${params.workspaceId}: acceptance rate dropped to ${currentRatePct}% (baseline: ${baselineRatePct}%, drift: ${driftRatio}x). Accepted: ${params.acceptedCount}, Rejected: ${params.rejectedCount}.${sopPart}`,
      metadata: {
        workspaceId: params.workspaceId,
        currentAcceptanceRate: params.currentAcceptanceRate,
        baselineAcceptanceRate: params.baselineAcceptanceRate,
        currentRatePct,
        baselineRatePct,
        driftRatio,
        acceptedCount: params.acceptedCount,
        rejectedCount: params.rejectedCount,
        sopTemplateId: params.sopTemplateId,
        currentSopQuality: params.currentSopQuality,
        baselineSopQuality: params.baselineSopQuality,
        reason: 'CREATIVE_QUALITY_DRIFT',
      },
      expiresAt: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000), // 3 days
    });
  } catch (err) {
    logger.error('[creative-quality-drift-alert] dispatch failed', {
      workspaceId: params.workspaceId,
      error: err instanceof Error ? err.message : String(err),
    });
    return null;
  }
}