/**
 * NOWPayments IPN subscription lifecycle handlers (finished / refunded / failed)
 * handleFinished uses D1 batch() for atomic multi-table update.
 * @module billing/nowpayments-ipn-subscription
 */

import { getTierByInvoiceId, NOWPAYMENTS_TIERS } from '@/tree/clients/nowpayments-client'
import { logger } from '@/seed/utils/logger-utility'
import { safeCatch } from '@/seed/utils/safe-catch'
import { UNIFIED_TIERS } from '@/seed/config/tiers'
import { getD1 } from '@/seed/db/client'
import { recordAudit } from '@/seed/db/audit/audit-log'
import type { Tier } from '@/seed/types'
import type { D1Database } from '@cloudflare/workers-types'
import type { NowPaymentsIpnPayload } from './nowpayments-ipn-handlers'
import { getDb, parseUserIdFromOrderId } from './nowpayments-ipn-db'
import { createOnboardingVideo, ONBOARDING_TIERS } from '@/land/video/templates/onboarding-video'
import { triggerAutoHandover } from '@/tree/handover/auto-handover'
import { markOrderCompleted, markOrderFailed, getOrderById } from '@/land/orders/pending-order-repo'
import { findReservedRedemption, finalizeRedemption, incrementUsedCount } from '@/land/promo/promo-repo'
import { sendReceiptEmail } from './email/receipt-email-sender'
import { enqueueWelcomeEmail } from '@/tree/email/outbox'
import { UNDERPAYMENT_THRESHOLD } from './nowpayments-ipn-underpaid'
import { success, failure, type Result } from '@/seed/types/result'
import { IPNError } from './nowpayments-ipn-errors'

// Amount mismatch tolerance: 1% of expected price — prevents price-manipulation attacks
const AMOUNT_MISMATCH_THRESHOLD = 0.01

export async function handleFinished(ipn: NowPaymentsIpnPayload): Promise<Result<void, IPNError>> {
  try {
    const userId = await validateIpnAndGetUserId(ipn)
    if (!userId) return success(undefined)

    const ctx = await setupDatabaseAndContext(ipn, userId)
    if (!ctx) return success(undefined)

    const { d1, db, tier, billingPeriod, periodEnd, now, orgId } = ctx
    await activateSubscriptionForOrg(orgId, userId, tier, billingPeriod, periodEnd, now, ipn, d1, db)
    await runPostActivationWorkflow(userId, tier, billingPeriod, periodEnd, orgId, ipn, d1, db)

    logger.info('[NOWPayments] Payment finished — subscription activated', { userId, orgId, tier, isLifetime: billingPeriod === 'lifetime', periodEnd, paymentId: ipn.payment_id })
    return success(undefined)
  } catch (err) {
    return failure(new IPNError('HANDLE_FINISHED_FAILED', err))
  }
}

