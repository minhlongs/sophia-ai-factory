/**
 * Stale-Lock Recovery Utilities
 *
 * Shared helpers for detecting and recovering stale payment_events locks.
 * Consumers: overage-topup.ts, nowpayments-ipn-handlers.ts, d1-lock-reaper.ts.
 *
 * @module seed/utils/stale-lock-recovery
 */

import type { Result } from '@/seed/types/result'
import { success, failure } from '@/seed/types/result'

/** Default stale threshold (5 minutes). */
export const DEFAULT_STALE_THRESHOLD_MS = 5 * 60 * 1000

export interface LockRecord {
  processed: number | boolean
  created_at?: string
}

type PreparedQuery<TResult = LockRecord> = {
  bind(...args: unknown[]): { first<T = TResult>(): Promise<T | null>; run<Meta = { changes: number }>(): Promise<{ meta?: Meta }> }
}

export type StaleLockDatabase = {
  prepare(sql: string): PreparedQuery
}

/**
 * Detect whether a lock row is stale (unprocessed and older than threshold).
 *
 * Outcomes:
 * - `success(true)` → lock is stale and should be recovered
 * - `success(false)` → not stale (row absent, already processed, or within threshold)
 * - `failure(Error)` → unexpected database error
 */
export async function detectStaleLock(
  db: StaleLockDatabase,
  eventId: string,
  thresholdMs = DEFAULT_STALE_THRESHOLD_MS,
): Promise<Result<boolean, Error>> {
  try {
    const existing = await db
      .prepare('SELECT processed, created_at FROM payment_events WHERE event_id = ?1')
      .bind(eventId)
      .first<LockRecord>()

    if (!existing || existing.processed === 1) {
      return success(false)
    }

    const createdAt = existing.created_at ? new Date(existing.created_at).getTime() : Date.now()
    return success(Date.now() - createdAt > thresholdMs)
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error))
    return failure(err)
  }
}

/**
 * Release a stale unprocessed lock (`processed = 0`) so a subsequent provider
 * retry can re-acquire the lock and converge ledger + entitlement state.
 *
 * Returns `success(true)` if the stale unprocessed row was deleted,
 * `success(false)` if no matching unprocessed row existed,
 * `failure(Error)` on unexpected errors.
 */
export async function markForRecovery(
  db: StaleLockDatabase,
  eventId: string,
): Promise<Result<boolean, Error>> {
  try {
    const result = await db
      .prepare('DELETE FROM payment_events WHERE event_id = ?1 AND processed = 0')
      .bind(eventId)
      .run<{ changes: number }>()

    return success((result.meta?.changes ?? 0) > 0)
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error))
    return failure(err)
  }
}

/**
 * Clear a stale unprocessed lock so retries can safely re-run fulfillment.
 * Alias for markForRecovery; preserved for call-site readability.
 */
export async function clearStaleLock(
  db: StaleLockDatabase,
  eventId: string,
): Promise<Result<boolean, Error>> {
  return markForRecovery(db, eventId)
}