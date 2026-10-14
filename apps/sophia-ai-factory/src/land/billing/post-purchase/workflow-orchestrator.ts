/**
 * Post-Purchase Workflow Orchestrator
 *
 * Layer: land/billing/post-purchase
 */

import type { Tier } from '@/seed/types'
import type { D1Database } from '@cloudflare/workers-types'
import type { NowPaymentsIpnPayload } from '../nowpayments-ipn-handlers'
import { getDb } from '../nowpayments-ipn-db'
import {
  invalidateLicenseCache,
  safelySendReceiptEmail,
  safelyEnqueueWelcomeEmail,
  safelyCreditReferralReward,
} from '../nowpayments-email-referral'
import {
  safelyRecordAudit,
  safelyFinalizePromoRedemption,
  safelyTriggerOnboardingVideo,
  safelyTriggerAutoHandover,
} from './fulfillment-actions'
import {
  safelyNotifyFounderPayment,
  safelyTagSubaccount,
  safelyAttributeAffiliateCommission,
} from './notification-attribution'

/**
 * Run all post-activation workflows.
 */
export async function runPostActivationWorkflow(
  userId: string,
  tier: Tier,
  billingPeriod: 'monthly' | 'yearly' | 'lifetime',
  periodEnd: string,
  orgId: string | undefined,
  ipn: NowPaymentsIpnPayload,
  d1: D1Database,
  db: ReturnType<typeof getDb>,
): Promise<void> {
  await safelyRecordAudit(d1, orgId, userId, tier, periodEnd, ipn)
  await safelyFinalizePromoRedemption(userId, ipn, db, d1)
  await safelyTriggerOnboardingVideo(tier, userId, db, ipn)
  await safelyTriggerAutoHandover(userId, tier, ipn, db, d1)
  await invalidateLicenseCache(userId, d1)
  await safelySendReceiptEmail(userId, tier, billingPeriod, ipn, db)
  await safelyEnqueueWelcomeEmail(userId, tier, ipn, db, d1)
  await safelyCreditReferralReward(userId, tier, ipn, db, d1)
  await safelyAttributeAffiliateCommission(userId, ipn, d1)
  await safelyNotifyFounderPayment(userId, tier, ipn, db, d1)
  await safelyTagSubaccount(ipn, d1)
}
