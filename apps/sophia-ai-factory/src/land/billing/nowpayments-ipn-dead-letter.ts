/**
 * NOWPayments IPN Dead-Letter Queue (DLQ)
 *
 * Captures IPN events that failed permanently after retry attempts.
 *
 * Constants
 * - MAX_DLQ_RETRIES caps the total attempt count before a row is marked exhausted
 *   (resolved=2). Defaults to 5 and is overridable at runtime via the
 *   IPN_MAX_DLQ_RETRIES environment variable.
 * - RETENTION windows control batch cleanups from the DLQ reaper:
 *   - resolved=1 (succeeded-by-handler): 30 days
 *   - resolved=2 (exhausted): 90 days
 * - ALERT_THRESHOLDS drive runtime warnings:
 *   - unresolvedCount > 100 → warn
 *   - exhaustedRate > 0.20 → critical
 *
 * Backwards compatibility: existing resolved=0/1 rows keep their prior
 * semantics. resolved=2 is a new terminal state interpreted as "exhausted".
 *
 * @module billing/nowpayments-ipn-dead-letter
 */

import { safeCatch } from '@/seed/utils/safe-catch'
import { logger } from '@/seed/utils/logger-utility'
import { success, failure, type Result } from '@/seed/types/result'
import { DLQError } from './nowpayments-ipn-errors'

/** DLQ entry — mirrors the subset of ipn_dead_letter_queue we need for recovery. */
export interface DeadLetterEntry {
  event_id: string
  payment_id: string
  payment_status: string
  order_id: string
  payload: Record<string, unknown>
  failure_reason: string
  retry_count: number
  first_failed_at: string // ISO-8601
  last_attempted_at: string // ISO-8601
  resolved: boolean
  resolved_at?: string
}

/** Options for enqueuing a DLQ entry. */
export interface EnqueueDlqOptions {
  eventId: string
  paymentId: string
  paymentStatus: string
  orderId: string
  payload: Record<string, unknown>
  failureReason: string
  retryCount: number
}

const DLQ_TABLE = 'ipn_dead_letter_queue'
export const MAX_DLQ_RETRIES = Math.max(
  1,
  parseInt(process.env.IPN_MAX_DLQ_RETRIES ?? '5', 10) || 5,
)
const RESOLVED_RETENTION_DAYS = 30
const EXHAUSTED_RETENTION_DAYS = 90
const RETENTION_BATCH_SIZE = 500
const DLQ_WARN_SIZE = 100
const EXHAUSTED_WARN_RATE = 0.2

// ---------------------------------------------------------------------------
// Public constants (re-exported for reaper / callers)
// ---------------------------------------------------------------------------
export { DLQ_WARN_SIZE, EXHAUSTED_WARN_RATE, RESOLVED_RETENTION_DAYS, EXHAUSTED_RETENTION_DAYS, RETENTION_BATCH_SIZE }

// ---------------------------------------------------------------------------
// Core CRUD
// ---------------------------------------------------------------------------

/**
 * Enqueue (or update) a DLQ entry.
 *
 * Uses UNIQUE(event_id) — if already present, increments retry_count
 * and updates last_attempted_at / failure_reason.
 *
 * Accepts a D1-like client (Supabase .from()/.insert() style) or raw
 * { prepare() } style — both are supported for flexibility.
 */
export async function enqueueDlqEntry(
  db: D1LikeClient,
  opts: EnqueueDlqOptions,
): Promise<Result<void, DLQError>> {
  try {
    const now = new Date().toISOString()
    const payloadJson = JSON.stringify(opts.payload)

    // Try INSERT first (idempotent — UNIQUE constraint handles replays)
    const { error: insertError } = await db
      .from(DLQ_TABLE)
      .insert({
        event_id: opts.eventId,
        payment_id: opts.paymentId,
        payment_status: opts.paymentStatus,
        order_id: opts.orderId,
        payload: payloadJson,
        failure_reason: opts.failureReason,
        retry_count: opts.retryCount,
        first_failed_at: now,
        last_attempted_at: now,
        resolved: 0,
      })

    if (insertError) {
      // UNIQUE violation on event_id — update existing row
      const isUniqueViolation =
        typeof insertError === 'object' &&
        insertError !== null &&
        'code' in insertError &&
        (insertError as { code?: string }).code === '23505'

      if (isUniqueViolation || typeof insertError === 'string') {
        // Update retry metadata only — first_failed_at must NOT be overwritten
        // (it preserves the original failure timestamp for SLA monitoring)
        await db
          .from(DLQ_TABLE)
          .update({
            retry_count: opts.retryCount + 1,
            failure_reason: opts.failureReason,
            last_attempted_at: now,
          })
          .eq('event_id', opts.eventId)
          .eq('resolved', 0)
      } else {
        // Non-unique, non-string error — log and fail rather than silently swallowing
        logger.error('[DLQ] Insert failed with unexpected error', {
          eventId: opts.eventId,
          error: insertError,
        })
        return failure(new DLQError('ENQUEUE_DLQ_FAILED', insertError))
      }
    }

    return success(undefined)
  } catch (err) {
    return failure(new DLQError('ENQUEUE_DLQ_FAILED', err))
  }
}

