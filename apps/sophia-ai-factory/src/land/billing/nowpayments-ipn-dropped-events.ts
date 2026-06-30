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
import { safeCatch } from '@/seed/utils/safe-catch'
import { success, failure, type Result } from '@/seed/types/result'
import { IPNError } from './nowpayments-ipn-errors'
import type { D1LikeClient } from './nowpayments-ipn-dead-letter'

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

/**
 * Fetch dropped events since a given ISO timestamp.
 */
export async function getDroppedEvents(
  db: D1LikeClient,
  since: string,
  limit: number = 50,
): Promise<DroppedEventRecord[]> {
  try {
    const { data, error } = await db
      .from('payment_events_dropped')
      .select('*')
      .gte('dropped_at', since)
      .order('dropped_at', { ascending: false })
      .limit(limit)

    if (error) {
      logger.error('[DroppedEvents] Failed to fetch dropped events', { error: String(error) })
      return []
    }

    return (data ?? []) as DroppedEventRecord[]
  } catch (err) {
    safeCatch('getDroppedEvents')(err)
    return []
  }
}

/**
 * Find a dropped event by payment_id (for replay).
 */
export async function getDroppedEventByPaymentId(
  db: D1LikeClient,
  paymentId: string,
): Promise<DroppedEventRecord | null> {
  try {
    const { data } = await db
      .from('payment_events_dropped')
      .select('*')
      .eq('payment_id', paymentId)
      .single()

    return (data as unknown as DroppedEventRecord) ?? null
  } catch (err) {
    safeCatch('getDroppedEventByPaymentId')(err)
    return null
  }
}

/**
 * Delete a dropped event record (after successful replay).
 */
export async function deleteDroppedEvent(
  db: D1LikeClient,
  eventId: string,
): Promise<void> {
  try {
    await db.from('payment_events_dropped').delete().eq('event_id', eventId)
  } catch (err) {
    safeCatch('deleteDroppedEvent')(err)
  }
}

/**
 * Count total dropped events for monitoring.
 */
export async function countDroppedEvents(db: D1LikeClient): Promise<number> {
  try {
    const { count, error } = await db
      .from('payment_events_dropped')
      .select('*', { count: 'exact', head: true })

    if (error) return 0
    return typeof count === 'number' ? count : 0
  } catch (err) {
    safeCatch('countDroppedEvents')(err)
    return 0
  }
}
