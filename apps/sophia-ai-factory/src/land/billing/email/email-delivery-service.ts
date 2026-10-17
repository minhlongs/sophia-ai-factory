/**
 * Email Delivery Service
 *
 * Handles Resend API calls for billing email delivery.
 * Manages Resend client singleton and send operations.
 *
 * @module billing/email/email-delivery-service
 */

import { logger } from '@/seed/utils/logger-utility';
import { sendBillingEmail } from './email-resend-client';
import type { EmailTemplateType, BillingEmailContext } from './types';

export { sendBillingEmail };

/**
 * Batch send dunning emails concurrently
 *
 * @param emails - Array of type + context pairs
 * @returns Array of delivery results
 */
export async function sendBatchDunningEmails(
  emails: Array<{ type: EmailTemplateType; context: BillingEmailContext }>,
): Promise<Array<{ success: boolean; emailId?: string; error?: string }>> {
  const results = await Promise.all(
    emails.map(({ type, context }) => sendBillingEmail(type, context)),
  );

  logger.info('[Resend] Batch emails sent', {
    total: emails.length,
    successful: results.filter((r) => r.success).length,
    failed: results.filter((r) => !r.success).length,
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
  suspensionDate: Date,
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

// -------------------------------------------------------------------------
// Dunning time-boxed sequence wrappers
// -------------------------------------------------------------------------

/** Day-1 (24h after first decline): friendly payment-failed reminder */
export async function sendDunningDay1Email(context: BillingEmailContext): Promise<void> {
  await sendBillingEmail('dunning_day1', context);
}

/** Day-3 (72h after first decline): urgent action-required with countdown */
export async function sendDunningDay3Email(context: BillingEmailContext): Promise<void> {
  await sendBillingEmail('dunning_day3', context);
}

/** Day-5 (120h after first decline): final warning before suspension */
export async function sendDunningDay5Email(context: BillingEmailContext): Promise<void> {
  await sendBillingEmail('dunning_day5', context);
}