async function validateIpnAndGetUserId(ipn: NowPaymentsIpnPayload): Promise<string | null> {
  // Underpayment guard
  const actuallyPaid = ipn.actually_paid
  if (actuallyPaid !== undefined && actuallyPaid !== null) {
    const required = ipn.price_amount * UNDERPAYMENT_THRESHOLD
    if (actuallyPaid < required) {
      logger.warn('[NOWPayments] Subscription underpayment — not activating', {
        paymentId: ipn.payment_id,
        priceAmount: ipn.price_amount,
        actuallyPaid,
        required,
      })
      return null
    }
  }

  // Log overpaid transactions and record audit trail
  // M15 fix (2026-07-01): Overpayment is now audited durably, not just logged.
  if (actuallyPaid !== undefined && actuallyPaid > ipn.price_amount * 1.01) {
    logger.warn('[NOWPayments] Overpaid', {
      payment_id: ipn.payment_id,
      expected: ipn.price_amount,
      actual: actuallyPaid,
    })
    try {
      const db = getDb()
      await db.from('audit_log').insert({
        action_type: 'overpayment_detected',
        target_user_id: ipn.order_id ?? '',
        payload: JSON.stringify({
          payment_id: ipn.payment_id,
          expected: ipn.price_amount,
          actual: actuallyPaid,
          overage: actuallyPaid - ipn.price_amount,
        }),
        created_at: new Date().toISOString(),
      })
    } catch (auditErr) {
      logger.warn('[NOWPayments] Overpayment audit insert failed (non-fatal)', auditErr instanceof Error ? auditErr : undefined)
    }
  }

  const invoiceId = ipn.invoice_id
  if (!invoiceId) {
    logger.warn('[NOWPayments] finished: missing invoice_id', { paymentId: ipn.payment_id })
    return null
  }

  const tierConfig = getTierByInvoiceId(invoiceId)
  if (!tierConfig) {
    logger.warn('[NOWPayments] finished: unknown invoice_id', { invoiceId, paymentId: ipn.payment_id })
    return null
  }

  const userId = parseUserIdFromOrderId(ipn.order_id || '')
  if (!userId) {
    logger.warn('[NOWPayments] finished: cannot parse userId from order_id', { orderId: ipn.order_id })
    return null
  }

  return userId
}

async function setupDatabaseAndContext(
  ipn: NowPaymentsIpnPayload,
  userId: string
): Promise<{
  d1: D1Database
  db: ReturnType<typeof getDb>
  tier: Tier
  billingPeriod: 'monthly' | 'yearly' | 'lifetime'
  periodEnd: string
  now: string
  orgId: string | undefined
} | null> {
  const db = getDb()
  const _d1 = getD1()
  if (!_d1) throw new Error('D1 database binding not available')
  const d1 = _d1!

  const invoiceId = ipn.invoice_id!
  const tierConfig = getTierByInvoiceId(invoiceId)
  if (!tierConfig) return null

  const tier: Tier = tierConfig.tier

  const isLifetime = UNIFIED_TIERS[tier]?.billingType === 'lifetime'
  const billingPeriod = await resolveBillingPeriod(ipn, isLifetime)

  // SECURITY: Cross-check IPN amount against expected tier price
  // For yearly billing, compare against the yearly (discounted) price from UNIFIED_TIERS.
  // For monthly/lifetime, compare against the monthly price from NOWPAYMENTS_TIERS.
  const expectedPrice = billingPeriod === 'yearly'
    ? (UNIFIED_TIERS[tier]?.yearlyPrice ?? NOWPAYMENTS_TIERS[tier]?.yearlyPrice)
    : NOWPAYMENTS_TIERS[tier]?.price
  if (expectedPrice !== undefined && ipn.price_amount !== undefined) {
    const deviation = Math.abs(ipn.price_amount - expectedPrice)
    const tolerance = expectedPrice * AMOUNT_MISMATCH_THRESHOLD
    if (deviation > tolerance) {
      logger.warn('[NOWPayments] Amount mismatch — rejecting subscription activation', {
        paymentId: ipn.payment_id,
        tier,
        expectedPrice,
        receivedAmount: ipn.price_amount,
        deviation,
        tolerance,
      })
      return null
    }
  }

  const periodEnd = calculatePeriodEnd(billingPeriod)
  const now = new Date().toISOString()
  const orgId = await findOrgIdForUser(userId, db)

  return { d1, db, tier, billingPeriod, periodEnd, now, orgId }
}

function calculatePeriodEnd(billingPeriod: 'monthly' | 'yearly' | 'lifetime'): string {
  if (billingPeriod === 'lifetime') {
    return new Date('2099-12-31T23:59:59Z').toISOString()
  }
  const days = billingPeriod === 'yearly' ? 365 : 30
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString()
}

/**
 * Stacked period end for duplicate/same-tier re-payments.
 * If the subscription still has remaining time (current_period_end > now),
 * the new period is appended to the existing end instead of resetting the
 * clock — the customer keeps the time they already paid for.
 */
