/**
 * NOWPayments IPN (Instant Payment Notification) handlers
 * Uses D1 database (Cloudflare Workers compatible)
 *
 * Statuses handled:
 * - finished: Update subscription + set period_end (+30 days for monthly, 2099 for lifetime)
 * - partially_paid: Hold (wait for full payment)
 * - expired: No-op (invoice expired without payment)
 * - refunded: Cancel subscription
 * - failed: Notify only
 */

import { createServerClient } from '@/lib/db/client'
import { getTierByInvoiceId } from '@/lib/clients/nowpayments-client'
import { logger } from '@/lib/utils/logger-utility'
import { UNIFIED_TIERS } from '@/config/tiers'
import type { Tier } from '@/types'

export interface NowPaymentsIpnPayload {
  payment_id: string
  payment_status: 'waiting' | 'confirming' | 'confirmed' | 'sending' | 'partially_paid' | 'finished' | 'failed' | 'refunded' | 'expired'
  pay_address?: string
  price_amount: number
  price_currency: string
  pay_amount?: number
  pay_currency?: string
  order_id?: string          // format: sophia_{userId}_{timestamp}
  order_description?: string
  invoice_id?: string        // NOWPayments invoice ID maps to tier
  actually_paid?: number
  outcome_amount?: number
  outcome_currency?: string
}

function getDb() {
  return createServerClient()
}

/**
 * Parse userId from order_id (format: sophia_{userId}_{timestamp})
 */
function parseUserIdFromOrderId(orderId: string): string | null {
  const parts = orderId.split('_')
  // sophia_{userId}_{timestamp} → parts[0]=sophia, parts[1]=userId, parts[2]=timestamp
  if (parts.length >= 3 && parts[0] === 'sophia') {
    return parts[1]
  }
  return null
}

/**
 * Check idempotency via D1 payment_events table
 */
async function isPaymentProcessed(paymentId: string): Promise<boolean> {
  try {
    const db = getDb()
    const { data } = await db
      .from('payment_events')
      .select('processed')
      .eq('event_id', `nowpayments_${paymentId}`)
      .single()
    return data?.processed === 1 || data?.processed === true
  } catch {
    return false
  }
}

/**
 * Record IPN event in D1 for idempotency
 */
async function recordIpnEvent(
  paymentId: string,
  status: string,
  payload: Record<string, unknown>,
  processed: boolean
): Promise<void> {
  try {
    const db = getDb()
    await db
      .from('payment_events')
      .upsert(
        {
          event_id: `nowpayments_${paymentId}`,
          event_type: `nowpayments.${status}`,
          payload: JSON.stringify(payload),
          processed: processed ? 1 : 0,
          created_at: new Date().toISOString(),
        },
        { onConflict: 'event_id' }
      )
  } catch (err) {
    logger.warn('[NOWPayments] Failed to record IPN event', {
      paymentId,
      error: err instanceof Error ? err.message : String(err),
    })
  }
}

/**
 * Handle finished payment — activate subscription via D1
 */
