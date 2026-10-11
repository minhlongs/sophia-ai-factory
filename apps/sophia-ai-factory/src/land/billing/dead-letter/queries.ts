/**
 * DLQ Query and Reconciliation Operations
 * Layer: land/billing/dead-letter
 */

import { safeCatch } from '@/seed/utils/safe-catch'
import { DLQ_TABLE, type D1LikeClient, type DeadLetterEntry } from './types'

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
    } catch (e) {
      safeCatch('DLQ payload parse')(e);
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
