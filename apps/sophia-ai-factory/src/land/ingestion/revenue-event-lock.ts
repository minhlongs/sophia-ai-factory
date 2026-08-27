/**
 * Atomic exactly-once lock for revenue event ingestion.
 *
 * Reuses the payment_events lock table (migration 0002) with event_type
 * 'revenue.recorded' — same INSERT ... ON CONFLICT(event_id) DO NOTHING
 * pattern as overage-topup.ts and commission-ledger-mutations.ts.
 * meta.changes === 1 proves this caller owns the lock; on conflict the
 * existing row decides already-processed vs stale-recoverable vs in-flight.
 *
 * Stale locks (unprocessed, older than 5 min) are recovered best-effort:
 * marked processed so a crashed run cannot block redelivery forever.
 *
 * @module land/ingestion/revenue-event-lock
 */
import { getD1 } from '@/seed/db/client';
import { logger } from '@/seed/utils/logger-utility';
import { toError } from '@/seed/utils/to-error';

/** Stale-lock threshold: unprocessed locks older than this are recovered. */
const STALE_LOCK_MS = 5 * 60 * 1000;

export type RevenueLockState =
  | { kind: 'acquired' }
  | { kind: 'already-processed' }
  | { kind: 'stale-recovered' }
  | { kind: 'in-flight' }
  | { kind: 'db-unavailable' }
  | { kind: 'query-failed' };

/**
 * Acquire the exactly-once lock for a revenue event id.
 * Single INSERT determines ownership — no INSERT-then-SELECT race window.
 */
export async function acquireRevenueEventLock(
  eventId: string,
  payloadJson: string,
): Promise<RevenueLockState> {
  const db = await getD1();
  if (!db) {
    logger.error('[revenue-event-lock] D1 binding not available', { eventId });
    return { kind: 'db-unavailable' };
  }

  const now = new Date().toISOString();
  try {
    const lockResult = await db
      .prepare(
        `INSERT INTO payment_events (event_id, event_type, payload, processed, created_at)
         VALUES (?1, 'revenue.recorded', ?2, 0, ?3)
         ON CONFLICT(event_id) DO NOTHING`,
      )
      .bind(eventId, payloadJson, now)
      .run();

    if ((lockResult.meta?.changes ?? 0) > 0) return { kind: 'acquired' };

    const existing = await db
      .prepare('SELECT processed, created_at FROM payment_events WHERE event_id = ?1')
      .bind(eventId)
      .first<{ processed: number | boolean; created_at: string | null }>();

    if (!existing) return { kind: 'query-failed' };
    if (Number(existing.processed) === 1) return { kind: 'already-processed' };

    const lockAgeMs = Date.now() - new Date(existing.created_at ?? now).getTime();
    if (lockAgeMs > STALE_LOCK_MS) {
      logger.warn('[revenue-event-lock] Stale lock recovered', { eventId, lockAgeMs });
      try {
        await db
          .prepare('UPDATE payment_events SET processed = 1 WHERE event_id = ?1')
          .bind(eventId)
          .run();
      } catch {
        // Best-effort: stale-lock marking is non-fatal.
      }
      return { kind: 'stale-recovered' };
    }

    return { kind: 'in-flight' };
  } catch (err) {
    logger.error('[revenue-event-lock] Lock acquire failed', toError(err), { eventId });
    return { kind: 'query-failed' };
  }
}

/** Mark the lock row processed after a successful write. Best-effort. */
export async function markRevenueLockProcessed(eventId: string): Promise<void> {
  const db = await getD1();
  if (!db) return;
  try {
    await db
      .prepare('UPDATE payment_events SET processed = 1 WHERE event_id = ?1')
      .bind(eventId)
      .run();
  } catch (err) {
    logger.error('[revenue-event-lock] markProcessed failed', toError(err), { eventId });
  }
}