async function handleFinished(ipn: NowPaymentsIpnPayload): Promise<void> {
  const invoiceId = ipn.invoice_id
  if (!invoiceId) {
    logger.warn('[NOWPayments] finished: missing invoice_id', { paymentId: ipn.payment_id })
    return
  }

  const tierConfig = getTierByInvoiceId(invoiceId)
  if (!tierConfig) {
    logger.warn('[NOWPayments] finished: unknown invoice_id', { invoiceId, paymentId: ipn.payment_id })
    return
  }

  const orderId = ipn.order_id || ''
  const userId = parseUserIdFromOrderId(orderId)
  if (!userId) {
    logger.warn('[NOWPayments] finished: cannot parse userId from order_id', { orderId })
    return
  }

  const db = getDb()
  const tier: Tier = tierConfig.tier

  // Lifetime tiers (MASTER) get far-future expiry — never expire in practice
  const isLifetime = UNIFIED_TIERS[tier]?.billingType === 'lifetime'
  const periodEnd = isLifetime
    ? new Date('2099-12-31T23:59:59Z').toISOString()
    : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()

  // Update subscription in D1 subscriptions table
  // First find the user's org
  const { data: membership } = await db
    .from('org_members')
    .select('org_id')
    .eq('user_id', userId)
    .single()

  const orgId = membership?.org_id

  if (orgId) {
    // Update existing subscription or create new one
    const { data: existingSub } = await db
      .from('subscriptions')
      .select('id')
      .eq('org_id', orgId)
      .single()

    if (existingSub) {
      await db
        .from('subscriptions')
        .update({
          plan: tier.toLowerCase(),
          status: 'active',
          current_period_end: periodEnd,
          updated_at: new Date().toISOString(),
        })
        .eq('org_id', orgId)
    } else {
      await db
        .from('subscriptions')
        .insert({
          org_id: orgId,
          plan: tier.toLowerCase(),
          status: 'active',
          current_period_start: new Date().toISOString(),
          current_period_end: periodEnd,
        })
    }

    // Also update org plan
    await db
      .from('organizations')
      .update({
        plan: tier.toLowerCase(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', orgId)
  } else {
    // No org membership — try to update user_profiles if Supabase is available (fallback)
    logger.warn('[NOWPayments] No org membership found for userId, trying direct user update', { userId })

    // Create a standalone org + membership for the user
    const { data: newOrg } = await db
      .from('organizations')
      .insert({
        name: `User ${userId}`,
        plan: tier.toLowerCase(),
      })
      .select('id')
      .single()

    if (newOrg?.id) {
      await db.from('org_members').insert({
        org_id: newOrg.id,
        user_id: userId,
        role: 'owner',
      })

      await db.from('subscriptions').insert({
        org_id: newOrg.id,
        plan: tier.toLowerCase(),
        status: 'active',
        current_period_start: new Date().toISOString(),
        current_period_end: periodEnd,
      })
    }
  }

  logger.info('[NOWPayments] Payment finished — subscription activated', {
    userId,
    orgId,
    tier,
    isLifetime,
    periodEnd,
    paymentId: ipn.payment_id,
  })
}

/**
 * Handle refunded payment — cancel subscription
 */
async function handleRefunded(ipn: NowPaymentsIpnPayload): Promise<void> {
  const orderId = ipn.order_id || ''
  const userId = parseUserIdFromOrderId(orderId)
  if (!userId) {
    logger.warn('[NOWPayments] refunded: cannot parse userId', { orderId })
    return
  }

  const db = getDb()
  const { data: membership } = await db
    .from('org_members')
    .select('org_id')
    .eq('user_id', userId)
    .single()

  if (membership?.org_id) {
    await db
      .from('subscriptions')
      .update({
        status: 'cancelled',
        updated_at: new Date().toISOString(),
      })
      .eq('org_id', membership.org_id)
  }

  logger.info('[NOWPayments] Payment refunded — subscription cancelled', {
    userId,
    paymentId: ipn.payment_id,
  })
}

/**
 * Handle failed payment — log only (dunning workflow removed for D1 simplicity)
 */
async function handleFailed(ipn: NowPaymentsIpnPayload): Promise<void> {
  const orderId = ipn.order_id || ''
  const userId = parseUserIdFromOrderId(orderId)

  logger.info('[NOWPayments] Payment failed', {
    userId,
    paymentId: ipn.payment_id,
    amount: ipn.price_amount,
    currency: ipn.price_currency,
  })
}

/**
 * Main IPN dispatcher
 */
export async function processNowPaymentsIpn(
  ipn: NowPaymentsIpnPayload
): Promise<{ success: boolean; message: string }> {
  const { payment_id, payment_status } = ipn

  // Idempotency check
  if (await isPaymentProcessed(payment_id)) {
    return { success: true, message: 'Already processed' }
  }

  // Record as pending
  await recordIpnEvent(payment_id, payment_status, ipn as unknown as Record<string, unknown>, false)

  try {
    switch (payment_status) {
      case 'finished':
        await handleFinished(ipn)
        break
      case 'refunded':
        await handleRefunded(ipn)
        break
      case 'failed':
        await handleFailed(ipn)
        break
      case 'partially_paid':
        logger.info('[NOWPayments] Partial payment received — holding', { payment_id })
        break
      case 'expired':
        logger.info('[NOWPayments] Payment expired — no action', { payment_id })
        break
      default:
        logger.debug('[NOWPayments] Unhandled status', { payment_status, payment_id })
    }

    await recordIpnEvent(payment_id, payment_status, ipn as unknown as Record<string, unknown>, true)

    return { success: true, message: `Processed ${payment_status}` }
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error))
    logger.error('[NOWPayments] IPN processing failed', err, { payment_id, payment_status })
    return { success: false, message: err.message }
  }
}
