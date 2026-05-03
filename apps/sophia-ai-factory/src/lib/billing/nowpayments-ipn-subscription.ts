/**
 * NOWPayments IPN subscription lifecycle handlers (finished / refunded / failed)
 * handleFinished uses D1 batch() for atomic multi-table update.
 * @module billing/nowpayments-ipn-subscription
 */

import { getTierByInvoiceId } from '@/lib/clients/nowpayments-client'
import { logger } from '@/seed/utils/logger-utility'
import { UNIFIED_TIERS } from '@/seed/config/tiers'
import { getD1Raw } from '@/seed/db/client'
import { recordAudit } from '@/seed/db/audit/audit-log'
import type { Tier } from '@/seed/types'
import type { NowPaymentsIpnPayload } from './nowpayments-ipn-handlers'
import { getDb, parseUserIdFromOrderId } from './nowpayments-ipn-db'
import { createOnboardingVideo, ONBOARDING_TIERS } from '@/lib/video/onboarding-video'
import { triggerAutoHandover } from '@/lib/handover/auto-handover'
import { markOrderCompleted, markOrderFailed } from '@/lib/orders/pending-order-repo'
import { sendReceiptEmail } from './email/receipt-email-sender'

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
  const periodEnd = isLifetime
    ? new Date('2099-12-31T23:59:59Z').toISOString()
    : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
  const now = new Date().toISOString()

  const { data: membership } = await db.from('org_members').select('org_id').eq('user_id', userId).single()
  const orgId = membership?.org_id as string | undefined

  if (orgId) {
    // ── Atomic D1 batch: subscription + organization + pending_orders ──────
    try {
      const d1 = await getD1Raw()
      const { data: existingSub } = await db.from('subscriptions').select('id').eq('org_id', orgId).single()

      const stmts = existingSub
        ? [
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
      logger.warn('[NOWPayments] D1 batch failed, falling back to individual updates', { error: String(batchErr) })
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
        period: isLifetime ? 'lifetime' : 'monthly',
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