export function stackedPeriodEnd(
  existingPeriodEnd: string | null | undefined,
  billingPeriod: 'monthly' | 'yearly' | 'lifetime',
  now: string,
  defaultPeriodEnd: string
): string {
  if (billingPeriod === 'lifetime') return defaultPeriodEnd
  if (!existingPeriodEnd) return defaultPeriodEnd
  const existingMs = Date.parse(existingPeriodEnd)
  const nowMs = Date.parse(now)
  if (!Number.isFinite(existingMs) || existingMs <= nowMs) return defaultPeriodEnd
  const days = billingPeriod === 'yearly' ? 365 : 30
  return new Date(existingMs + days * 24 * 60 * 60 * 1000).toISOString()
}

async function resolveBillingPeriod(ipn: NowPaymentsIpnPayload, isLifetime: boolean): Promise<'monthly' | 'yearly' | 'lifetime'> {
  if (isLifetime) return 'lifetime'

  let billingPeriod: 'monthly' | 'yearly' | 'lifetime' = 'monthly'
  if (ipn.order_id) {
    try {
      const pendingOrder = await getOrderById(ipn.order_id)
      if (pendingOrder?.period === 'yearly') billingPeriod = 'yearly'
      else if (pendingOrder?.period === 'lifetime') billingPeriod = 'lifetime'
    } catch (e) { safeCatch('Billing period lookup')(e) }
  }
  return billingPeriod
}

async function findOrgIdForUser(userId: string, db: ReturnType<typeof getDb>): Promise<string | undefined> {
  const { data: membership } = await db.from('org_members').select('org_id').eq('user_id', userId).single()
  return membership?.org_id as string | undefined
}

async function activateSubscriptionForOrg(
  orgId: string | undefined,
  userId: string,
  tier: Tier,
  billingPeriod: 'monthly' | 'yearly' | 'lifetime',
  periodEnd: string,
  now: string,
  ipn: NowPaymentsIpnPayload,
  d1: D1Database,
  db: ReturnType<typeof getDb>
): Promise<void> {
  if (orgId) {
    await processExistingOrgSubscription(orgId, userId, tier, billingPeriod, periodEnd, now, ipn, d1, db)
  } else {
    await createNewOrgAndSubscription(userId, tier, billingPeriod, periodEnd, now, ipn, db)
  }
}

async function processExistingOrgSubscription(
  orgId: string,
  userId: string,
  tier: Tier,
  billingPeriod: 'monthly' | 'yearly' | 'lifetime',
  periodEnd: string,
  now: string,
  ipn: NowPaymentsIpnPayload,
  d1: D1Database,
  db: ReturnType<typeof getDb>
): Promise<void> {
  try {
    const { data: currentSub } = await db.from('subscriptions').select('plan, current_period_end').eq('org_id', orgId).single()
    const currentPlan = (currentSub as { plan?: string } | null)?.plan ?? ''
    const wouldDowngrade = wouldDowngradeTier(currentPlan, tier)

    const stmts = buildSubscriptionUpdateStatements(
      currentSub,
      wouldDowngrade,
      orgId,
      tier,
      periodEnd,
      now,
      ipn,
      d1,
      billingPeriod,
      (currentSub as { current_period_end?: string | null } | null)?.current_period_end
    )
    await d1.batch(stmts)
  } catch (batchErr) {
    // M14 fix (2026-07-01): Removed non-atomic fallback.
    // D1 batch failure → throw so the IPN handler returns error → NOWPayments retries.
    // Previous handleBatchFallback could commit partial state (sub active but org not updated).
    logger.error('[NOWPayments] D1 batch failed — throwing for retry', batchErr instanceof Error ? batchErr : undefined)
    throw batchErr
  }
}

