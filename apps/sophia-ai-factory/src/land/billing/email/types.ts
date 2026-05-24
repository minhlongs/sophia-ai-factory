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
  | 'overage_detected'
  // Time-boxed dunning sequence (wired directly from dunning-actions.ts)
  | 'dunning_day1'   // 24h after first decline — friendly reminder
  | 'dunning_day3'   // 72h after first decline — urgent action required
  | 'dunning_day5';  // 120h after first decline — final warning

/**
 * Email context for billing events
 */
export interface BillingEmailContext {
  userId: string;
  userEmail: string;
  /** Display name for the recipient — used in email greeting */
  ownerFullName?: string;
  licenseNonce: string;
  tier: string;
  amount?: number;
  currency?: string;
  failureReason?: string;
  gracePeriodDays?: number;
  /** Days remaining until suspension — used in dunning_day3 */
  gracePeriodDaysLeft?: number;
  suspensionDate?: Date;
  nextRetryDate?: Date;
  paymentProvider?: 'stripe';
  language?: 'en' | 'vi';
  subject?: string;
}
