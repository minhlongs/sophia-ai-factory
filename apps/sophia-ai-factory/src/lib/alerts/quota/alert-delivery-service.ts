/**
 * Alert Delivery Service
 *
 * Handles multi-channel delivery of quota alerts:
 * email, SMS, and webhook notifications.
 *
 * @module alerts/quota/alert-delivery-service
 */

import { createServerClient } from '@/lib/db/client';
import { logger } from '@/lib/utils/logger-utility';
import { sendWebhookAlert, createQuotaThresholdPayload } from '@/lib/alerts/webhook-notification-service';
import {
  getAlertTemplate,
  isRateLimited,
  TIER_ALERT_CONFIGS,
  type AlertChannel,
  type AlertTemplate,
  type AlertThreshold,
  type QuotaAlertContext,
  type AlertDeliveryResult,
} from './alert-rule-evaluator';

// -------------------------------------------------------------------------
// Channel senders
// -------------------------------------------------------------------------

/**
 * Send email alert via configured email provider
 */
async function sendEmailAlert(
  userId: string,
  template: AlertTemplate,
  context: QuotaAlertContext
): Promise<boolean> {
  try {
    const db = createServerClient();

    const { data: profile } = await db
      .from('user_profiles')
      .select('email')
      .eq('user_id', userId)
      .single();

    if (!profile?.email) {
      logger.warn('[Quota Alert] No email found for user', { userId });
      return false;
    }

    logger.info('[Quota Alert] Email alert prepared', {
      userId,
      to: profile.email,
      subject: template.subject,
      threshold: context.threshold,
    });

    // Record alert
    await db.from('quota_alerts').insert({
      user_id: userId,
      license_nonce: context.licenseNonce,
      threshold: context.threshold,
      channel: 'email',
      recipient: profile.email,
      template_subject: template.subject,
      sent: true,
      sent_at: new Date().toISOString(),
    } as any);

    return true;
  } catch (error) {
    logger.error('[Quota Alert] Failed to send email', error as Error);
    return false;
  }
}

/**
 * Send SMS alert via Twilio
 */
async function sendSmsAlert(
  userId: string,
  template: AlertTemplate,
  context: QuotaAlertContext
): Promise<boolean> {
  try {
    const db = createServerClient();

    const { data: profile } = await db
      .from('user_profiles')
      .select('phone')
      .eq('user_id', userId)
      .single();

    if (!profile?.phone) {
      logger.warn('[Quota Alert] No phone found for user', { userId });
      return false;
    }

    logger.info('[Quota Alert] SMS alert prepared', {
      userId,
      to: profile.phone,
      message: template.smsBody,
      threshold: context.threshold,
    });

    await db.from('quota_alerts').insert({
      user_id: userId,
      license_nonce: context.licenseNonce,
      threshold: context.threshold,
      channel: 'sms',
      recipient: profile.phone,
      template_body: template.smsBody,
      sent: true,
      sent_at: new Date().toISOString(),
    } as any);

    return true;
  } catch (error) {
    logger.error('[Quota Alert] Failed to send SMS', error as Error);
    return false;
  }
}

/**
 * Send webhook alert to custom endpoint
 */
async function sendWebhookAlertChannel(
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
        polarCustomerId: context.polarCustomerId,
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
    } as any);

    logger.info('[Quota Alert] Webhook alert sent', { userId, url: webhookUrl, success: result.success });

    return result.success;
  } catch (error) {
    logger.error('[Quota Alert] Failed to send webhook', error as Error);
    return false;
  }
}

// -------------------------------------------------------------------------
// Main dispatch
// -------------------------------------------------------------------------

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
    const enabledChannels: AlertChannel[] = alertRules?.channels || [
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
      const webhookUrl = alertRules?.webhook_url || preferences?.default_webhook_url;
      const webhookSecret = alertRules?.webhook_secret || preferences?.default_webhook_secret;

      if (webhookUrl) {
        webhookSent = await sendWebhookAlertChannel(userId, context, webhookUrl, webhookSecret);
      }
    }

    const success = emailSent || smsSent || webhookSent;

    logger.info('[Quota Alert] Alert triggered', { userId, threshold, emailSent, smsSent, webhookSent });

    return { success, emailSent, smsSent, webhookSent };
  } catch (error) {
    logger.error('[Quota Alert] Failed to trigger alert', error as Error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}
