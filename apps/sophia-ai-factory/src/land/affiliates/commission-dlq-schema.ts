/**
 * Commission Dead-Letter Queue (DLQ) Schema & Row Mapping
 *
 * @module affiliates/commission-dlq-schema
 */

export interface CommissionDlqEntry {
  event_id: string
  receipt: string
  transaction_type: string
  amount: number
  payload: string
  failure_reason: string
  retry_count: number
  first_failed_at: string
  last_attempted_at: string
  resolved: boolean
  resolved_at?: string
}

export function mapCommissionDlqRow(r: Record<string, unknown>): CommissionDlqEntry {
  return {
    event_id: r.event_id as string,
    receipt: r.receipt as string,
    transaction_type: r.transaction_type as string,
    amount: r.amount as number,
    payload: r.payload as string,
    failure_reason: r.failure_reason as string,
    retry_count: r.retry_count as number,
    first_failed_at: r.first_failed_at as string,
    last_attempted_at: r.last_attempted_at as string,
    resolved: (r.resolved as number) === 1,
    resolved_at: (r.resolved_at as string | undefined) ?? undefined,
  }
}

/**
 * DLQ CREATE TABLE statement — run as migration.
 */
export const COMMISSION_DLQ_SCHEMA = `
CREATE TABLE IF NOT EXISTS commission_dead_letter (
  event_id          TEXT PRIMARY KEY,
  receipt           TEXT NOT NULL,
  transaction_type  TEXT NOT NULL,
  amount            REAL NOT NULL,
  payload           TEXT NOT NULL DEFAULT '',
  failure_reason    TEXT NOT NULL DEFAULT '',
  retry_count       INTEGER NOT NULL DEFAULT 0,
  first_failed_at   TEXT NOT NULL,
  last_attempted_at TEXT NOT NULL,
  resolved          INTEGER NOT NULL DEFAULT 0,
  resolved_at       TEXT
)
`

export const UPSERT_COMMISSION_DLQ_SQL = `INSERT INTO commission_dead_letter
  (event_id, receipt, transaction_type, amount, payload,
   failure_reason, retry_count, first_failed_at, last_attempted_at, resolved)
  VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, 0)
  ON CONFLICT(event_id) DO UPDATE SET
    retry_count = retry_count + 1,
    failure_reason = ?6,
    last_attempted_at = ?9`

export const SELECT_STALE_COMMISSION_DLQ_SQL = `SELECT * FROM commission_dead_letter
  WHERE resolved = 0 AND last_attempted_at < ?1
  ORDER BY first_failed_at ASC
  LIMIT ?2`

export const RESOLVE_COMMISSION_DLQ_SQL = `UPDATE commission_dead_letter
  SET resolved = 1, resolved_at = ?1
  WHERE event_id = ?2`

export interface RawD1QueryHandle {
  prepare: (sql: string) => {
    bind: (...args: unknown[]) => {
      all: <T>() => Promise<{ results: T[] }>
    }
  }
}
