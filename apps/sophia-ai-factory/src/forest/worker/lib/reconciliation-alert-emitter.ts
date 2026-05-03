/**
 * Reconciliation Alert Emitter
 *
 * Emits alerts for billing reconciliation discrepancies
 * to the /api/alerts endpoint.
 *
 * Features:
 * - Severity-based alerting (critical/high/medium/low)
 * - Rate limiting per user/threshold
 * - Webhook notification support
 *
 * @module worker/reconciliation-alert-emitter
 */

import type { ReconciliationAlert, Discrepancy } from '@/seed/types/billing-contracts';
import { logger } from '@/seed/utils/logger-utility';
import { toError } from '@/seed/utils/to-error';

/**
 * Alert emitter configuration
 */
export interface AlertEmitterConfig {
  alertsEndpoint: string;
  apiKey: string;
  rateLimitWindowMs: number;
  maxAlertsPerWindow: number;
}

/**
 * Default alert emitter configuration
 */
export const DEFAULT_ALERT_EMITTER_CONFIG: AlertEmitterConfig = {
  alertsEndpoint: process.env.NEXT_PUBLIC_APP_URL ? `${process.env.NEXT_PUBLIC_APP_URL}/api/alerts` : '/api/alerts',
  apiKey: '',
  rateLimitWindowMs: 60000, // 1 minute
  maxAlertsPerWindow: 10,
};

/**
 * Rate limit state stored in memory (for Worker execution)
 */
const rateLimitState = new Map<string, { count: number; windowStart: number }>();

/**
 * Check if alert is rate limited
 */
function isRateLimited(
  key: string,
  config: AlertEmitterConfig
): boolean {
  const now = Date.now();
  const state = rateLimitState.get(key);

  if (!state || (now - state.windowStart) > config.rateLimitWindowMs) {
    // New window
    rateLimitState.set(key, { count: 1, windowStart: now });
    return false;
  }

  if (state.count >= config.maxAlertsPerWindow) {
    return true;
  }

  state.count++;
  return false;
}

/**
 * Emit reconciliation alert to /api/alerts endpoint
 *
 * @param alert - Alert payload
 * @param config - Emitter configuration
 * @returns true if alert was emitted successfully
 */
export async function emitReconciliationAlert(
  alert: ReconciliationAlert,
  config: AlertEmitterConfig = DEFAULT_ALERT_EMITTER_CONFIG
): Promise<boolean> {
  // Rate limit check
  const rateLimitKey = `${alert.userId}:${alert.type}:${alert.severity}`;

  if (isRateLimited(rateLimitKey, config)) {
    logger.debug('[Alert Emitter] Alert rate limited', {
      userId: alert.userId,
      type: alert.type,
      severity: alert.severity,
    });
    return false;
  }

  try {
    const response = await fetch(config.alertsEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.apiKey}`,
        'User-Agent': 'RaaS-Gateway-Worker/1.0',
      },
      body: JSON.stringify({
        type: alert.type,
        severity: alert.severity,
        license_nonce: alert.licenseNonce,
        user_id: alert.userId,
        details: alert.details,
        timestamp: alert.timestamp,
        report_id: alert.reportId,
      }),
    });

    if (response.ok) {
      logger.info('[Alert Emitter] Alert emitted', {
        type: alert.type,
        severity: alert.severity,
        userId: alert.userId,
        licenseNonce: alert.licenseNonce.slice(0, 8) + '...',
      });
      return true;
    }

    logger.warn('[Alert Emitter] Alert emission failed', {
      status: response.status,
      type: alert.type,
    });
    return false;
  } catch (error) {
    logger.error('[Alert Emitter] Alert emission error', toError(error), {
      type: alert.type,
      userId: alert.userId,
    });
    return false;
  }
}

/**
 * Emit multiple alerts for discrepancies
 *
 * @param discrepancies - Array of discrepancies
 * @param config - Emitter configuration
 * @returns Number of alerts emitted successfully
 */
export async function emitDiscrepancyAlerts(
  discrepancies: Discrepancy[],
  config: AlertEmitterConfig = DEFAULT_ALERT_EMITTER_CONFIG
): Promise<number> {
  let emitted = 0;

  for (const discrepancy of discrepancies) {
    const alert: ReconciliationAlert = {
      type: 'discrepancy_detected',
      severity: discrepancy.severity === 'low' ? 'info' : discrepancy.severity,
      licenseNonce: discrepancy.licenseNonce,
      userId: discrepancy.userId,
      details: {
        discrepancyType: discrepancy.type,
        eventId: discrepancy.eventId,
        expectedCredits: discrepancy.details?.expected,
        actualCredits: discrepancy.details?.actual,
      },
      timestamp: discrepancy.timestamp,
    };

    const success = await emitReconciliationAlert(alert, config);
    if (success) {
      emitted++;
    }
  }

  logger.info('[Alert Emitter] Discrepancy alerts complete', {
    total: discrepancies.length,
    emitted,
  });

  return emitted;
}

/**
 * Emit reconciliation completion alert
 *
 * @param reportId - Report ID
 * @param userId - User ID (system)
 * @param config - Emitter configuration
 * @returns true if alert was emitted
 */
export async function emitCompletionAlert(
  reportId: string,
  userId: string = 'system',
  config: AlertEmitterConfig = DEFAULT_ALERT_EMITTER_CONFIG
): Promise<boolean> {
  const alert: ReconciliationAlert = {
    type: 'report_generated',
    severity: 'info',
    licenseNonce: 'system',
    userId,
    details: {
      description: 'Reconciliation report generated successfully',
    },
    timestamp: Date.now(),
    reportId,
  };

  return emitReconciliationAlert(alert, config);
}