async function runPostActivationWorkflow(
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

function wouldDowngradeTier(currentPlan: string, newTier: Tier): boolean {
  const TIER_RANK: Record<string, number> = { basic: 0, premium: 1, enterprise: 2, master: 3 }
  const currentRank = TIER_RANK[currentPlan.toLowerCase()] ?? -1
  const newRank = TIER_RANK[newTier.toLowerCase()] ?? -1
  return currentRank > newRank
}

function buildSubscriptionUpdateStatements(
  currentSub: unknown,
  wouldDowngrade: boolean,
  orgId: string,
  tier: Tier,
  periodEnd: string,
  now: string,
  ipn: NowPaymentsIpnPayload,
  d1: D1Database,
  billingPeriod: 'monthly' | 'yearly' | 'lifetime',
  existingPeriodEnd: string | null | undefined
): ReturnType<typeof d1.prepare>[] {
  const stmts = currentSub
    ? wouldDowngrade
      ? [
        d1.prepare('UPDATE subscriptions SET current_period_end=?, updated_at=? WHERE org_id=?')
          .bind(periodEnd, now, orgId),
        d1.prepare('UPDATE organizations SET updated_at=? WHERE id=?')
          .bind(now, orgId),
        d1.prepare('UPDATE tier_change_events SET resolved=?, resolved_at=?, note=? WHERE org_id=? AND resolved=?')
          .bind(1, now, 'Blocked: admin-set MASTER tier protected from webhook downgrade', orgId, 0),
      ]
      : [
        d1.prepare('UPDATE subscriptions SET plan=?, status=?, current_period_end=?, updated_at=? WHERE org_id=?')
          .bind(
            tier.toLowerCase(),
            'active',
            stackedPeriodEnd(existingPeriodEnd, billingPeriod, now, periodEnd),
            now,
            orgId
          ),
        d1.prepare('UPDATE organizations SET plan=?, updated_at=? WHERE id=?')
          .bind(tier.toLowerCase(), now, orgId),
      ]
    : [
      d1.prepare('INSERT INTO subscriptions (org_id, plan, status, current_period_start, current_period_end) VALUES (?,?,?,?,?)')
        .bind(orgId, tier.toLowerCase(), 'active', now, periodEnd),
      d1.prepare('UPDATE organizations SET plan=?, updated_at=? WHERE id=?')
        .bind(tier.toLowerCase(), now, orgId),
    ]

  if (ipn.order_id) {
    stmts.push(
      d1.prepare('UPDATE pending_orders SET status=?, payment_id=?, completed_at=? WHERE order_id=?')
        .bind('completed', ipn.payment_id, now, ipn.order_id)
    )
  }

  return stmts
}

async function handleBatchFallback(
  orgId: string,
  tier: Tier,
  billingPeriod: 'monthly' | 'yearly' | 'lifetime',
  periodEnd: string,
  now: string,
  ipn: NowPaymentsIpnPayload,
  db: ReturnType<typeof getDb>,
  d1: D1Database,
  batchErr: unknown
): Promise<void> {
  logger.warn('[NOWPayments] D1 batch failed, falling back to individual updates', batchErr instanceof Error ? batchErr : { message: String(batchErr) })
  try {
    const { data: existingSub2 } = await db.from('subscriptions').select('id, current_period_end').eq('org_id', orgId).single()
    if (existingSub2) {
      const stackedEnd = stackedPeriodEnd(
        (existingSub2 as { current_period_end?: string | null }).current_period_end,
        billingPeriod,
        now,
        periodEnd
      )
      await db.from('subscriptions').update({ plan: tier.toLowerCase(), status: 'active', current_period_end: stackedEnd, updated_at: now }).eq('org_id', orgId)
    } else {
      await db.from('subscriptions').insert({ org_id: orgId, plan: tier.toLowerCase(), status: 'active', current_period_start: now, current_period_end: periodEnd })
    }
    await db.from('organizations').update({ plan: tier.toLowerCase(), updated_at: now }).eq('id', orgId)
    if (ipn.order_id) {
      await markOrderCompleted(ipn.order_id, ipn.payment_id)
    }
  } catch (fallbackErr) {
    logger.error('[NOWPayments] Fallback sequential writes also failed', fallbackErr instanceof Error ? fallbackErr : { message: String(fallbackErr) })
    throw new Error('Subscription activation failed — both batch and fallback')
  }
}

async function createNewOrgAndSubscription(
  userId: string,
  tier: Tier,
  billingPeriod: 'monthly' | 'yearly' | 'lifetime',
  periodEnd: string,
  now: string,
  ipn: NowPaymentsIpnPayload,
  db: ReturnType<typeof getDb>
): Promise<void> {
  logger.warn('[NOWPayments] No org membership found for userId, creating new org', { userId })
  const { data: newOrg } = await db.from('organizations').insert({ name: `User ${userId}`, plan: tier.toLowerCase() }).select('id').single()
  if (newOrg?.id) {
    await db.from('org_members').insert({ org_id: newOrg.id, user_id: userId, role: 'owner' })
    await db.from('subscriptions').insert({ org_id: newOrg.id, plan: tier.toLowerCase(), status: 'active', current_period_start: now, current_period_end: periodEnd })
  }
  if (ipn.order_id) {
    await markOrderCompleted(ipn.order_id, ipn.payment_id)
  }
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
  db: ReturnType<typeof getDb>,
  d1: D1Database
): Promise<void> {
  if (!ipn.order_id) return

  try {
    const pendingOrder = await getOrderById(ipn.order_id)
    if (pendingOrder?.promo_code) {
      const reserved = await findReservedRedemption(userId, pendingOrder.promo_code)
      if (reserved) {
        await incrementUsedCount(reserved.promo_code_id)
        await finalizeRedemption(reserved.id, ipn.payment_id)
        logger.info('[NOWPayments] Promo redemption finalized', {
          promoCode: pendingOrder.promo_code,
          redemptionId: reserved.id,
          discountCents: reserved.discount_applied_cents,
          paymentId: ipn.payment_id,
        })
      }
    }
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
      await createOnboardingVideo({
        userId,
        orgId: undefined,
        tier,
        paymentId: ipn.payment_id,
        userEmail,
      })
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
        paymentId: ipn.payment_id,
        userId,
        email: userEmail,
        fullName: userName,
        tier,
        isFirstPurchase,
      })
    }
  } catch (err) {
    logger.warn('[NOWPayments] Auto-handover failed (non-fatal)', { userId, error: String(err) })
  }
}

