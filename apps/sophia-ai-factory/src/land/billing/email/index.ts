/**
 * Billing Email Module
 *
 * Barrel re-export for all billing email functionality.
 * Maintains backward compatibility with original resend-email-service.ts imports.
 *
 * @module billing/email
 */

// Types
export type { EmailTemplateType, BillingEmailContext } from './types';

// Template building
export {
  buildHtmlTemplate,
  buildTextTemplate,
  getEmailSubject,
} from './email-template-builder';

// Delivery
export {
  sendBillingEmail,
  sendBatchDunningEmails,
  sendPaymentFailedEmail,
  sendGracePeriodWarningEmail,
  sendSuspensionNoticeEmail,
  sendPaymentSuccessEmail,
  sendOverageDetectedEmail,
  // Dunning time-boxed sequence
  sendDunningDay1Email,
  sendDunningDay3Email,
  sendDunningDay5Email,
} from './email-delivery-service';

// Tracking
export { logEmailDelivery } from './email-tracking-service';
