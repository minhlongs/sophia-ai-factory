/**
 * Email outbox observability types and row mapping helper.
 *
 * @module land/observability/email-outbox-stats-types
 */

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

export interface RawCount {
  status: string;
  n: number;
}

export interface RawRecent {
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

export function mapRecent(r: RawRecent): OutboxRecentRow {
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
