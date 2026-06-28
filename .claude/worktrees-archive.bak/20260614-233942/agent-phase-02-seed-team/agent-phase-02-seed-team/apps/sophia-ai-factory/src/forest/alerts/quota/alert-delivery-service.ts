/**
 * Alert Delivery Service
 *
 * Main dispatch: checks rate limit, resolves channels, delegates to senders.
 *
 * @module alerts/quota/alert-delivery-service
 */

import { createServerClient } from '@/seed/db/client';
import { logger } from '@/seed/utils/logger-utility';
import { toError, getErrorMessage } from '@/seed/utils/to-error';
import {
  getAlertTemplate,
  isRateLimited,
  TIER_ALERT_CONFIGS,
  type AlertChannel,
  type AlertDeliveryResult,
  type QuotaAlertContext,
} from './alert-rule-evaluator';
import {
  sendEmailAlert,
  sendSmsAlert,
  sendWebhookAlertChannel,
} from './alert-channel-senders';

/**
 * Trigger quota alert for a user
 *
 * Checks rate limit, fetches user preferences, sends via enabled channels.
 */
export async function triggerQuotaAlert(context: QuotaAlertContext): Promise<AlertDeliveryResult> {
  const { userId, tier, threshold } = context;

  try {
    const db = createServerClient();

    // Fetch alert rules
    const { data: alertRules } = await db
      .from('alert_rules')
      .select('channels, webhook_url, webhook_secret')
      .eq('user_id', userId)
      .eq('license_nonce', context.licenseNonce)
      .eq('threshold_percent', threshold)
      .eq('enabled', true)
      .single();

    // Fetch notification preferences
    const { data: preferences } = await db
      .from('notification_preferences')
      .select('email_enabled, sms_enabled, webhook_enabled, default_webhook_url, default_webhook_secret')
      .eq('user_id', userId)
      .single();

    // Determine channels (rule > preferences > tier default)
    const enabledChannels: AlertChannel[] = (alertRules?.channels as AlertChannel[] | undefined) || [
      ...(preferences?.email_enabled !== false ? ['email' as const] : []),
      ...(preferences?.sms_enabled === true ? ['sms' as const] : []),
      ...(preferences?.webhook_enabled === true ? ['webhook' as const] : []),
    ];

    // Check rate limiting
    const rateLimited = await isRateLimited(userId, threshold, {
      ...TIER_ALERT_CONFIGS[tier],
      enabledChannels,
    });

    if (rateLimited) {
      logger.info('[Quota Alert] Rate-limited', { userId, threshold });
      return { success: false, rateLimited: true };
    }

    const emailTemplate = getAlertTemplate(context, 'email');
    const smsTemplate = getAlertTemplate(context, 'sms');

    const emailSent = enabledChannels.includes('email')
      ? await sendEmailAlert(userId, emailTemplate, context)
      : false;

    const smsSent = enabledChannels.includes('sms')
      ? await sendSmsAlert(userId, smsTemplate, context)
      : false;

    let webhookSent = false;
    if (enabledChannels.includes('webhook')) {
      const webhookUrl = (alertRules?.webhook_url || preferences?.default_webhook_url) as string | undefined;
      const webhookSecret = (alertRules?.webhook_secret || preferences?.default_webhook_secret) as string | undefined;
      if (webhookUrl) {
        webhookSent = await sendWebhookAlertChannel(userId, context, webhookUrl, webhookSecret);
      }
    }

    const success = emailSent || smsSent || webhookSent;
    logger.info('[Quota Alert] Alert triggered', { userId, threshold, emailSent, smsSent, webhookSent });

    return { success, emailSent, smsSent, webhookSent };
  } catch (error) {
    logger.error('[Quota Alert] Failed to trigger alert', toError(error));
    return { success: false, error: getErrorMessage(error) };
  }
}
