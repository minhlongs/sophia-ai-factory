/**
 * Read/delete queries for NOWPayments IPN dropped events.
 *
 * @module billing/nowpayments-ipn-dropped-queries
 */

import { logger } from '@/seed/utils/logger-utility'
import { safeCatch } from '@/seed/utils/safe-catch'
import type { D1LikeClient } from './nowpayments-ipn-dead-letter'
import type { DroppedEventRecord } from './nowpayments-ipn-dropped-events'

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
