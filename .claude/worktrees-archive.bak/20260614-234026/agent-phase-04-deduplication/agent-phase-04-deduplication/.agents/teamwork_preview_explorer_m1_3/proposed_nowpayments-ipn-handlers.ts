/**
 * Proposed NOWPayments IPN (Instant Payment Notification) main dispatcher
 * Statuses: finished | partially_paid | expired | refunded | failed
 * @module billing/proposed-nowpayments-ipn-handlers
 */

import { logger } from '@/seed/utils/logger-utility'
import { getDb } from './nowpayments-ipn-db'
import { handleFailed } from './nowpayments-ipn-subscription'
import { dispatchFinished, dispatchRefunded } from './nowpayments-ipn-dispatch'

export interface NowPaymentsIpnPayload {
  payment_id: string
  payment_status: 'waiting' | 'confirming' | 'confirmed' | 'sending' | 'partially_paid' | 'finished' | 'failed' | 'refunded' | 'expired'
  pay_address?: string
  price_amount: number
  price_currency: string
  pay_amount?: number
  pay_currency?: string
  order_id?: string
  order_description?: string
  invoice_id?: string
  actually_paid?: number
  outcome_amount?: number
  outcome_currency?: string
  customer_email?: string
}

export async function processNowPaymentsIpn(
  ipn: NowPaymentsIpnPayload
): Promise<{ success: boolean; message: string }> {
  const { payment_id, payment_status } = ipn
  const eventId = `nowpayments_${payment_id}_${payment_status}`
  const db = getDb()

  // 1. Atomically reserve event (lock mechanism via UNIQUE constraint on event_id)
  const { error: insertError } = await db.from('payment_events').insert({
    event_id: eventId,
    event_type: `nowpayments.${payment_status}`,
    payload: JSON.stringify(ipn),
    processed: 0,
    created_at: new Date().toISOString()
  })

  if (insertError) {
    // Unique constraint violation or other error
    const { data: existing } = await db
      .from('payment_events')
      .select('processed')
      .eq('event_id', eventId)
      .single()

    if (existing?.processed === 1 || existing?.processed === true) {
      return { success: true, message: 'Already processed' }
    } else {
      return { success: true, message: 'Processing in progress or duplicate request' }
    }
  }

  try {
    switch (payment_status) {
      case 'finished':      await dispatchFinished(ipn); break
      case 'refunded':      await dispatchRefunded(ipn); break
      case 'failed':        await handleFailed(ipn); break
      case 'partially_paid': logger.info('[NOWPayments] Partial payment received — holding', { payment_id }); break
      case 'expired':        logger.info('[NOWPayments] Payment expired — no action', { payment_id }); break
      default:               logger.debug('[NOWPayments] Unhandled status', { payment_status, payment_id })
    }

    // 2. Mark event as processed on success
    await db.from('payment_events').update({
      processed: 1
    }).eq('event_id', eventId)

    return { success: true, message: `Processed ${payment_status}` }
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error))
    logger.error('[NOWPayments] IPN processing failed', err, { payment_id, payment_status })

    // 3. Release the lock on failure to enable retries
    try {
      await db.from('payment_events').delete().eq('event_id', eventId)
    } catch (delErr) {
      logger.warn('[NOWPayments] Failed to release lock on failure', { payment_id, error: String(delErr) })
    }

    return { success: false, message: err.message }
  }
}