async function invalidateLicenseCache(userId: string, d1: D1Database): Promise<void> {
  try {
    const lic = await d1
      .prepare('SELECT nonce FROM raas_licenses WHERE user_id = ?1 ORDER BY created_at DESC LIMIT 1')
      .bind(userId)
      .first<{ nonce: string }>()
    if (lic?.nonce) {
      const kv = globalThis.KV_KV as KVNamespace | undefined
      await kv?.delete(`license:${lic.nonce}`).catch((e) => { safeCatch('KV license cache delete')(e) })
    }
  } catch (e) { safeCatch('License cache invalidation')(e) }
}

async function safelySendReceiptEmail(
  userId: string,
  tier: Tier,
  billingPeriod: 'monthly' | 'yearly' | 'lifetime',
  ipn: NowPaymentsIpnPayload,
  db: ReturnType<typeof getDb>
): Promise<void> {
  try {
    const { data: userRow } = await db.from('user').select('email,name').eq('id', userId).single()
    const userEmail = (userRow as { email?: string; name?: string } | null)?.email ?? ''
    if (userEmail) {
      await sendReceiptEmail({
        email: userEmail,
        tier,
        period: billingPeriod,
        amountUsd: ipn.price_amount,
        paymentId: ipn.payment_id,
        paymentMethod: 'nowpayments',
        orderId: ipn.order_id ?? '',
        locale: 'en',
      })
    }
  } catch (err) {
    logger.warn('[NOWPayments] Receipt email failed (non-fatal)', { userId, err: String(err) })
  }
}

