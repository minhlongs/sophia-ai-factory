/**
 * NOWPayments IPN Dead-Letter Queue Types
 * Layer: land/billing/dead-letter
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

export interface EnqueueDlqOptions {
  eventId: string;
  paymentId: string;
  paymentStatus: string;
  orderId: string;
  payload: Record<string, unknown>;
  failureReason: string;
  retryCount: number;
}

export const DLQ_TABLE = 'ipn_dead_letter_queue';

export interface D1LikeClient {
  from(table: string): D1LikeQueryBuilder;
}

export interface D1LikeQueryBuilder {
  insert(row: Record<string, unknown>): Promise<{ error: { code?: string; message?: string; name?: string } | null }>;
  update(updates: Record<string, unknown>): D1LikeWhereBuilder;
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
