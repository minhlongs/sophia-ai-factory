/**
 * Resend Email Service — backward-compatibility re-export
 *
 * All functionality has been moved to ./email/* modules.
 * This file re-exports everything so existing imports continue to work.
 *
 * @module billing/resend-email-service
 * @deprecated Import from '@/lib/billing/email' directly
 */

export type { EmailTemplateType, BillingEmailContext } from './email/types';

export {
  sendBillingEmail,
  sendBatchDunningEmails,
  sendPaymentFailedEmail,
  sendGracePeriodWarningEmail,
  sendSuspensionNoticeEmail,
  sendPaymentSuccessEmail,
  sendOverageDetectedEmail,
  logEmailDelivery,
} from './email';
