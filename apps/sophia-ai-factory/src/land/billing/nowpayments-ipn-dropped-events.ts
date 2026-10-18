/**
 * Dropped events tracking for NOWPayments IPN DLQ overflow.
 *
 * When the dead-letter queue reaches capacity (DLQ_SIZE_CAP=1000), IPN events
 * are rejected to prevent unbounded growth. This module records those dropped
 * events durably so operators can reconcile and replay them.
 *
 * @module billing/nowpayments-ipn-dropped-events
 */

import { logger } from '@/seed/utils/logger-utility'
import { success, failure, type Result } from '@/seed/types/result'
import { IPNError } from './nowpayments-ipn-errors'
import type { D1LikeClient } from './nowpayments-ipn-dead-letter'

export {
  getDroppedEvents,
  getDroppedEventByPaymentId,
  deleteDroppedEvent,
  countDroppedEvents,
} from './nowpayments-ipn-dropped-queries'

// ── Types ──────────────────────────────────────────────────────────────────────

export interface DroppedEventRecord {
  id: string
  event_id: string
  payment_id: string
  payment_status: string
  order_id: string
  payload: string
  failure_reason: string
  dlq_size_at_drop: number
  dropped_at: string
}

export interface RecordDroppedEventInput {
  eventId: string
  paymentId: string
  paymentStatus: string
  orderId: string
  payload: Record<string, unknown>
  failureReason: string
  dlqSize: number
}

// ── Public API ─────────────────────────────────────────────────────────────────

/**
 * Record a dropped event in payment_events_dropped before rejecting the IPN.
 * Non-fatal: failure to record is logged but does not block the rejection.
 */
export async function recordDroppedEvent(
  db: D1LikeClient,
  input: RecordDroppedEventInput,
): Promise<Result<void, IPNError>> {
  try {
    const payloadJson = JSON.stringify(input.payload)

    const { error } = await db.from('payment_events_dropped').insert({
      event_id: input.eventId,
      payment_id: input.paymentId,
      payment_status: input.paymentStatus,
      order_id: input.orderId,
      payload: payloadJson,
      failure_reason: input.failureReason,
      dlq_size_at_drop: input.dlqSize,
    })

    if (error) {
      logger.error('[DroppedEvents] Failed to record dropped event', {
        eventId: input.eventId,
        paymentId: input.paymentId,
        error: String(error),
      })
      return failure(new IPNError('RECORD_DROPPED_FAILED', error))
    }

    return success(undefined)
  } catch (err) {
    logger.error('[DroppedEvents] Exception recording dropped event', {
      eventId: input.eventId,
      error: String(err),
    })
    return failure(new IPNError('RECORD_DROPPED_EXCEPTION', err))
  }
}
