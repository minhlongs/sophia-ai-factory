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
