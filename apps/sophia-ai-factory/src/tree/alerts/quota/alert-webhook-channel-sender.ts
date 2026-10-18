/**
 * Webhook alert channel sender helper
 *
 * Low-level webhook delivery function extracted from alert-channel-senders.ts.
 * Must NOT import from alert-delivery-service.ts (prevents circular imports).
 */

import { createServerClient } from '@/seed/db/client';
import { logger } from '@/seed/utils/logger-utility';
import { toError } from '@/seed/utils/to-error';
import { sendWebhookAlert, createQuotaThresholdPayload } from '../webhook-notification-service';
import type { QuotaAlertContext } from './alert-rule-evaluator';

/**
 * Send webhook alert to custom endpoint
 */
export async function sendWebhookAlertChannel(
  userId: string,
  context: QuotaAlertContext,
  webhookUrl: string,
  webhookSecret?: string
): Promise<boolean> {
  try {
    const payload = createQuotaThresholdPayload({
      userId,
      licenseNonce: context.licenseNonce,
      threshold: context.threshold,
      percentage: context.percentage,
      limit: context.limit,
      currentUsage: context.currentUsage,
      tier: context.tier,
      exceededType: context.exceededType,
      metadata: {
        stripeCustomerId: context.stripeCustomerId,
        ipAddress: context.ipAddress,
      },
    });

    const result = await sendWebhookAlert(webhookUrl, payload, webhookSecret);

    const db = createServerClient();
    await db.from('quota_alerts').insert({
      user_id: userId,
      license_nonce: context.licenseNonce,
      threshold: context.threshold,
      channel: 'webhook',
      recipient: webhookUrl,
      sent: result.success,
      sent_at: result.success ? new Date().toISOString() : null,
      delivery_error: result.error || null,
      ip_address: context.ipAddress,
    });

    logger.info('[Quota Alert] Webhook alert sent', { userId, url: webhookUrl, success: result.success });
    return result.success;
  } catch (error) {
    logger.error('[Quota Alert] Failed to send webhook', toError(error));
    return false;
  }
}
