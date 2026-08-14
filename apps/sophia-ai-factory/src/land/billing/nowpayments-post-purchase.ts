/**
 * Post-purchase side effects for NOWPayments subscription activation.
 * All operations are non-fatal — errors are logged and swallowed.
 * @module billing/nowpayments-post-purchase
 */

import { logger } from '@/seed/utils/logger-utility'
import { safeCatch } from '@/seed/utils/safe-catch'
import { recordAudit } from '@/seed/db/audit/audit-log'
import type { Tier } from '@/seed/types'
import type { D1Database } from '@cloudflare/workers-types'
import type { NowPaymentsIpnPayload } from './nowpayments-ipn-handlers'
import { getDb } from './nowpayments-ipn-db'
import { createOnboardingVideo, ONBOARDING_TIERS } from '@/land/video/templates/onboarding-video'
import { triggerAutoHandover } from '@/tree/handover/auto-handover'
import { markOrderCompleted, getOrderById } from '@/land/orders/pending-order-repo'
import { findReservedRedemption, finalizeRedemption, incrementUsedCount } from '@/land/promo/promo-repo'
import {
  invalidateLicenseCache,
  safelySendReceiptEmail,
  safelyEnqueueWelcomeEmail,
  safelyCreditReferralReward,
} from './nowpayments-email-referral'

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
  db: ReturnType<typeof getDb>
): Promise<void> {
  await safelyRecordAudit(d1, orgId, userId, tier, periodEnd, ipn)
  await safelyFinalizePromoRedemption(userId, ipn, db, d1)
  await safelyTriggerOnboardingVideo(tier, userId, db, ipn)
  await safelyTriggerAutoHandover(userId, tier, ipn, db, d1)
  await invalidateLicenseCache(userId, d1)
  await safelySendReceiptEmail(userId, tier, billingPeriod, ipn, db)
  await safelyEnqueueWelcomeEmail(userId, tier, ipn, db, d1)
  await safelyCreditReferralReward(userId, tier, ipn, db, d1)
}

async function safelyRecordAudit(
  d1: D1Database,
  orgId: string | undefined,
  userId: string,
  tier: Tier,
  periodEnd: string,
  ipn: NowPaymentsIpnPayload
): Promise<void> {
  try {
    await recordAudit(d1, {
      tableName: 'subscriptions',
      rowId: orgId ?? userId,
      action: 'update',
      actorId: userId,
      after: { tier, plan: tier.toLowerCase(), status: 'active', periodEnd, paymentId: ipn.payment_id },
    })
  } catch (e) { safeCatch('Audit record')(e) }
}

async function safelyFinalizePromoRedemption(
  userId: string,
  ipn: NowPaymentsIpnPayload,
  _db: ReturnType<typeof getDb>,
  _d1: D1Database
): Promise<void> {
  if (!ipn.order_id) return
  try {
    const pendingOrder = await getOrderById(ipn.order_id)
    if (pendingOrder?.promo_code) {
      const reserved = await findReservedRedemption(userId, pendingOrder.promo_code)
      if (reserved) {
        await incrementUsedCount(reserved.promo_code_id)
        await finalizeRedemption(reserved.id, ipn.payment_id)
      }
    }
    await markOrderCompleted(ipn.order_id, ipn.payment_id)
    logger.info('[NOWPayments] Promo finalized + order completed', { orderId: ipn.order_id })
  } catch (err) {
    logger.warn('[NOWPayments] Promo finalization failed (non-fatal)', { orderId: ipn.order_id, error: String(err) })
  }
}

async function safelyTriggerOnboardingVideo(
  tier: Tier,
  userId: string,
  db: ReturnType<typeof getDb>,
  ipn: NowPaymentsIpnPayload
): Promise<void> {
  if (!ONBOARDING_TIERS.has(tier)) return
  try {
    const { data: userData } = await db.from('user').select('email').eq('id', userId).single()
    const userEmail = (userData as { email?: string } | null)?.email ?? ''
    if (userEmail) {
      await createOnboardingVideo({ userId, orgId: undefined, tier, paymentId: ipn.payment_id, userEmail })
    }
  } catch (err) {
    logger.warn('[NOWPayments] Onboarding video trigger failed (non-fatal)', { userId, error: String(err) })
  }
}

async function safelyTriggerAutoHandover(
  userId: string,
  tier: Tier,
  ipn: NowPaymentsIpnPayload,
  db: ReturnType<typeof getDb>,
  d1: D1Database
): Promise<void> {
  try {
    const { data: userRow } = await db.from('user').select('email,name').eq('id', userId).single()
    const userEmail = (userRow as { email?: string; name?: string } | null)?.email ?? ''
    const userName = (userRow as { email?: string; name?: string } | null)?.name ?? undefined
    if (userEmail) {
      const purchaseCount = await d1
        .prepare(`SELECT COUNT(*) as cnt FROM user_purchases WHERE user_id = ?1 AND status = 'paid'`)
        .bind(userId)
        .first<{ cnt: number }>()
      const isFirstPurchase = (purchaseCount?.cnt ?? 0) <= 1
      await triggerAutoHandover({
        paymentId: ipn.payment_id, userId, email: userEmail,
        fullName: userName, tier, isFirstPurchase,
      })
    }
  } catch (err) {
    logger.warn('[NOWPayments] Auto-handover failed (non-fatal)', { userId, error: String(err) })
  }
}
