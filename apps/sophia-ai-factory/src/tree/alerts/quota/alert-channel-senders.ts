/**
 * Alert channel sender helpers (email, SMS, webhook)
 *
 * Low-level delivery functions used by alert-delivery-service.
 * Must NOT import from alert-delivery-service.ts (prevents circular imports).
 */

import { createServerClient } from '@/seed/db/client';
import { logger } from '@/seed/utils/logger-utility';
import { toError } from '@/seed/utils/to-error';
import type { AlertTemplate, QuotaAlertContext } from './alert-rule-evaluator';

export { sendWebhookAlertChannel } from './alert-webhook-channel-sender';

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
