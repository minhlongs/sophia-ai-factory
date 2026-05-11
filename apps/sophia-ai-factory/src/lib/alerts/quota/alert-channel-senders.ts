/**
 * Alert channel sender helpers (email, SMS, webhook)
 *
 * Low-level delivery functions used by alert-delivery-service.
 * Must NOT import from alert-delivery-service.ts (prevents circular imports).
 */

import { createServerClient } from '@/seed/db/client';
import { logger } from '@/seed/utils/logger-utility';
import { toError } from '@/seed/utils/to-error';
import { sendWebhookAlert, createQuotaThresholdPayload } from '@/lib/alerts/webhook-notification-service';
import type { AlertTemplate, QuotaAlertContext } from './alert-rule-evaluator';

/**
 * Send email alert via configured email provider
 */
export async function sendEmailAlert(
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

    await db.from('quota_alerts').insert({
      user_id: userId,
      license_nonce: context.licenseNonce,
      threshold: context.threshold,
      channel: 'email',
      recipient: profile.email,
      template_subject: template.subject,
      sent: true,
      sent_at: new Date().toISOString(),
    });

    return true;
  } catch (error) {
    logger.error('[Quota Alert] Failed to send email', toError(error));
    return false;
  }
}

/**
 * Send SMS alert via Twilio
 */
export async function sendSmsAlert(
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
    });

    return true;
  } catch (error) {
    logger.error('[Quota Alert] Failed to send SMS', toError(error));
    return false;
  }
}

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
    });

    logger.info('[Quota Alert] Webhook alert sent', { userId, url: webhookUrl, success: result.success });
    return result.success;
  } catch (error) {
    logger.error('[Quota Alert] Failed to send webhook', toError(error));
    return false;
  }
}