/**
 * Mark a DLQ entry as successfully resolved (resolved=1).
 */
export async function resolveDlqEntry(
  db: D1LikeClient,
  eventId: string,
): Promise<void> {
  const now = new Date().toISOString()
  await db
    .from(DLQ_TABLE)
    .update({ resolved: 1, resolved_at: now })
    .eq('event_id', eventId)
}

/**
 * Terminal-mark an entry as exhausted after MAX_DLQ_RETRIES were reached.
 *
 * resolved=2 signals "processing stopped permanently". The reaper will
 * eventually age-reap these rows (retention=90d) and alerting monitors the
 * exhausted rate.
 */
export async function markDlqExhausted(
  db: D1LikeClient,
  eventId: string,
): Promise<void> {
  const now = new Date().toISOString()
  await db
    .from(DLQ_TABLE)
    .update({ resolved: 2, resolved_at: now })
    .eq('event_id', eventId)
    .eq('resolved', 0)
}

// ---------------------------------------------------------------------------
// Query helpers
// ---------------------------------------------------------------------------

/**
 * Fetch unresolved (resolved=0) DLQ entries stale beyond the given age in hours.
 * Useful for nightly reconciliation batch jobs. The reaper uses the default
 * one-hour horizon; longer horizons are valid for one-off investigations.
 */
export async function getStaleDlqEntries(
  db: D1LikeClient,
  maxAgeHours: number = 24,
  limit?: number,
): Promise<DeadLetterEntry[]> {
  const cutoff = new Date(Date.now() - maxAgeHours * 60 * 60 * 1000).toISOString()

  let query = db
    .from(DLQ_TABLE)
    .select('*')
    .eq('resolved', 0)
    .lt('last_attempted_at', cutoff)
    .order('first_failed_at', { ascending: true })

  if (limit) {
    query = query.limit(limit)
  }

  const { data, error } = await query

  if (error || !data) {
    return []
  }

  return (data as unknown[]).map((row) => {
    const r = row as Record<string, unknown>
    let payload: Record<string, unknown> = {}
    try {
      payload = JSON.parse(r.payload as string) as Record<string, unknown>
    } catch (e) {
      safeCatch('DLQ payload parse')(e)
    }

    // resolved may be 0|1|2. Treat resolved>=1 as resolved to preserve
    // existing callers that saw 0/1, plus the newly added exhausted state.
    const resolvedValue = r.resolved
    const isResolved =
      resolvedValue === 1 ||
      resolvedValue === true ||
      (typeof resolvedValue === 'number' && resolvedValue >= 1)

    return {
      event_id: r.event_id as string,
      payment_id: r.payment_id as string,
      payment_status: r.payment_status as string,
      order_id: r.order_id as string,
      payload,
      failure_reason: r.failure_reason as string,
      retry_count: r.retry_count as number,
      first_failed_at: r.first_failed_at as string,
      last_attempted_at: r.last_attempted_at as string,
      resolved: isResolved,
      resolved_at: (r.resolved_at as string | undefined) ?? undefined,
    }
  })
}

/** Count unresolved (resolved=0) DLQ entries — used for capacity alerts. */
export async function countUnresolvedDlq(db: D1LikeClient): Promise<number> {
  const { count, error } = await db
    .from(DLQ_TABLE)
    .select('*', { count: 'exact', head: true })
    .eq('resolved', 0)

  if (error || count === null) {
    return 0
  }
  return (count ?? 0) as number
}

