/**
 * Reconciliation Alert Emitter
 *
 * Emits alerts for billing reconciliation discrepancies
 * to the /api/alerts endpoint.
 *
 * @module worker/reconciliation-alert-emitter
 */

import type { ReconciliationAlert, Discrepancy } from '@/seed/types/billing-contracts';
import { logger } from '@/seed/utils/logger-utility';
import { toError } from '@/seed/utils/to-error';
import {
  DEFAULT_ALERT_EMITTER_CONFIG,
  isAlertRateLimited,
  type AlertEmitterConfig,
} from './reconciliation-alert-config';

export { DEFAULT_ALERT_EMITTER_CONFIG, type AlertEmitterConfig };

/**
 * Emit reconciliation alert to /api/alerts endpoint
 */
export async function emitReconciliationAlert(
  alert: ReconciliationAlert,
  config: AlertEmitterConfig = DEFAULT_ALERT_EMITTER_CONFIG
): Promise<boolean> {
  const rateLimitKey = `${alert.userId}:${alert.type}:${alert.severity}`;

  if (isAlertRateLimited(rateLimitKey, config)) {
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
