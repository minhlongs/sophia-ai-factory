/**
 * Mission Abandon Spike Alert — fires when mission.abandoned event count
 * in a trailing window exceeds a per-workspace baseline by a multiplier.
 *
 * Layer: forest (infrastructure orchestrator). Imports tree only.
 * Dispatch path: createRealtimeAlert (tree/alerts) → user_alerts D1 table.
 * MED-1 compliant: imports from @/tree/alerts, NOT @/land/alerts.
 *
 * @module forest/alerts/mission-abandon-alert
 */

import { createRealtimeAlert } from '@/tree/alerts/realtime-alert-service';
import { logger } from '@/seed/utils/logger-utility';
import { SYNTHETIC_USER_ID } from '@/seed/config/synthetic-monitoring';

/**
 * Fire a platform alert when mission-abandon spike is detected globally.
 * Recipient = synthetic-monitor user (platform-wide SLO breach, not tenant-specific).
 * Idempotent: caller is responsible for KV throttle before invoking.
 */
export async function triggerMissionAbandonSpikeAlert(params: {
  windowAbandons: number;
  baselineAbandons: number;
  multiplier: number;
  windowMs: number;
}): Promise<string | null> {
  try {
    const ratio = params.baselineAbandons > 0
      ? (params.windowAbandons / params.baselineAbandons).toFixed(2)
      : 'inf';

    const windowMinutes = Math.round(params.windowMs / 60000);

    return await createRealtimeAlert({
      userId: SYNTHETIC_USER_ID,
      licenseNonce: '',
      type: 'platform.mission_abandon_spike',
      severity: 'critical',
      title: 'Mission Abandon Spike',
      message: `${params.windowAbandons} abandons in ${windowMinutes}m — ${ratio}x above baseline (${params.baselineAbandons}).`,
      metadata: {
        windowAbandons: params.windowAbandons,
        baselineAbandons: params.baselineAbandons,
        multiplier: params.multiplier,
        ratio,
        windowMs: params.windowMs,
        reason: 'MISSION_ABANDON_SPIKE',
      },
      expiresAt: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
    });
  } catch (err) {
    logger.error('[mission-abandon-alert] dispatch failed', {
      error: err instanceof Error ? err.message : String(err),
    });
    return null;
  }
}
