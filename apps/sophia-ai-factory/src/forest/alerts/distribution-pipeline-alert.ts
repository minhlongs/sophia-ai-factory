/**
 * Distribution Pipeline Alert — fires when distribution pipeline health degrades
 * (failure rate spike, latency p95 degradation, or zero-post stall).
 *
 * Layer: forest (infrastructure orchestrator). Imports tree only.
 * Dispatch path: createRealtimeAlert (tree/alerts) → user_alerts D1 table.
 * MED-1 compliant: imports from @/tree/alerts, NOT @/land/alerts.
 *
 * @module forest/alerts/distribution-pipeline-alert
 */

import { createRealtimeAlert } from '@/tree/alerts/realtime-alert-service';
import { logger } from '@/seed/utils/logger-utility';
import { SYNTHETIC_USER_ID } from '@/seed/config/synthetic-monitoring';

/**
 * Fire a platform alert when distribution pipeline health degrades.
 * Recipient = synthetic-monitor user (platform-level, not tenant-specific).
 * Idempotent: caller is responsible for KV throttle before invoking.
 */
export interface DistributionPipelineAlertParams {
  workspaceId: string;
  platform: string;
  failedCount: number;
  totalCount: number;
  failureRate: number;
  baselineFailureRate: number;
  p95LatencyMs: number;
  baselineP95LatencyMs: number;
  failureTaxonomy: Record<string, number>;
}

export async function triggerDistributionPipelineAlert(
  params: DistributionPipelineAlertParams
): Promise<string | null> {
  try {
    const failureRatePct = Math.round(params.failureRate * 10000) / 100;
    const baselineRatePct = Math.round(params.baselineFailureRate * 10000) / 100;

    // Determine severity
    const severity = params.failureRate > 0.20 || params.p95LatencyMs > params.baselineP95LatencyMs * 2
      ? 'high'
      : 'medium';

    // Build taxonomy summary for message
    const taxonomyEntries = Object.entries(params.failureTaxonomy)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([error, count]) => `${error}: ${count}`)
      .join('; ');
    const taxonomySummary = taxonomyEntries || 'none';

    return await createRealtimeAlert({
      userId: SYNTHETIC_USER_ID,
      licenseNonce: '',
      type: 'platform.distribution_pipeline',
      severity,
      title: `Distribution pipeline degraded on ${params.platform}`,
      message: `Distribution pipeline degraded on ${params.platform}: ${params.failedCount}/${params.totalCount} failed (${failureRatePct}% vs ${baselineRatePct}% baseline). Latency p95: ${params.p95LatencyMs}ms (baseline: ${params.baselineP95LatencyMs}ms). Top errors: ${taxonomySummary}`,
      metadata: {
        workspaceId: params.workspaceId,
        platform: params.platform,
        failedCount: params.failedCount,
        totalCount: params.totalCount,
        failureRate: params.failureRate,
        baselineFailureRate: params.baselineFailureRate,
        failureRatePct,
        baselineRatePct,
        p95LatencyMs: params.p95LatencyMs,
        baselineP95LatencyMs: params.baselineP95LatencyMs,
        failureTaxonomy: params.failureTaxonomy,
        taxonomySummary,
        reason: 'DISTRIBUTION_PIPELINE_DEGRADED',
      },
      expiresAt: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000), // 3 days
    });
  } catch (err) {
    logger.error('[distribution-pipeline-alert] dispatch failed', {
      workspaceId: params.workspaceId,
      platform: params.platform,
      error: err instanceof Error ? err.message : String(err),
    });
    return null;
  }
}