/** Count exhausted (resolved=2) DLQ entries — used for rate alerting. */
export async function countExhaustedDlq(db: D1LikeClient): Promise<number> {
  const { count, error } = await db
    .from(DLQ_TABLE)
    .select('*', { count: 'exact', head: true })
    .eq('resolved', 2)

  if (error || count === null) {
    return 0
  }
  return (count ?? 0) as number
}

// ---------------------------------------------------------------------------
// Re-enqueue / reaper helpers
// ---------------------------------------------------------------------------

/**
 * Re-enqueue a DLQ entry (reset retry_count so the IPN handler can attempt
 * again). Skips rows past MAX_DLQ_RETRIES — those are handled by
 * `markDlqExhausted` from the IPN handler rather than re-enqueued forever.
 */
export async function reenqueueDlqEntry(
  db: D1LikeClient,
  eventId: string,
): Promise<boolean> {
  const now = new Date().toISOString()
  const { error, count } = await db
    .from(DLQ_TABLE)
    .update({
      retry_count: 0,
      last_attempted_at: now,
      failure_reason: '',
    })
    .eq('event_id', eventId)
    .eq('resolved', 0)
    .lt('retry_count', MAX_DLQ_RETRIES)

  return !error && (count ?? 0) > 0
}

// ---------------------------------------------------------------------------
// Retention helpers
// ---------------------------------------------------------------------------

/**
 * Fetch resolved (resolved=1) rows older than the retention window so the
 * reaper can delete them.
 */
export async function getOldResolvedDlq(
  db: D1LikeClient,
  maxAgeDays: number,
  limit?: number,
): Promise<DeadLetterEntry[]> {
  const cutoff = new Date(Date.now() - maxAgeDays * 24 * 60 * 60 * 1000).toISOString()

  let query = db
    .from(DLQ_TABLE)
    .select('*')
    .eq('resolved', 1)
    .lt('resolved_at', cutoff)
    .order('resolved_at', { ascending: true })

  if (limit) {
    query = query.limit(limit)
  }

  const { data, error } = await query

  if (error || !data) {
    return []
  }

  return (data as unknown[]).map((row) => {
    const r = row as Record<string, unknown>
    let payload: Record<string, unknown> = {}
    try {
      payload = JSON.parse(r.payload as string) as Record<string, unknown>
    } catch (e) {
      safeCatch('DLQ payload parse')(e)
    }
    return {
      event_id: r.event_id as string,
      payment_id: r.payment_id as string,
      payment_status: r.payment_status as string,
      order_id: r.order_id as string,
      payload,
      failure_reason: r.failure_reason as string,
      retry_count: r.retry_count as number,
      first_failed_at: r.first_failed_at as string,
      last_attempted_at: r.last_attempted_at as string,
      resolved: true,
      resolved_at: (r.resolved_at as string | undefined) ?? undefined,
    }
  })
}

/**
 * Fetch exhausted (resolved=2) rows older than the retention window so the
 * reaper can delete them.
 */
export async function getOldExhaustedDlq(
  db: D1LikeClient,
  maxAgeDays: number,
  limit?: number,
): Promise<DeadLetterEntry[]> {
  const cutoff = new Date(Date.now() - maxAgeDays * 24 * 60 * 60 * 1000).toISOString()

  let query = db
    .from(DLQ_TABLE)
    .select('*')
    .eq('resolved', 2)
    .lt('resolved_at', cutoff)
    .order('resolved_at', { ascending: true })

  if (limit) {
    query = query.limit(limit)
  }

  const { data, error } = await query

  if (error || !data) {
    return []
  }

  return (data as unknown[]).map((row) => {
    const r = row as Record<string, unknown>
    let payload: Record<string, unknown> = {}
    try {
      payload = JSON.parse(r.payload as string) as Record<string, unknown>
    } catch (e) {
      safeCatch('DLQ payload parse')(e)
    }
    return {
      event_id: r.event_id as string,
      payment_id: r.payment_id as string,
      payment_status: r.payment_status as string,
      order_id: r.order_id as string,
      payload,
      failure_reason: r.failure_reason as string,
      retry_count: r.retry_count as number,
      first_failed_at: r.first_failed_at as string,
      last_attempted_at: r.last_attempted_at as string,
      resolved: true,
      resolved_at: (r.resolved_at as string | undefined) ?? undefined,
    }
  })
}

