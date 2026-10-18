/**
 * HTTP dispatch and payload builders for reconciliation alerts.
 *
 * @module worker/reconciliation-alert-sender
 */

import type { ReconciliationAlert, Discrepancy } from '@/seed/types/billing-contracts';
import { logger } from '@/seed/utils/logger-utility';
import { toError } from '@/seed/utils/to-error';
import type { AlertEmitterConfig } from './reconciliation-alert-config';

export async function postReconciliationAlert(
  alert: ReconciliationAlert,
  config: AlertEmitterConfig
): Promise<boolean> {
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

export function buildDiscrepancyAlert(discrepancy: Discrepancy): ReconciliationAlert {
  return {
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
}
