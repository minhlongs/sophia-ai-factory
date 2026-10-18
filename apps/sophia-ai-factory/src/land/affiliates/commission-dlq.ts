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
  UPSERT_COMMISSION_DLQ_SQL,
  SELECT_STALE_COMMISSION_DLQ_SQL,
  RESOLVE_COMMISSION_DLQ_SQL,
  type CommissionDlqEntry,
  type RawD1QueryHandle,
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
      .prepare(UPSERT_COMMISSION_DLQ_SQL)
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
    const rawDb = db as unknown as RawD1QueryHandle
    const result = await rawDb
      .prepare(SELECT_STALE_COMMISSION_DLQ_SQL)
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
      .prepare(RESOLVE_COMMISSION_DLQ_SQL)
      .bind(now, eventId)
      .run()
  } catch (err) {
    safeCatch('resolveCommissionDlqEntry')(err)
  }
}
