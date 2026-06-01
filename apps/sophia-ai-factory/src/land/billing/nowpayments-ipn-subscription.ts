/**
 * NOWPayments IPN subscription lifecycle handlers (finished / refunded / failed)
 * handleFinished uses D1 batch() for atomic multi-table update.
 * @module billing/nowpayments-ipn-subscription
 */

import { getTierByInvoiceId } from '@/tree/clients/nowpayments-client'
import { logger } from '@/seed/utils/logger-utility'
import { UNIFIED_TIERS } from '@/seed/config/tiers'
import { getD1Raw } from '@/seed/db/client'
import { recordAudit } from '@/seed/db/audit/audit-log'
import type { Tier } from '@/seed/types'
import type { NowPaymentsIpnPayload } from './nowpayments-ipn-handlers'
import { getDb, parseUserIdFromOrderId } from './nowpayments-ipn-db'
import { createOnboardingVideo, ONBOARDING_TIERS } from '@/land/video/onboarding-video'
import { triggerAutoHandover } from '@/tree/handover/auto-handover'
import { markOrderCompleted, markOrderFailed, getOrderById } from '@/land/orders/pending-order-repo'
import { findReservedRedemption, finalizeRedemption, incrementUsedCount } from '@/land/promo/promo-repo'
import { sendReceiptEmail } from './email/receipt-email-sender'
import { enqueueWelcomeEmail } from '@/forest/outbox/email-outbox'

/** 1% tolerance for crypto gas fees / exchange rounding */
const UNDERPAYMENT_THRESHOLD = 0.99

