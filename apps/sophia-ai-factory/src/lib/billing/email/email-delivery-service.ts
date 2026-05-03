/**
 * Email Delivery Service
 *
 * Handles Resend API calls for billing email delivery.
 * Manages Resend client singleton and send operations.
 *
 * @module billing/email/email-delivery-service
 */

import { Resend } from 'resend';
import { logger } from '@/seed/utils/logger-utility';
import { toError, getErrorMessage } from '@/seed/utils/to-error';
import { buildHtmlTemplate, buildTextTemplate, getEmailSubject } from './email-template-builder';
import { logEmailDelivery } from './email-tracking-service';
import type { EmailTemplateType, BillingEmailContext } from './types';

/** Resend client singleton */
let resendClient: Resend | null = null;

/**
 * Get or create Resend client instance
 */
function getResendClient(): Resend | null {
  if (!resendClient) {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      logger.warn('[Resend] API key not configured, emails will be logged only');
      return null;
    }
    resendClient = new Resend(apiKey);
  }
  return resendClient;
}

/**
 * Send billing email via Resend
 *
 * @param type - Email template type
 * @param context - Recipient and billing context
 * @returns Send result with emailId on success
 */
export async function sendBillingEmail(
  type: EmailTemplateType,
  context: BillingEmailContext
): Promise<{ success: boolean; emailId?: string; error?: string }> {
  const resend = getResendClient();
  const language = context.language || 'en';

  const subject = getEmailSubject(type, context, language);
  const text = buildTextTemplate(type, context, language);
  const html = buildHtmlTemplate(type, context, language);

  try {
    // If Resend not configured, log only
    if (!resend) {
      logger.info('[Resend] Email logged (not configured)', {
        type,
        to: context.userEmail,
        subject,
      });

      await logEmailDelivery(context, type, subject, true);
      return { success: true };
    }

    // Send via Resend
    const { data, error } = await resend.emails.send({
      from: 'Sophia AI <billing@sophia.agencyos.network>',
      to: context.userEmail,
      subject,
      text,
      html,
      tags: [
        { name: 'type', value: type },
        { name: 'license_nonce', value: context.licenseNonce.slice(0, 8) },
        { name: 'tier', value: context.tier },
      ],
    });

    if (error) {
      throw new Error(`Resend API error: ${error.message}`);
    }

    logger.info('[Resend] Email sent', {
      type,
      to: context.userEmail,
      emailId: data?.id,
    });

    await logEmailDelivery(context, type, subject, true, data?.id);

    return { success: true, emailId: data?.id };
  } catch (error) {
    logger.error('[Resend] Failed to send email', toError(error), {
      type,
      to: context.userEmail,
    });

    await logEmailDelivery(context, type, subject, false);

    return {
      success: false,
      error: getErrorMessage(error),
    };
  }
}

/**
 * Batch send dunning emails concurrently
 *
 * @param emails - Array of type + context pairs
 * @returns Array of delivery results
 */
export async function sendBatchDunningEmails(
  emails: Array<{ type: EmailTemplateType; context: BillingEmailContext }>
): Promise<Array<{ success: boolean; emailId?: string; error?: string }>> {
  const results = await Promise.all(
    emails.map(({ type, context }) => sendBillingEmail(type, context))
  );

  logger.info('[Resend] Batch emails sent', {
    total: emails.length,
    successful: results.filter(r => r.success).length,
    failed: results.filter(r => !r.success).length,
  });

  return results;
}

// -------------------------------------------------------------------------
// High-level convenience wrappers (used by dunning workflow)
// -------------------------------------------------------------------------

export async function sendPaymentFailedEmail(context: BillingEmailContext): Promise<void> {
  await sendBillingEmail('payment_failed', context);
}

export async function sendGracePeriodWarningEmail(
  context: BillingEmailContext,
  gracePeriodDays: number,
  suspensionDate: Date
): Promise<void> {
  await sendBillingEmail('grace_period_warning', {
    ...context,
    gracePeriodDays,
    suspensionDate,
  });
}

export async function sendSuspensionNoticeEmail(context: BillingEmailContext): Promise<void> {
  await sendBillingEmail('suspension_notice', context);
}

export async function sendPaymentSuccessEmail(context: BillingEmailContext): Promise<void> {
  await sendBillingEmail('payment_succeeded', context);
}

export async function sendOverageDetectedEmail(context: BillingEmailContext): Promise<void> {
  await sendBillingEmail('overage_detected', context);
}
