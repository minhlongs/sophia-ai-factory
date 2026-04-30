/**
 * NOWPayments IPN subscription lifecycle handlers (finished / refunded / failed)
 * @module billing/nowpayments-ipn-subscription
 */

import { getTierByInvoiceId } from '@/lib/clients/nowpayments-client'
import { logger } from '@/lib/utils/logger-utility'
import { UNIFIED_TIERS } from '@/config/tiers'
import { getD1Raw } from '@/lib/db/client'
import { recordAudit } from '@/lib/db/audit/audit-log'
import type { Tier } from '@/types'
import type { NowPaymentsIpnPayload } from './nowpayments-ipn-handlers'
import { getDb, parseUserIdFromOrderId } from './nowpayments-ipn-db'
import { createOnboardingVideo, ONBOARDING_TIERS } from '@/lib/video/onboarding-video'

export async function handleFinished(ipn: NowPaymentsIpnPayload): Promise<void> {
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

  const { data: membership } = await db.from('org_members').select('org_id').eq('user_id', userId).single()
  const orgId = membership?.org_id

  if (orgId) {
    const { data: existingSub } = await db.from('subscriptions').select('id').eq('org_id', orgId).single()
    if (existingSub) {
      await db.from('subscriptions').update({ plan: tier.toLowerCase(), status: 'active', current_period_end: periodEnd, updated_at: new Date().toISOString() }).eq('org_id', orgId)
    } else {
      await db.from('subscriptions').insert({ org_id: orgId, plan: tier.toLowerCase(), status: 'active', current_period_start: new Date().toISOString(), current_period_end: periodEnd })
    }
    await db.from('organizations').update({ plan: tier.toLowerCase(), updated_at: new Date().toISOString() }).eq('id', orgId)
  } else {
    logger.warn('[NOWPayments] No org membership found for userId, trying direct user update', { userId })
    const { data: newOrg } = await db.from('organizations').insert({ name: `User ${userId}`, plan: tier.toLowerCase() }).select('id').single()
    if (newOrg?.id) {
      await db.from('org_members').insert({ org_id: newOrg.id, user_id: userId, role: 'owner' })
      await db.from('subscriptions').insert({ org_id: newOrg.id, plan: tier.toLowerCase(), status: 'active', current_period_start: new Date().toISOString(), current_period_end: periodEnd })
    }
  }

  // Audit trail — record tier activation event
  try {
    const d1 = await getD1Raw()
    await recordAudit(d1, {
      tableName: 'subscriptions',
      rowId: (orgId as string | undefined) ?? userId,
      action: 'update',
      actorId: userId,
      after: { tier, plan: tier.toLowerCase(), status: 'active', periodEnd, paymentId: ipn.payment_id },
    })
  } catch { /* non-fatal */ }

  // Trigger onboarding video for Premium+/MASTER new purchases
  if (ONBOARDING_TIERS.has(tier)) {
    try {
      const { data: userData } = await db.from('user').select('email').eq('id', userId).single()
      const userEmail = (userData as { email?: string } | null)?.email ?? ''
      if (userEmail) {
        await createOnboardingVideo({
          userId,
          orgId: (orgId as string | undefined),
          tier,
          paymentId: ipn.payment_id,
          userEmail,
        })
      }
    } catch (err) {
      logger.warn('[NOWPayments] Onboarding video trigger failed (non-fatal)', { userId, error: String(err) })
    }
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
}