export async function handleFinished(ipn: NowPaymentsIpnPayload): Promise<void> {
  // Underpayment guard — reject if actually_paid < price_amount * 0.99
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
      return
    }
  }

  const invoiceId = ipn.invoice_id
  if (!invoiceId) { logger.warn('[NOWPayments] finished: missing invoice_id', { paymentId: ipn.payment_id }); return }

  const tierConfig = getTierByInvoiceId(invoiceId)
  if (!tierConfig) { logger.warn('[NOWPayments] finished: unknown invoice_id', { invoiceId, paymentId: ipn.payment_id }); return }

  const userId = parseUserIdFromOrderId(ipn.order_id || '')
  if (!userId) { logger.warn('[NOWPayments] finished: cannot parse userId from order_id', { orderId: ipn.order_id }); return }

  const db = getDb()
  const tier: Tier = tierConfig.tier
  const isLifetime = UNIFIED_TIERS[tier]?.billingType === 'lifetime'

  // Resolve billing period from pending_orders (monthly/yearly/lifetime)
  let billingPeriod: 'monthly' | 'yearly' | 'lifetime' = isLifetime ? 'lifetime' : 'monthly'
  if (ipn.order_id) {
    try {
      const pendingOrder = await getOrderById(ipn.order_id)
      if (pendingOrder?.period === 'yearly') billingPeriod = 'yearly'
      else if (pendingOrder?.period === 'lifetime') billingPeriod = 'lifetime'
    } catch { /* fallback to monthly */ }
  }

  const periodEnd = billingPeriod === 'lifetime'
    ? new Date('2099-12-31T23:59:59Z').toISOString()
    : billingPeriod === 'yearly'
      ? new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString()
      : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
  const now = new Date().toISOString()

  const { data: membership } = await db.from('org_members').select('org_id').eq('user_id', userId).single()
  const orgId = membership?.org_id as string | undefined

  if (orgId) {
    // ── Atomic D1 batch: subscription + organization + pending_orders ──────
    try {
 const d1 = await getD1Raw()
 const { data: currentSub } = await db.from('subscriptions').select('plan').eq('org_id', orgId).single()
 const currentPlan = (currentSub as { plan?: string } | null)?.plan ?? ''
 const isDowngrade = currentPlan === 'master' && tier.toLowerCase() !== 'master'
 const stmts = currentSub
   ? isDowngrade
     ? [
         d1.prepare('UPDATE subscriptions SET current_period_end=?, updated_at=? WHERE org_id=?')
         .bind(periodEnd, now, orgId),
         d1.prepare("UPDATE organizations SET updated_at=? WHERE id=?")
         .bind(now, orgId),
         d1.prepare('UPDATE tier_change_events SET resolved=?, resolved_at=?, note=? WHERE org_id=? AND resolved=?')
         .bind(1, now, 'Blocked: admin-set MASTER tier protected from webhook downgrade', orgId, 0),
       ]
     : [
         d1.prepare('UPDATE subscriptions SET plan=?, status=?, current_period_end=?, updated_at=? WHERE org_id=?')
         .bind(tier.toLowerCase(), 'active', periodEnd, now, orgId),
         d1.prepare('UPDATE organizations SET plan=?, updated_at=? WHERE id=?')
         .bind(tier.toLowerCase(), now, orgId),
       ]
   : [
     d1.prepare('INSERT INTO subscriptions (org_id, plan, status, current_period_start, current_period_end) VALUES (?,?,?,?,?)')
     .bind(orgId, tier.toLowerCase(), 'active', now, periodEnd),
     d1.prepare('UPDATE organizations SET plan=?, updated_at=? WHERE id=?')
     .bind(tier.toLowerCase(), now, orgId),
   ]

      // Mark pending order completed in same batch if order_id present
      if (ipn.order_id) {
        stmts.push(
          d1.prepare('UPDATE pending_orders SET status=?, payment_id=?, completed_at=? WHERE order_id=?')
            .bind('completed', ipn.payment_id, now, ipn.order_id)
        )
      }

      await d1.batch(stmts)
    } catch (batchErr) {
      // Fallback to individual statements if batch fails (e.g. test environment)
  logger.warn('[NOWPayments] D1 batch failed, falling back to individual updates', batchErr instanceof Error ? batchErr : { message: String(batchErr) })
      try {
        const { data: existingSub2 } = await db.from('subscriptions').select('id').eq('org_id', orgId).single()
        if (existingSub2) {
          await db.from('subscriptions').update({ plan: tier.toLowerCase(), status: 'active', current_period_end: periodEnd, updated_at: now }).eq('org_id', orgId)
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
  } else {
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

  // Audit trail — record tier activation event (non-fatal)
  try {
    const d1 = await getD1Raw()
    await recordAudit(d1, {
      tableName: 'subscriptions',
      rowId: orgId ?? userId,
      action: 'update',
      actorId: userId,
      after: { tier, plan: tier.toLowerCase(), status: 'active', periodEnd, paymentId: ipn.payment_id },
    })
  } catch { /* non-fatal */ }

  // Finalize promo code redemption if order had a promo (non-fatal)
  if (ipn.order_id) {
    try {
      const pendingOrder = await getOrderById(ipn.order_id)
      if (pendingOrder?.promo_code) {
        const reserved = await findReservedRedemption(userId, pendingOrder.promo_code)
        if (reserved) {
          // Increment promo usage AFTER payment confirmed to prevent TOCTOU:
          // abandoned checkouts should not consume promo quota.
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

  // Trigger onboarding video for Premium+/MASTER new purchases (non-fatal)
  if (ONBOARDING_TIERS.has(tier)) {
    try {
      const { data: userData } = await db.from('user').select('email').eq('id', userId).single()
      const userEmail = (userData as { email?: string } | null)?.email ?? ''
      if (userEmail) {
        await createOnboardingVideo({
          userId,
          orgId,
          tier,
          paymentId: ipn.payment_id,
          userEmail,
        })
      }
    } catch (err) {
      logger.warn('[NOWPayments] Onboarding video trigger failed (non-fatal)', { userId, error: String(err) })
    }
  }

  // Auto-handover — magic link email (non-fatal)
  try {
    const { data: userRow } = await db.from('user').select('email,name').eq('id', userId).single()
    const userEmail = (userRow as { email?: string; name?: string } | null)?.email ?? ''
    const userName = (userRow as { email?: string; name?: string } | null)?.name ?? undefined
    if (userEmail) {
      const d1 = await getD1Raw()
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

  // Receipt email (non-fatal)
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

  // Post-purchase welcome email via outbox (non-fatal)
  try {
    const { data: userRow } = await db.from('user').select('email,name').eq('id', userId).single()
    const userEmail = (userRow as { email?: string; name?: string } | null)?.email ?? ''
    const userName = (userRow as { email?: string; name?: string } | null)?.name ?? ''
    if (userEmail) {
      const d1 = await getD1Raw()
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

 // Credit referrer reward if this user was referred (non-fatal)
 try {
   const { data: userProfile } = await db.from('user_profiles').select('settings').eq('user_id', userId).single()
   const settings = userProfile?.settings
     ? (typeof userProfile.settings === 'string' ? JSON.parse(userProfile.settings as string) : userProfile.settings) as Record<string, unknown>
     : null
   const referrerId = settings?.referred_by as string | undefined
   if (referrerId && referrerId !== userId) {
     const d1 = await getD1Raw()
     const referrerProfile = await d1
       .prepare(`SELECT settings FROM user_profiles WHERE user_id = ?1`)
       .bind(referrerId)
       .first<{ settings: string | null }>()
     const referrerSettings = referrerProfile?.settings
       ? JSON.parse(referrerProfile.settings)
       : {}
     const rawPayments = (referrerSettings as Record<string, unknown>).referral_rewarded_payments as string[] | undefined
     const rewardedSet: string[] = Array.isArray(rawPayments) ? rawPayments : []
     if (rewardedSet.includes(ipn.payment_id)) {
       logger.info('[NOWPayments] Referral reward already credited — skipping', { referrerId, paymentId: ipn.payment_id })
     } else {
       const rewardCents = UNIFIED_TIERS[tier]
         ? Math.round(UNIFIED_TIERS[tier].price * 100 * 0.10)
         : 1990
       const currentCredit = (referrerSettings.account_credit_cents as number) ?? 0
       referrerSettings.account_credit_cents = currentCredit + rewardCents
       referrerSettings.last_referral_reward_at = new Date().toISOString()
       rewardedSet.push(ipn.payment_id)
       if (rewardedSet.length > 100) rewardedSet.splice(0, rewardedSet.length - 100)
       await d1
         .prepare(`UPDATE user_profiles SET settings = ?1 WHERE user_id = ?2`)
         .bind(JSON.stringify(referrerSettings), referrerId)
         .run()
       logger.info('[NOWPayments] Referral reward credited', { referrerId, referredUserId: userId, rewardCents, totalCredit: referrerSettings.account_credit_cents })
     }
   }
 } catch (err) {
   logger.warn('[NOWPayments] Referral reward credit failed (non-fatal)', { userId, error: String(err) })
 }

  logger.info('[NOWPayments] Payment finished — subscription activated', { userId, orgId, tier, isLifetime, periodEnd, paymentId: ipn.payment_id })
}

export async function handleRefunded(ipn: NowPaymentsIpnPayload): Promise<void> {
  const userId = parseUserIdFromOrderId(ipn.order_id || '')
  if (!userId) { logger.warn('[NOWPayments] refunded: cannot parse userId', { orderId: ipn.order_id }); return }

  const db = getDb()
  const { data: membership } = await db.from('org_members').select('org_id').eq('user_id', userId).single()
  if (membership?.org_id) {
    await db.from('subscriptions').update({ status: 'cancelled', updated_at: new Date().toISOString() }).eq('org_id', membership.org_id)
  }
  logger.info('[NOWPayments] Payment refunded — subscription cancelled', { userId, paymentId: ipn.payment_id })
}

export async function handleFailed(ipn: NowPaymentsIpnPayload): Promise<void> {
  const userId = parseUserIdFromOrderId(ipn.order_id || '')
  logger.info('[NOWPayments] Payment failed', { userId, paymentId: ipn.payment_id, amount: ipn.price_amount, currency: ipn.price_currency })

  // Mark pending order as failed
  if (ipn.order_id) {
    try {
      await markOrderFailed(ipn.order_id, `payment_status=${ipn.payment_status}`)
    } catch (err) {
      logger.warn('[NOWPayments] markOrderFailed error (non-fatal)', { orderId: ipn.order_id, error: String(err) })
    }
  }
}
