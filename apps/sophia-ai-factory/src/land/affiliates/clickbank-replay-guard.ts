/**
 * ClickBank Replay Guard
 *
 * Prevents double-crediting from duplicate ClickBank INS postbacks.
 * Checks event_id in commission_events table before processing.
 * Uses the same pattern as NOWPayments payment_events lock.
 *
 * @module affiliates/clickbank-replay-guard
 */

import { getD1 } from '@/seed/db/client'
import { logger } from '@/seed/utils/logger-utility'
import { buildClickBankEventId } from './commission-ledger-mutations'

/**
 * Check if a ClickBank postback is a replay (already processed).
 *
 * @param receipt - ClickBank receipt ID
 * @param transactionType - Canonical event type (SALE, REFUND, CHARGEBACK, TEST)
 * @param db - Optional D1Database instance (uses getD1() if not provided)
 * @returns true if the event has already been processed
 */
export async function isReplay(
  receipt: string,
  transactionType: string,
  db?: unknown,
): Promise<boolean> {
  const d1 = db ?? await getD1()
  if (!d1) {
    logger.warn('[clickbank-replay-guard] D1 binding not available — allowing through')
    return false
  }

  const eventId = buildClickBankEventId(receipt, transactionType)

  try {
    const d1Db = d1 as { prepare: (sql: string) => { bind: (...args: unknown[]) => { first: <T>() => Promise<T | null> } } }
    const row = await d1Db
      .prepare('SELECT processed FROM commission_events WHERE event_id = ?1')
      .bind(eventId)
      .first<{ processed: number | boolean }>()

    // Row exists and is processed = replay
    if (row !== null && row !== undefined) {
      return row.processed === 1 || row.processed === true
    }

    return false
  } catch (err) {
    logger.error('[clickbank-replay-guard] Lookup failed', {
      error: err instanceof Error ? err.message : String(err),
      eventId,
    })
    return false
  }
}
