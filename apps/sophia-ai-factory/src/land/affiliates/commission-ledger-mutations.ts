/**
 * Commission Ledger Mutations — atomic ClickBank event lock + commission ledger insert
 *
 * Uses INSERT ... ON CONFLICT DO NOTHING for idempotent event processing
 * (same pattern as NOWPayments payment_events in nowpayments-ipn-handlers.ts).
 *
 * event_id format: clickbank_{receipt}_{transactionType}
 *
 * @module affiliates/commission-ledger-mutations
 */

import { getD1 } from '@/seed/db/client'
import { logger } from '@/seed/utils/logger-utility'

export interface LockResult {
  acquired: boolean
  alreadyProcessed: boolean
}

/**
 * Acquire an atomic lock for a ClickBank event.
 *
 * Uses INSERT ON CONFLICT DO NOTHING — single INSERT determines ownership.
 * No INSERT-then-SELECT window (on D1 SQLite).
 *
 * Returns: { acquired: true } if this process owns the lock.
 *         { acquired: false, alreadyProcessed: true } if already processed.
 *         { acquired: false, alreadyProcessed: false } if another process holds it.
 */
export async function acquireCommissionEventLock(
  eventId: string,
  eventType: string,
  payload: Record<string, unknown>,
): Promise<LockResult> {
  const db = await getD1()
  if (!db) {
    logger.error('[commission-ledger] D1 binding not available')
    return { acquired: false, alreadyProcessed: false }
  }

  const now = new Date().toISOString()

  try {
    const lockResult = await db
      .prepare(
        `INSERT INTO commission_events (event_id, event_type, payload, processed, created_at)
         VALUES (?1, ?2, ?3, 0, ?4)
         ON CONFLICT(event_id) DO NOTHING`,
      )
      .bind(eventId, eventType, JSON.stringify(payload), now)
      .run()

    // meta.changes === 0 means ON CONFLICT DO NOTHING fired
    if (!lockResult.meta?.changes) {
      const existing = await db
        .prepare('SELECT processed FROM commission_events WHERE event_id = ?1')
        .bind(eventId)
        .first<{ processed: number | boolean }>()

      if (!existing) {
        return { acquired: false, alreadyProcessed: false }
      }

      if (existing.processed === 1) {
        return { acquired: false, alreadyProcessed: true }
      }

      // Another process holds the lock — not yet processed
      return { acquired: false, alreadyProcessed: false }
    }

    return { acquired: true, alreadyProcessed: false }
  } catch (err) {
    logger.error('[commission-ledger] Lock acquisition failed', {
      error: err instanceof Error ? err.message : String(err),
      eventId,
    })
    return { acquired: false, alreadyProcessed: false }
  }
}

/**
 * Mark a commission event as processed (lock release).
 */
export async function markCommissionEventProcessed(eventId: string): Promise<void> {
  const db = await getD1()
  if (!db) {
    logger.error('[commission-ledger] D1 binding not available for mark processed')
    return
  }

  try {
    await db
      .prepare('UPDATE commission_events SET processed = 1 WHERE event_id = ?1')
      .bind(eventId)
      .run()
  } catch (err) {
    logger.error('[commission-ledger] Failed to mark event processed', {
      error: err instanceof Error ? err.message : String(err),
      eventId,
    })
  }
}

/**
 * Release a lock on transient failure (delete the lock row to allow retry).
 */
export async function releaseCommissionEventLock(eventId: string): Promise<void> {
  const db = await getD1()
  if (!db) return

  try {
    await db
      .prepare('DELETE FROM commission_events WHERE event_id = ?1 AND processed = 0')
      .bind(eventId)
      .run()
  } catch (err) {
    logger.warn('[commission-ledger] Failed to release lock on failure', {
      error: err instanceof Error ? err.message : String(err),
      eventId,
    })
  }
}

/**
 * Build a deterministic event ID for a ClickBank postback.
 * Format: clickbank_{receipt}_{transactionType}
 */
export function buildClickBankEventId(receipt: string, transactionType: string): string {
  return `clickbank_${receipt}_${transactionType}`
}
