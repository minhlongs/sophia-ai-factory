/**
 * Commission Dead-Letter Queue (DLQ)
 *
 * Captures commission ledger write failures after retry exhaustion.
 * Same pattern as payment DLQ (nowpayments-ipn-dead-letter.ts):
 * INSERT ON CONFLICT updates retry_count.
 *
 * @module affiliates/commission-dlq
 */

import { getD1 } from '@/seed/db/client'
import { logger } from '@/seed/utils/logger-utility'
import { safeCatch } from '@/seed/utils/safe-catch'
import { success, failure, type Result } from '@/seed/types/result'
import {
  mapCommissionDlqRow,
  COMMISSION_DLQ_SCHEMA,
  type CommissionDlqEntry,
} from './commission-dlq-schema'

export { COMMISSION_DLQ_SCHEMA, type CommissionDlqEntry }

/**
 * Enqueue a failed commission event to the DLQ (INSERT ON CONFLICT increments retry_count).
 */
export async function enqueueCommissionDlq(
  eventId: string,
  receipt: string,
  transactionType: string,
  amount: number,
  payload: string,
  failureReason: string,
  retryCount: number = 0,
): Promise<Result<void, Error>> {
  const db = await getD1()
  if (!db) {
    return failure(new Error('D1 binding not available'))
  }

  const now = new Date().toISOString()

  try {
    await db
      .prepare(
        `INSERT INTO commission_dead_letter
         (event_id, receipt, transaction_type, amount, payload,
          failure_reason, retry_count, first_failed_at, last_attempted_at, resolved)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, 0)
         ON CONFLICT(event_id) DO UPDATE SET
           retry_count = retry_count + 1,
           failure_reason = ?6,
           last_attempted_at = ?9`,
      )
      .bind(
        eventId,
        receipt,
        transactionType,
        amount,
        payload,
        failureReason,
        retryCount + 1,
        now,
        now,
      )
      .run()

    return success(undefined)
  } catch (err) {
    logger.error('[commission-dlq] Enqueue failed', {
      error: err instanceof Error ? err.message : String(err),
      eventId,
    })
    return failure(
      err instanceof Error
        ? new Error(`Failed to enqueue commission DLQ: ${err.message}`)
        : new Error('Failed to enqueue commission DLQ'),
    )
  }
}

/**
 * Get stale (unresolved) DLQ entries older than maxAgeHours.
 * Used for nightly reconciliation/replay.
 */
export async function getStaleCommissionEntries(
  maxAgeHours: number = 24,
  limit: number = 50,
): Promise<CommissionDlqEntry[]> {
  const db = await getD1()
  if (!db) {
    logger.error('[commission-dlq] D1 binding not available')
    return []
  }

  const cutoff = new Date(Date.now() - maxAgeHours * 60 * 60 * 1000).toISOString()

  try {
    const rawDb = db as unknown as {
      prepare: (sql: string) => {
        bind: (...args: unknown[]) => {
          all: <T>() => Promise<{ results: T[] }>
        }
      }
    }

    const result = await rawDb
      .prepare(
        `SELECT * FROM commission_dead_letter
         WHERE resolved = 0 AND last_attempted_at < ?1
         ORDER BY first_failed_at ASC
         LIMIT ?2`,
      )
      .bind(cutoff, limit)
      .all<Record<string, unknown>>()

    return (result.results ?? []).map(mapCommissionDlqRow)
  } catch (err) {
    safeCatch('getStaleCommissionEntries')(err)
    return []
  }
}

/**
 * Mark a DLQ entry as resolved.
 */
export async function resolveCommissionDlqEntry(eventId: string): Promise<void> {
  const db = await getD1()
  if (!db) return

  const now = new Date().toISOString()
  try {
    await db
      .prepare(
        `UPDATE commission_dead_letter
         SET resolved = 1, resolved_at = ?1
         WHERE event_id = ?2`,
      )
      .bind(now, eventId)
      .run()
  } catch (err) {
    safeCatch('resolveCommissionDlqEntry')(err)
  }
}