async function safelyEnqueueWelcomeEmail(
  userId: string,
  tier: Tier,
  ipn: NowPaymentsIpnPayload,
  db: ReturnType<typeof getDb>,
  d1: D1Database
): Promise<void> {
  try {
    const { data: userRow } = await db.from('user').select('email,name').eq('id', userId).single()
    const userEmail = (userRow as { email?: string; name?: string } | null)?.email ?? ''
    const userName = (userRow as { email?: string; name?: string } | null)?.name ?? ''
    if (userEmail) {
      await enqueueWelcomeEmail(d1, {
        paymentId: `post_purchase_welcome_${ipn.payment_id}`,
        toEmail: userEmail,
        template: 'post-purchase-welcome',
        payload: {
          ownerFullName: userName || userEmail.split('@')[0],
          tier,
          locale: 'vi',
        },
      })
    }
  } catch (err) {
    logger.warn('[NOWPayments] Post-purchase welcome email enqueue failed (non-fatal)', { userId, error: String(err) })
  }
}

async function safelyCreditReferralReward(
  userId: string,
  tier: Tier,
  ipn: NowPaymentsIpnPayload,
  db: ReturnType<typeof getDb>,
  d1: D1Database
): Promise<void> {
  try {
    const { data: userProfile } = await db.from('user_profiles').select('settings').eq('user_id', userId).single()
    const settings = userProfile?.settings
      ? (typeof userProfile.settings === 'string' ? JSON.parse(userProfile.settings as string) : userProfile.settings) as Record<string, unknown>
      : null
    const referrerId = settings?.referred_by as string | undefined

    if (referrerId && referrerId !== userId) {
      await creditReferralRewardAtomically(userId, tier, ipn, referrerId, d1)
    }
  } catch (err) {
    logger.warn('[NOWPayments] Referral reward credit failed (non-fatal)', { userId, error: String(err) })
  }
}

async function creditReferralRewardAtomically(
  userId: string,
  tier: Tier,
  ipn: NowPaymentsIpnPayload,
  referrerId: string,
  d1: D1Database
): Promise<void> {
  // Check if this payment was already rewarded (idempotency guard)
  const existingReward = await d1
    .prepare('SELECT id FROM referral_rewards WHERE payment_id = ?1 AND referrer_id = ?2')
    .bind(ipn.payment_id, referrerId)
    .first<{ id: string }>()

  if (existingReward) {
    logger.info('[NOWPayments] Referral reward already credited — skipping', { referrerId, paymentId: ipn.payment_id })
    return
  }

  const rewardCents = UNIFIED_TIERS[tier]
    ? Math.round(UNIFIED_TIERS[tier].price * 100 * 0.10)
    : 1990

  const rewardedAt = new Date().toISOString()

  // Atomic: insert reward record AND increment credit in user_profiles settings JSON
  await d1.batch([
    d1.prepare(
      `INSERT INTO referral_rewards (id, referrer_id, referred_user_id, payment_id, reward_cents, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`
    ).bind(crypto.randomUUID().replace(/-/g, ''), referrerId, userId, ipn.payment_id, rewardCents, rewardedAt),
    d1.prepare(
      `UPDATE user_profiles SET settings = json_set(
         COALESCE(settings, '{}'),
         '$.account_credit_cents',
         CAST(COALESCE(json_extract(settings, '$.account_credit_cents'), '0') AS INTEGER) + ?
       ), settings = json_set(
         settings,
         '$.last_referral_reward_at',
         ?
       )
       WHERE user_id = ?`
    ).bind(rewardCents, rewardedAt, referrerId),
  ])

  logger.info('[NOWPayments] Referral reward credited (atomic)', { referrerId, referredUserId: userId, rewardCents })
}

