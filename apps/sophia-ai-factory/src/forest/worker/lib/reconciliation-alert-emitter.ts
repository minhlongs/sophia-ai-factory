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
import {
  DEFAULT_ALERT_EMITTER_CONFIG,
  isAlertRateLimited,
  type AlertEmitterConfig,
} from './reconciliation-alert-config';
import {
  postReconciliationAlert,
  buildDiscrepancyAlert,
} from './reconciliation-alert-sender';

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

  return postReconciliationAlert(alert, config);
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
    const alert = buildDiscrepancyAlert(discrepancy);
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