/**
 * Hard-delete DLQ rows whose event IDs are provided. Called by the reaper
 * after a retention batch has been successfully identified.
 */
export async function deleteDlqEntries(
  db: D1LikeClient,
  eventIds: string[],
): Promise<number> {
  if (eventIds.length === 0) return 0

  const { error, count } = await db
    .from(DLQ_TABLE)
    .delete()
    .in('event_id', eventIds)

  if (error) {
    logger.error('[DLQ] deleteDlqEntries failed', { error, count: eventIds.length })
    return 0
  }
  return (count ?? 0) as number
}

// ---------------------------------------------------------------------------
// Health / alerting summary
// ---------------------------------------------------------------------------

export interface DlqHealth {
  unresolvedCount: number
  exhaustedCount: number
  exhaustedRate: number
  warnSize: boolean
  criticalExhaustedRate: boolean
}

export async function getDlqHealth(db: D1LikeClient): Promise<DlqHealth> {
  const [unresolvedCount, exhaustedCount] = await Promise.all([
    countUnresolvedDlq(db),
    countExhaustedDlq(db),
  ])
  const totalResolvedOrExhausted = unresolvedCount + exhaustedCount
  const exhaustedRate =
    totalResolvedOrExhausted === 0 ? 0 : exhaustedCount / totalResolvedOrExhausted

  return {
    unresolvedCount,
    exhaustedCount,
    exhaustedRate,
    warnSize: unresolvedCount > DLQ_WARN_SIZE,
    criticalExhaustedRate: exhaustedRate > EXHAUSTED_WARN_RATE,
  }
}

// ---------------------------------------------------------------------------
// D1-like client surface
// ---------------------------------------------------------------------------

export interface D1LikeClient {
  from(table: string): D1LikeQueryBuilder
}

export interface D1LikeQueryBuilder {
  insert(row: Record<string, unknown>): Promise<{
    error: { code?: string; message?: string; name?: string } | null
  }>
  update(updates: Record<string, unknown>): D1LikeWhereBuilder
  /** Returns builder for chaining (.eq, .lt, .order, .single, etc.). Await the chain end. */
  select(
    columns: string | '*',
    opts?: { count?: string; head?: boolean },
  ): D1LikeWhereBuilder
  delete(): D1LikeWhereBuilder
}

export interface D1LikeWhereBuilder {
  eq(column: string, value: unknown): D1LikeWhereBuilder
  lt(column: string, value: unknown): D1LikeWhereBuilder
  gte(column: string, value: unknown): D1LikeWhereBuilder
  in(column: string, values: unknown[]): D1LikeWhereBuilder
  limit(limit: number): D1LikeWhereBuilder
  order(column: string, opts?: { ascending?: boolean }): D1LikeWhereBuilder
  single(): Promise<{
    data: Record<string, unknown> | null
    error: { code?: string; message?: string; name?: string } | null
  }>
  maybeSingle(): Promise<{
    data: Record<string, unknown> | null
    error: { code?: string; message?: string; name?: string } | null
  }>
  then<T>(
    onfulfilled?: (
      v: {
        data?: Record<string, unknown> | unknown[] | null
        error: { code?: string; message?: string; name?: string } | null
        count?: number | null
      },
    ) => T,
  ): Promise<T>
}

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------

/**
 * DLQ CREATE TABLE statement — run once during schema migration.
 *
 * resolved column values:
 *   0 = unresolved (default)
 *   1 = resolved successfully
 *   2 = exhausted (MAX_DLQ_RETRIES hit, never re-enqueued again)
 */
export const DLQ_SCHEMA = `
  CREATE TABLE IF NOT EXISTS ipn_dead_letter_queue (
    event_id TEXT PRIMARY KEY,
    payment_id TEXT NOT NULL,
    payment_status TEXT NOT NULL,
    order_id TEXT NOT NULL,
    payload TEXT NOT NULL,
    failure_reason TEXT NOT NULL DEFAULT '',
    retry_count INTEGER NOT NULL DEFAULT 0,
    first_failed_at TEXT NOT NULL,
    last_attempted_at TEXT NOT NULL,
    resolved INTEGER NOT NULL DEFAULT 0,
    resolved_at TEXT
  )
`
