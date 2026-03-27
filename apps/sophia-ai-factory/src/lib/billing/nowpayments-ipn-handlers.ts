/**
 * NOWPayments IPN (Instant Payment Notification) handlers
 * Processes payment status callbacks from NOWPayments webhook
 *
 * Statuses handled:
 * - finished: Credit MCU + set period_end +30 days
 * - partially_paid: Hold (wait for full payment)
 * - expired: No-op (invoice expired without payment)
 * - refunded: Deduct MCU credits
 * - failed: Notify only
 */

import { createAdminClient } from '@/lib/supabase/admin'
import { TIER_DB_MAPPING } from '@/lib/subscription'
import { getTierByInvoiceId } from '@/lib/clients/nowpayments-client'
import { logger } from '@/lib/utils/logger-utility'
import { handlePaymentSuccess, handlePaymentFailure } from '@/lib/billing/dunning-workflow'
import type { Tier } from '@/types'

export interface NowPaymentsIpnPayload {
  payment_id: string
  payment_status: 'waiting' | 'confirming' | 'confirmed' | 'sending' | 'partially_paid' | 'finished' | 'failed' | 'refunded' | 'expired'
  pay_address?: string
  price_amount: number
  price_currency: string
  pay_amount?: number
  pay_currency?: string
  order_id?: string          // format: sophia_{orgId}_{timestamp}
  order_description?: string
  invoice_id?: string        // NOWPayments invoice ID maps to tier
  actually_paid?: number
  outcome_amount?: number
  outcome_currency?: string
}

function getSupabase() {
  return createAdminClient() as ReturnType<typeof createAdminClient>
}

/**
 * Parse orgId from order_id (format: sophia_{orgId}_{timestamp})
 */
function parseOrgIdFromOrderId(orderId: string): string | null {
  const parts = orderId.split('_')
  // sophia_{orgId}_{timestamp} → parts[0]=sophia, parts[1]=orgId, parts[2]=timestamp
  if (parts.length >= 3 && parts[0] === 'sophia') {
    return parts[1]
  }
  return null
}

/**
 * Check idempotency - return true if payment_id already processed
 */
async function isPaymentProcessed(paymentId: string): Promise<boolean> {
  const supabase = getSupabase()
  const { data } = await (supabase as any)
    .from('payment_events')
    .select('processed')
    .eq('polar_event_id', `nowpayments_${paymentId}`)
    .single()

  return data?.processed === true
}

/**
 * Record IPN event for idempotency tracking
 */
async function recordIpnEvent(
  paymentId: string,
  status: string,
  payload: Record<string, unknown>,
  processed: boolean
): Promise<void> {
  const supabase = getSupabase()
  await (supabase as any)
    .from('payment_events')
    .upsert(
      {
        event_type: `nowpayments.${status}`,
        polar_event_id: `nowpayments_${paymentId}`,
        payload,
        processed,
        created_at: new Date().toISOString(),
      },
      { onConflict: 'polar_event_id' }
    )
}

/**
 * Handle finished payment - activate subscription +30 days
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
  const orgId = parseOrgIdFromOrderId(orderId)
  if (!orgId) {
    logger.warn('[NOWPayments] finished: cannot parse orgId from order_id', { orderId })
    return
  }

  const supabase = getSupabase()
  const tier: Tier = tierConfig.tier
  const dbTier = TIER_DB_MAPPING[tier]

  // Set period_end = now + 30 days
  const periodEnd = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()

  const { error } = await (supabase as any)
    .from('user_profiles')
    .update({
      subscription_tier: dbTier,
      subscription_status: 'active',
      subscription_expires_at: periodEnd,
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', orgId)

  if (error) {
    logger.error('[NOWPayments] finished: failed to update subscription', error as Error, {
      orgId,
      tier,
      paymentId: ipn.payment_id,
    })
    throw error
  }

  // Trigger dunning payment success
  try {
    await handlePaymentSuccess({
      userId: orgId,
      licenseNonce: '',
      tier,
      paymentProvider: 'nowpayments',
      polarOrderId: ipn.payment_id,
    })
  } catch (err) {
    // Non-fatal: dunning success is informational
    logger.warn('[NOWPayments] finished: dunning success handler failed', {
      orgId,
      error: err instanceof Error ? err.message : String(err),
    })
  }

  logger.info('[NOWPayments] Payment finished - subscription activated', {
    orgId,
    tier,
    periodEnd,
    paymentId: ipn.payment_id,
  })
}

/**
 * Handle refunded payment - deactivate subscription
 */
async function handleRefunded(ipn: NowPaymentsIpnPayload): Promise<void> {
  const orderId = ipn.order_id || ''
  const orgId = parseOrgIdFromOrderId(orderId)
  if (!orgId) {
    logger.warn('[NOWPayments] refunded: cannot parse orgId', { orderId })
    return
  }

  const supabase = getSupabase()
  await (supabase as any)
    .from('user_profiles')
    .update({
      subscription_status: 'cancelled',
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', orgId)

  logger.info('[NOWPayments] Payment refunded - subscription cancelled', {
    orgId,
    paymentId: ipn.payment_id,
  })
}

/**
 * Handle failed payment - notify via dunning workflow
 */
async function handleFailed(ipn: NowPaymentsIpnPayload): Promise<void> {
  const orderId = ipn.order_id || ''
  const orgId = parseOrgIdFromOrderId(orderId)
  if (!orgId) return

  const invoiceId = ipn.invoice_id
  const tierConfig = invoiceId ? getTierByInvoiceId(invoiceId) : null
  const tier: Tier = tierConfig?.tier ?? 'BASIC'

  try {
    await handlePaymentFailure({
      userId: orgId,
      licenseNonce: '',
      tier,
      amount: Math.round(ipn.price_amount * 100),
      currency: ipn.price_currency,
      failureReason: 'payment_failed',
      paymentProvider: 'nowpayments',
      polarOrderId: ipn.payment_id,
    })
  } catch (err) {
    logger.warn('[NOWPayments] failed: dunning failure handler failed', {
      orgId,
      error: err instanceof Error ? err.message : String(err),
    })
  }

  logger.info('[NOWPayments] Payment failed - notified', { orgId, paymentId: ipn.payment_id })
}

/**
 * Main IPN dispatcher - routes to appropriate handler based on payment_status
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
        logger.info('[NOWPayments] Partial payment received - holding', { payment_id })
        break
      case 'expired':
        logger.info('[NOWPayments] Payment expired - no action', { payment_id })
        break
      default:
        logger.debug('[NOWPayments] Unhandled status (informational)', { payment_status, payment_id })
    }

    await recordIpnEvent(payment_id, payment_status, ipn as unknown as Record<string, unknown>, true)

    return { success: true, message: `Processed ${payment_status}` }
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error))
    logger.error('[NOWPayments] IPN processing failed', err, { payment_id, payment_status })
    return { success: false, message: err.message }
  }
}