export async function handleRefunded(ipn: NowPaymentsIpnPayload): Promise<Result<void, IPNError>> {
  try {
    const userId = parseUserIdFromOrderId(ipn.order_id || '')
    if (!userId) {
      logger.warn('[NOWPayments] refunded: cannot parse userId', { orderId: ipn.order_id })
      return success(undefined)
    }

    const db = getDb()
    const _d1 = getD1()
    if (!_d1) return failure(new IPNError('D1_BINDING_UNAVAILABLE'))
    const d1 = _d1!

    // Idempotency: the atomic lock in processNowPaymentsIpn (INSERT ON CONFLICT
    // DO NOTHING with event_id = nowpayments_${payment_id}_refunded) already
    // guarantees exactly-once processing per (payment_id, status) pair.
    // The previous SELECT-based check here was redundant and introduced
    // its own TOCTOU window. Trust the atomic lock as the single source of truth.

    // M13 fix (2026-07-01): Single UPDATE with subquery JOIN eliminates
    // TOCTOU between SELECT org_id and UPDATE subscriptions. The previous
    // two-step pattern could miss the subscription if membership changed
    // between queries.
    await d1.prepare(
      `UPDATE subscriptions SET status = 'cancelled', updated_at = ?1
       WHERE org_id IN (SELECT org_id FROM org_members WHERE user_id = ?2)`
    ).bind(new Date().toISOString(), userId).run()

    await invalidateLicenseCacheOnRefund(userId, d1)

    logger.info('[NOWPayments] Payment refunded — subscription cancelled', { userId, paymentId: ipn.payment_id })
    return success(undefined)
  } catch (err) {
    return failure(new IPNError('HANDLE_REFUNDED_FAILED', err))
  }
}

async function invalidateLicenseCacheOnRefund(userId: string, d1: D1Database): Promise<void> {
  try {
    const lic = await d1
      .prepare('SELECT nonce FROM raas_licenses WHERE user_id = ?1 ORDER BY created_at DESC LIMIT 1')
      .bind(userId)
      .first<{ nonce: string }>()
    if (lic?.nonce) {
      const kv = globalThis.KV_KV as KVNamespace | undefined
      await kv?.delete(`license:${lic.nonce}`).catch((e) => { safeCatch('KV license cache delete')(e) })
    }
  } catch (e) { safeCatch('License cache invalidation')(e) }
}

export async function handleFailed(ipn: NowPaymentsIpnPayload): Promise<Result<void, IPNError>> {
  try {
    const userId = parseUserIdFromOrderId(ipn.order_id || '')
    logger.info('[NOWPayments] Payment failed', { userId, paymentId: ipn.payment_id, amount: ipn.price_amount, currency: ipn.price_currency })

    if (ipn.order_id) {
      try {
        await markOrderFailed(ipn.order_id, `payment_status=${ipn.payment_status}`)
      } catch (err) {
        logger.warn('[NOWPayments] markOrderFailed error (non-fatal)', { orderId: ipn.order_id, error: String(err) })
      }
    }

    await triggerDunningOnFailure(userId, ipn)
    return success(undefined)
  } catch (err) {
    return failure(new IPNError('HANDLE_FAILED_FAILED', err))
  }
}

async function triggerDunningOnFailure(
  userId: string | null | undefined,
  ipn: NowPaymentsIpnPayload
): Promise<void> {
  if (!userId) return

  try {
    const db = getDb()
  const lic = await db
      .prepare('SELECT nonce, tier FROM raas_licenses WHERE user_id = ?1 ORDER BY created_at DESC LIMIT 1')
      .bind(userId)
      .first<{ nonce: string; tier: string }>()
    if (lic?.nonce) {
      const { handlePaymentFailure } = await import('./dunning/dunning-actions')
      await handlePaymentFailure({
        userId,
        licenseNonce: lic.nonce,
        tier: (lic.tier || 'BASIC').toUpperCase() as Tier,
        amount: ipn.price_amount ?? 0,
        currency: ipn.price_currency || 'USD',
        failureReason: ipn.payment_status || 'unknown',
        paymentProvider: 'nowpayments',
      })
    }
  } catch (err) {
    logger.warn('[NOWPayments] Dunning trigger failed (non-fatal)', { userId, error: String(err) })
  }
}
