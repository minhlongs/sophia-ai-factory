/**
 * Alert Schedule Manager
 *
 * Orchestrates multi-threshold evaluation and provides
 * history query functionality for quota alerts.
 *
 * @module alerts/quota/alert-schedule-manager
 */

import { createServerClient } from '@/lib/db/client';
import { logger } from '@/lib/utils/logger-utility';
import { toError } from '@/lib/utils/to-error';
import { triggerQuotaAlert } from './alert-delivery-service';
import { determineThresholdsToTrigger, type AlertDeliveryResult, type AlertThreshold, type QuotaAlertContext } from './alert-rule-evaluator';

/**
 * Check usage and trigger all relevant threshold alerts
 *
 * @param context - Alert context without threshold (threshold is derived from percentage)
 * @param percentage - Current usage percentage
 */
export async function checkAndTriggerAlerts(
  context: Omit<QuotaAlertContext, 'threshold'>,
  percentage: number
): Promise<AlertDeliveryResult[]> {
  const thresholdsToTrigger = determineThresholdsToTrigger(percentage);
  const results: AlertDeliveryResult[] = [];

  for (const threshold of thresholdsToTrigger) {
    const result = await triggerQuotaAlert({ ...context, threshold: threshold as AlertThreshold });
    results.push(result);
  }

  return results;
}

/**
 * Get alert history for a user + license
 */
export async function getUserAlertHistory(
  userId: string,
  licenseNonce: string,
  limit: number = 10
): Promise<Array<{ threshold: number; channel: string; sentAt: string; recipient: string }>> {
  try {
    const db = createServerClient();

    const { data: alerts } = await db
      .from('quota_alerts')
      .select('threshold, channel, sent_at, recipient')
      .eq('user_id', userId)
      .eq('license_nonce', licenseNonce)
      .eq('sent', true)
      .order('sent_at', { ascending: false })
      .limit(limit);

    return (alerts || []).map(a => ({
      threshold: a.threshold,
      channel: a.channel,
      sentAt: a.sent_at,
      recipient: a.recipient,
    }));
  } catch (error) {
    logger.error('[Quota Alert] Failed to fetch alert history', toError(error));
    return [];
  }
}
