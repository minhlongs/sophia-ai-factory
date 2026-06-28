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

import { getD1Raw } from '@/seed/db/client';

export type OutboxStatus = 'pending' | 'sent' | 'failed';

export interface OutboxStatusCount {
  status: OutboxStatus;
  count: number;
}

export interface OutboxRecentRow {
  id: string;
  paymentId: string;
  toEmail: string;
  template: string;
  status: OutboxStatus;
  attempts: number;
  /** Unix seconds. */
  createdAt: number;
  /** Unix seconds, null when status != 'sent'. */
  sentAt: number | null;
  lastError: string | null;
}

export interface OutboxSnapshot {
  totals: OutboxStatusCount[];
  /** Pending rows whose next_retry_at is in the past (work to do now). */
  pendingDue: number;
  /** Pending rows scheduled for the future (back-off). */
  pendingFuture: number;
  /** 10 most recent failures, newest first. */
  recentFailures: OutboxRecentRow[];
  /** 10 most recent successful sends. */
  recentSends: OutboxRecentRow[];
}

interface RawCount { status: string; n: number }
interface RawRecent {
  id: string;
  payment_id: string;
  to_email: string;
  template: string;
  status: string;
  attempts: number;
  created_at: number;
  sent_at: number | null;
  last_error: string | null;
}

function mapRecent(r: RawRecent): OutboxRecentRow {
  return {
    id: r.id,
    paymentId: r.payment_id,
    toEmail: r.to_email,
    template: r.template,
    status: (r.status as OutboxStatus) ?? 'pending',
    attempts: Number(r.attempts ?? 0),
    createdAt: Number(r.created_at),
    sentAt: r.sent_at !== null ? Number(r.sent_at) : null,
    lastError: r.last_error,
  };
}

/** Aggregate snapshot of the email outbox. */
export async function getEmailOutboxSnapshot(): Promise<OutboxSnapshot> {
  const db = await getD1Raw();
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
