/**
 * NOWPayments IPN (Instant Payment Notification) main dispatcher
 * Statuses: finished | partially_paid | expired | refunded | failed
 * @module billing/nowpayments-ipn-handlers
 */

import { logger } from '@/seed/utils/logger-utility'
import { getDb } from './nowpayments-ipn-db'
import { handleFailed } from './nowpayments-ipn-subscription'
import { dispatchFinished, dispatchRefunded } from './nowpayments-ipn-dispatch'
import { enqueueDlqEntry, type D1LikeClient } from './nowpayments-ipn-dead-letter'

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
  /** Customer email passed at invoice creation time — used for auto-handover. */
  customer_email?: string
}

const MAX_DLQ_RETRIES = 3

export async function processNowPaymentsIpn(
  ipn: NowPaymentsIpnPayload,
): Promise<{ success: boolean; message: string }> {
  const { payment_id, payment_status } = ipn
  const eventId = `nowpayments_${payment_id}_${payment_status}`
  const db = getDb()

  // 1. Atomically reserve event (lock mechanism via UNIQUE constraint on event_id)
  const { error: insertError } = await db
    .from('payment_events')
    .insert({
      event_id: eventId,
      event_type: `nowpayments.${payment_status}`,
      payload: JSON.stringify(ipn),
      processed: 0,
      created_at: new Date().toISOString(),
    })

  if (insertError) {
    // Unique constraint violation or other error
    const { data: existing, error: selectError } = await db
      .from('payment_events')
      .select('processed')
      .eq('event_id', eventId)
      .single()

    if (selectError || !existing) {
      return { success: false, message: 'Database query failure' }
    }
    if (existing.processed === 1 || existing.processed === true) {
      return { success: true, message: 'Already processed' }
    } else {
      return { success: false, message: 'Already processing' }
    }
  }

  try {
    switch (payment_status) {
      case 'finished':
        await dispatchFinished(ipn)
        break
      case 'refunded':
        await dispatchRefunded(ipn)
        break
      case 'failed':
        await handleFailed(ipn)
        break
      case 'partially_paid':
        logger.info('[NOWPayments] Partial payment received — holding', { payment_id })
        break
 case 'expired':
 try {
   await db.from('pending_orders').update({ status: 'expired' }).eq('order_id', ipn.order_id)
 } catch { /* non-fatal */ }
 logger.info('[NOWPayments] Payment expired', { payment_id, order_id: ipn.order_id })
 logger.info('[NOWPayments] Payment expired — marked pending_orders expired', { payment_id, order_id: ipn.order_id })
        break
      default:
        logger.debug('[NOWPayments] Unhandled status', { payment_status, payment_id })
    }

    // 2. Mark event as processed on success
    await db.from('payment_events').update({ processed: 1 }).eq('event_id', eventId)
    return { success: true, message: `Processed ${payment_status}` }
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error))
    logger.error('[NOWPayments] IPN processing failed', err, { payment_id, payment_status })

    // 3a. Enqueue to DLQ on permanent failure (non-recoverable errors)
    // NOWPayments will retry automatically on network errors; DLQ is for
    // application-level failures that need manual intervention.
if (isPermanentFailure(err)) {
  const { data: dlqRow } = await db
    .from('ipn_dead_letter_queue')
    .select('retry_count')
    .eq('event_id', eventId)
    .maybeSingle()
  const currentRetries = typeof dlqRow?.retry_count === 'number' ? dlqRow.retry_count : 0
  if (currentRetries >= MAX_DLQ_RETRIES) {
    logger.warn('[NOWPayments] DLQ max retries reached — dropping', {
      eventId,
      reason: err.message,
    })
    return { success: false, message: `Permanent failure after ${MAX_DLQ_RETRIES} retries: ${err.message}` }
  }
  try {
    await enqueueDlqEntry(db as unknown as D1LikeClient, {
      eventId,
      paymentId: payment_id,
      paymentStatus: payment_status,
      orderId: ipn.order_id ?? '',
      payload: ipn as unknown as Record<string, unknown>,
      failureReason: err.message,
      retryCount: currentRetries,
    })
    logger.warn('[NOWPayments] IPN enqueued to DLQ', {
      event_id: eventId,
      reason: err.message,
    })
  } catch (dlqErr) {
    logger.error('[NOWPayments] Failed to enqueue DLQ entry', {
      event_id: eventId,
      error: String(dlqErr),
    })
  }
  return { success: false, message: `Permanent failure: ${err.message}` }
}

    // 3b. Release the lock on failure to enable retries
    try {
      await db.from('payment_events').delete().eq('event_id', eventId)
    } catch (delErr) {
      logger.warn('[NOWPayments] Failed to release lock on failure', {
        payment_id,
        error: String(delErr),
      })
    }

    return { success: false, message: err.message }
  }
}

/**
 * Determine if an error is permanent (non-recoverable) vs transient.
 * Transient errors (network, timeout) should NOT go to DLQ — NOWPayments
 * will retry automatically. Permanent errors need manual intervention.
 */
function isPermanentFailure(err: Error): boolean {
  const permanentPatterns = [
    /UNIQUE constraint/i,
    /NOT NULL constraint/i,
    /FOREIGN KEY constraint/i,
    /no such table/i,
    /schema mismatch/i,
    /invalid payload/i,
    /validation/i,
    /zod/i,
    /no such column/i,
    /datatype mismatch/i,
  ]
  return permanentPatterns.some((pattern) => pattern.test(err.message))
}
