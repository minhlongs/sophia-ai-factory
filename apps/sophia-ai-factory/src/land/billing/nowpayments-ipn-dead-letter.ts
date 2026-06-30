/**
 * NOWPayments IPN Dead-Letter Queue (DLQ)
 *
 * Captures IPN events that failed permanently after retry attempts.
 * Uses Supabase D1 client (from()/insert()/update() style — consistent with rest of billing).
 *
 * Features:
 * - UNIQUE(event_id) prevents duplicate DLQ entries
 * - Max 3 retry attempts before enqueueing
 * - Admin reconciliation via `getStaleDlqEntries` (entries older than N hours)
 * - Re-enqueue via `reenqueueDlqEntry` (resets attempt count)
 *
 * @module billing/nowpayments-ipn-dead-letter
 */

import { safeCatch } from '@/seed/utils/safe-catch'
import { logger } from '@/seed/utils/logger-utility'
import { success, failure, type Result } from '@/seed/types/result'
import { DLQError } from './nowpayments-ipn-errors'

/**
 * DLQ entry — mirrors the subset of ipn_dead_letter_queue we need for recovery.
 */
export interface DeadLetterEntry {
  event_id: string;
  payment_id: string;
  payment_status: string;
  order_id: string;
  payload: Record<string, unknown>;
  failure_reason: string;
  retry_count: number;
  first_failed_at: string; // ISO-8601
  last_attempted_at: string; // ISO-8601
  resolved: boolean;
  resolved_at?: string;
}

/**
 * Options for enqueuing a DLQ entry.
 */
export interface EnqueueDlqOptions {
  eventId: string;
  paymentId: string;
  paymentStatus: string;
  orderId: string;
  payload: Record<string, unknown>;
  failureReason: string;
  retryCount: number;
}

const DLQ_TABLE = 'ipn_dead_letter_queue';

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
    const now = new Date().toISOString();
    const payloadJson = JSON.stringify(opts.payload);

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
      });

    if (insertError) {
      // UNIQUE violation on event_id — update existing row
      const isUniqueViolation =
        typeof insertError === 'object' &&
        insertError !== null &&
        'code' in insertError &&
        (insertError as { code?: string }).code === '23505';

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
          .eq('resolved', 0);
      } else {
        // Non-unique, non-string error — log and fail rather than silently swallowing
        logger.error('[DLQ] Insert failed with unexpected error', {
          eventId: opts.eventId,
          error: insertError,
        })
        return failure(new DLQError('ENQUEUE_DLQ_FAILED', insertError))
      }
    }

    return success(undefined);
  } catch (err) {
    return failure(new DLQError('ENQUEUE_DLQ_FAILED', err));
  }
}

/**
 * Mark a DLQ entry as resolved.
 */
export async function resolveDlqEntry(
  db: D1LikeClient,
  eventId: string,
): Promise<void> {
  const now = new Date().toISOString();
  await db
    .from(DLQ_TABLE)
    .update({ resolved: 1, resolved_at: now })
    .eq('event_id', eventId);
}

/**
 * Fetch unresolved DLQ entries stale beyond the given age in hours.
 * Useful for nightly reconciliation batch jobs.
 */
export async function getStaleDlqEntries(
  db: D1LikeClient,
  maxAgeHours: number = 24,
  limit?: number,
): Promise<DeadLetterEntry[]> {
  const cutoff = new Date(Date.now() - maxAgeHours * 60 * 60 * 1000).toISOString();

  let query = db
    .from(DLQ_TABLE)
    .select('*')
    .eq('resolved', 0)
    .lt('last_attempted_at', cutoff)
    .order('first_failed_at', { ascending: true });

  if (limit) {
    query = query.limit(limit);
  }

  const { data, error } = await query;

  if (error || !data) {
    return [];
  }

  return (data as unknown[]).map((row) => {
    const r = row as Record<string, unknown>;
    let payload: Record<string, unknown> = {};
    try {
      payload = JSON.parse(r.payload as string) as Record<string, unknown>;
    } catch (e) { safeCatch('DLQ payload parse')(e) }
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
      resolved: r.resolved === 1 || r.resolved === true,
      resolved_at: (r.resolved_at as string | undefined) ?? undefined,
    };
  });
}

/**
 * Count unresolved DLQ entries (for monitoring / alerting).
 */
export async function countUnresolvedDlq(db: D1LikeClient): Promise<number> {
  const { count, error } = await db
    .from(DLQ_TABLE)
    .select('*', { count: 'exact', head: true })
    .eq('resolved', 0);

  if (error || count === null) {
    return 0;
  }
  return (count ?? 0) as number;
}

/**
 * Re-enqueue a DLQ entry (reset retry_count so the IPN handler can attempt again).
 */
export async function reenqueueDlqEntry(
  db: D1LikeClient,
  eventId: string,
): Promise<boolean> {
  const now = new Date().toISOString();
  const { error, count } = await db
    .from(DLQ_TABLE)
    .update({
      retry_count: 0,
      last_attempted_at: now,
      failure_reason: '',
    })
    .eq('event_id', eventId)
    .eq('resolved', 0);

  return !error && (count ?? 0) > 0;
}

/**
 * Minimal D1-like client interface used by DLQ functions.
 * Matches the Supabase client returned by createServerClient().
 */
export interface D1LikeClient {
  from(table: string): D1LikeQueryBuilder;
}

export interface D1LikeQueryBuilder {
  insert(row: Record<string, unknown>): Promise<{ error: { code?: string; message?: string; name?: string } | null }>;
  update(updates: Record<string, unknown>): D1LikeWhereBuilder;
  /** Returns builder for chaining (.eq, .lt, .order, .single, etc.). Await the chain end. */
  select(columns: string | '*', opts?: { count?: string; head?: boolean }): D1LikeWhereBuilder;
  delete(): D1LikeWhereBuilder;
}

export interface D1LikeWhereBuilder {
  eq(column: string, value: unknown): D1LikeWhereBuilder;
  lt(column: string, value: unknown): D1LikeWhereBuilder;
  gte(column: string, value: unknown): D1LikeWhereBuilder;
  limit(limit: number): D1LikeWhereBuilder;
  order(column: string, opts?: { ascending?: boolean }): D1LikeWhereBuilder;
  single(): Promise<{ data: Record<string, unknown> | null; error: { code?: string; message?: string; name?: string } | null }>;
  then<T>(onfulfilled?: (v: { data?: Record<string, unknown> | unknown[] | null; error: { code?: string; message?: string; name?: string } | null; count?: number | null }) => T): Promise<T>;
}

/**
 * DLQ CREATE TABLE statement — run once during schema migration.
 */
export const DLQ_SCHEMA = `
CREATE TABLE IF NOT EXISTS ipn_dead_letter_queue (
  event_id          TEXT PRIMARY KEY,
  payment_id        TEXT NOT NULL,
  payment_status    TEXT NOT NULL,
  order_id          TEXT NOT NULL,
  payload           TEXT NOT NULL,
  failure_reason    TEXT NOT NULL DEFAULT '',
  retry_count       INTEGER NOT NULL DEFAULT 0,
  first_failed_at   TEXT NOT NULL,
  last_attempted_at TEXT NOT NULL,
  resolved          INTEGER NOT NULL DEFAULT 0,
  resolved_at       TEXT
)
`;
