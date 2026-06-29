/**
 * NOWPayments IPN (Instant Payment Notification) main dispatcher
 * Statuses: finished | partially_paid | expired | refunded | failed
 * @module billing/nowpayments-ipn-handlers
 */

import { logger } from '@/seed/utils/logger-utility'
import { safeCatch } from '@/seed/utils/safe-catch'
import { getDb } from './nowpayments-ipn-db'
import { handleFailed } from './nowpayments-ipn-subscription'
import { dispatchFinished, dispatchRefunded } from './nowpayments-ipn-dispatch'
import { enqueueDlqEntry, countUnresolvedDlq, type D1LikeClient } from './nowpayments-ipn-dead-letter'

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
const DLQ_SIZE_CAP = 1000

export async function processNowPaymentsIpn(
  ipn: NowPaymentsIpnPayload,
): Promise<{ success: boolean; message: string }> {
  const { payment_id, payment_status } = ipn
  const eventId = `nowpayments_${payment_id}_${payment_status}`
  const db = getDb()
  const now = new Date().toISOString()

  // ── 1. Atomic lock via INSERT ... ON CONFLICT DO NOTHING ──────────────────
  // PayOS-style pattern: single INSERT determines lock ownership atomically.
  // No INSERT-then-SELECT window — the INSERT IS the lock operation on D1 SQLite.
  const lockResult = await db
    .prepare(
      `INSERT INTO payment_events (event_id, event_type, payload, processed, created_at)
       VALUES (?1, ?2, ?3, 0, ?4)
       ON CONFLICT(event_id) DO NOTHING`,
    )
    .bind(eventId, `nowpayments.${payment_status}`, JSON.stringify(ipn), now)
    .run()

  // meta.changes === 0 means ON CONFLICT DO NOTHING fired — another request owns the lock
  if (!lockResult.meta?.changes) {
    const existing = await db
      .prepare('SELECT processed, created_at FROM payment_events WHERE event_id = ?1')
      .bind(eventId)
      .first<{ processed: number | boolean; created_at: string }>()

    if (!existing) {
      return { success: false, message: 'Database query failure' }
    }

    if (existing.processed === 1) {
      return { success: true, message: 'Already processed' }
    }

    // Stale lock recovery: if lock > 5 min old, mark processed to unblock
    const lockAgeMs = Date.now() - new Date(existing.created_at ?? now).getTime()
    if (lockAgeMs > 5 * 60 * 1000) {
      try {
        await db
          .prepare('UPDATE payment_events SET processed = 1 WHERE event_id = ?1')
          .bind(eventId)
          .run()
      } catch (e) { safeCatch('Stale lock update')(e) }
      return { success: true, message: 'Stale lock cleared (marked processed)' }
    }

    // Another process is currently handling this event — back off
    return { success: false, message: 'Already processing' }
  }

  // ── 2. This process owns the lock — dispatch to handlers ──────────────────
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
      case 'waiting':
      case 'confirming':
      case 'confirmed':
      case 'sending':
        logger.debug('[NOWPayments] Intermediate status, waiting for final', {
          payment_status, payment_id, order_id: ipn.order_id,
        })
        break
      case 'expired':
        try {
          await db.from('pending_orders').update({ status: 'expired' }).eq('order_id', ipn.order_id)
        } catch (e) { safeCatch('Expired order mark')(e) }
        logger.info('[NOWPayments] Payment expired', { payment_id, order_id: ipn.order_id })
        logger.info('[NOWPayments] Payment expired — marked pending_orders expired', { payment_id, order_id: ipn.order_id })
        break
      default:
        logger.debug('[NOWPayments] Unhandled status', { payment_status, payment_id })
    }

    // Mark event as processed — lock released
    await db
      .prepare('UPDATE payment_events SET processed = 1 WHERE event_id = ?1')
      .bind(eventId)
      .run()
    return { success: true, message: `Processed ${payment_status}` }
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error))
    logger.error('[NOWPayments] IPN processing failed', err, { payment_id, payment_status })

    // ── 3a. Enqueue to DLQ on permanent failure ────────────────────────────
    if (isPermanentFailure(err)) {
      const dlqRow = await db
        .from('ipn_dead_letter_queue')
        .select('retry_count')
        .eq('event_id', eventId)
        .maybeSingle()
      const currentRetries = typeof dlqRow?.data?.retry_count === 'number'
        ? dlqRow.data.retry_count
        : 0

      if (currentRetries >= MAX_DLQ_RETRIES) {
        logger.error(
          '[NOWPayments] DLQ_EXHAUSTED — permanent failure, alert required',
          { eventId, payment_id, payment_status, reason: err.message },
        )
        return { success: false, message: `Permanent failure after ${MAX_DLQ_RETRIES} retries: ${err.message}` }
      }

      // DLQ size guard with graduated thresholds (Phase 5)
      const unresolvedDlqCount = await countUnresolvedDlq(db as unknown as D1LikeClient)

      // 50% warning threshold — operator should investigate
      if (unresolvedDlqCount >= DLQ_SIZE_CAP * 0.5 && unresolvedDlqCount < DLQ_SIZE_CAP * 0.9) {
        logger.warn('[NOWPayments] DLQ capacity warning', {
          unresolvedCount: unresolvedDlqCount,
          capacity: DLQ_SIZE_CAP,
          pct: Math.round((unresolvedDlqCount / DLQ_SIZE_CAP) * 100),
        })
      }

      // 90% critical threshold — near overflow, urgent action needed
      if (unresolvedDlqCount >= DLQ_SIZE_CAP * 0.9 && unresolvedDlqCount < DLQ_SIZE_CAP) {
        logger.error('[NOWPayments] DLQ capacity critical', {
          unresolvedCount: unresolvedDlqCount,
          capacity: DLQ_SIZE_CAP,
          pct: Math.round((unresolvedDlqCount / DLQ_SIZE_CAP) * 100),
        })
      }

      if (unresolvedDlqCount >= DLQ_SIZE_CAP) {
        logger.error('[NOWPayments] DLQ_OVERFLOW — rejecting new entry', {
          eventId,
          unresolvedCount: unresolvedDlqCount,
        })
        return {
          success: false,
          message: `DLQ at capacity (${unresolvedDlqCount}/${DLQ_SIZE_CAP}); event ${eventId} dropped`,
        }
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

    // ── 3b. Release lock on transient failure (enable retries) ─────────────
    try {
      await db
        .prepare('DELETE FROM payment_events WHERE event_id = ?1')
        .bind(eventId)
        .run()
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
