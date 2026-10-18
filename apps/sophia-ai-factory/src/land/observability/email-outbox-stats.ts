/**
 * Email outbox observability — queue depth + failure rate + recent activity.
 *
 * Reads `welcome_email_outbox` (migration 0073) which stores every email queued
 * by `enqueueWelcomeEmail`. The flusher transitions rows pending → sent | failed.
 *
 * Used by the admin monitor page to spot stuck queues, retry storms, or template
 * regressions.
 *
 * @module land/observability/email-outbox-stats
 */

import { getD1 } from '@/seed/db/client';
import {
  mapRecent,
  type OutboxStatus,
  type OutboxStatusCount,
  type OutboxRecentRow,
  type OutboxSnapshot,
  type RawCount,
  type RawRecent,
} from './email-outbox-stats-types';

export type {
  OutboxStatus,
  OutboxStatusCount,
  OutboxRecentRow,
  OutboxSnapshot,
} from './email-outbox-stats-types';

/** Aggregate snapshot of the email outbox. */
export async function getEmailOutboxSnapshot(): Promise<OutboxSnapshot> {
  const db = await getD1();
  if (!db) throw new Error('D1 database binding not available');
  const nowSec = Math.floor(Date.now() / 1000);

  const [totalsRes, dueRow, futureRow, failuresRes, sendsRes] = await Promise.all([
    db
      .prepare(
        `SELECT status, COUNT(*) AS n
         FROM welcome_email_outbox
         GROUP BY status`,
      )
      .all<RawCount>(),
    db
      .prepare(
        `SELECT COUNT(*) AS n
         FROM welcome_email_outbox
         WHERE status='pending' AND next_retry_at <= ?1`,
      )
      .bind(nowSec)
      .first<{ n: number }>(),
    db
      .prepare(
        `SELECT COUNT(*) AS n
         FROM welcome_email_outbox
         WHERE status='pending' AND next_retry_at > ?1`,
      )
      .bind(nowSec)
      .first<{ n: number }>(),
    db
      .prepare(
        `SELECT id, payment_id, to_email, template, status, attempts,
                created_at, sent_at, last_error
         FROM welcome_email_outbox
         WHERE status='failed'
         ORDER BY created_at DESC
         LIMIT 10`,
      )
      .all<RawRecent>(),
    db
      .prepare(
        `SELECT id, payment_id, to_email, template, status, attempts,
                created_at, sent_at, last_error
         FROM welcome_email_outbox
         WHERE status='sent'
         ORDER BY sent_at DESC
         LIMIT 10`,
      )
      .all<RawRecent>(),
  ]);

  const totals: OutboxStatusCount[] = (totalsRes.results ?? []).map((r) => ({
    status: (r.status as OutboxStatus) ?? 'pending',
    count: Number(r.n),
  }));

  return {
    totals,
    pendingDue: Number(dueRow?.n ?? 0),
    pendingFuture: Number(futureRow?.n ?? 0),
    recentFailures: (failuresRes.results ?? []).map(mapRecent),
    recentSends: (sendsRes.results ?? []).map(mapRecent),
  };
}
