/**
 * Shared types for billing email modules
 *
 * @module billing/email/types
 */

/**
 * Email template types
 */
export type EmailTemplateType =
  | 'payment_failed'
  | 'grace_period_warning'
  | 'suspension_notice'
  | 'payment_succeeded'
  | 'overage_detected';

/**
 * Email context for billing events
 */
export interface BillingEmailContext {
  userId: string;
  userEmail: string;
  licenseNonce: string;
  tier: string;
  amount?: number;
  currency?: string;
  failureReason?: string;
  gracePeriodDays?: number;
  suspensionDate?: Date;
  nextRetryDate?: Date;
  paymentProvider?: 'stripe';
  language?: 'en' | 'vi';
  subject?: string;
}
