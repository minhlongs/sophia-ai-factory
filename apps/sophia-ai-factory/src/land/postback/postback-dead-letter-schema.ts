/**
 * Postback Dead-Letter Queue (DLQ) Schema & Row Mapping
 *
 * Layer: land/postback (Business Workflow)
 * @module land/postback/postback-dead-letter-schema
 */

export interface PostbackDlqEntry {
  id: string
  network: string
  endpoint: string
  source_ip: string | null
  headers_json: string
  payload: string
  failure_reason: string
  tenant_hint: string | null
  retry_count: number
  resolved: boolean
  resolved_at?: string
  created_at: string
  last_attempted_at: string
}

export function mapPostbackDlqRow(r: Record<string, unknown>): PostbackDlqEntry {
  return {
    id: r.id as string,
    network: r.network as string,
    endpoint: r.endpoint as string,
    source_ip: (r.source_ip as string | null) ?? null,
    headers_json: (r.headers_json as string) ?? '{}',
    payload: (r.payload as string) ?? '',
    failure_reason: r.failure_reason as string,
    tenant_hint: (r.tenant_hint as string | null) ?? null,
    retry_count: (r.retry_count as number) ?? 0,
    resolved: (r.resolved as number) === 1,
    resolved_at: (r.resolved_at as string | undefined) ?? undefined,
    created_at: r.created_at as string,
    last_attempted_at: r.last_attempted_at as string,
  }
}

export const POSTBACK_DLQ_SCHEMA = `
CREATE TABLE IF NOT EXISTS postback_dead_letter (
  id TEXT PRIMARY KEY,
  network TEXT NOT NULL,
  endpoint TEXT NOT NULL,
  source_ip TEXT,
  headers_json TEXT NOT NULL DEFAULT '{}',
  payload TEXT NOT NULL DEFAULT '',
  failure_reason TEXT NOT NULL,
  tenant_hint TEXT,
  retry_count INTEGER NOT NULL DEFAULT 0,
  resolved INTEGER NOT NULL DEFAULT 0,
  resolved_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_attempted_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
)
`

export const INSERT_POSTBACK_DLQ_SQL = `INSERT INTO postback_dead_letter
  (id, network, endpoint, source_ip, headers_json, payload,
   failure_reason, tenant_hint, retry_count, resolved, created_at, last_attempted_at)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)
  ON CONFLICT(id) DO UPDATE SET
    retry_count = retry_count + 1,
    failure_reason = excluded.failure_reason,
    last_attempted_at = excluded.last_attempted_at`

/**
 * Dead-letter rows are tenant-owned. Every read and resolve carries the
 * tenant scope so one workspace can never see or close another's evidence.
 * Rows captured before a tenant could be verified carry a NULL hint and are
 * therefore invisible here by construction.
 */
export const SELECT_UNRESOLVED_POSTBACK_DLQ_SQL = `SELECT * FROM postback_dead_letter
  WHERE resolved = 0 AND tenant_hint = ?
  ORDER BY created_at ASC
  LIMIT ?`

export const SELECT_POSTBACK_DLQ_COUNTS_SQL = `SELECT
    network,
    COUNT(*) AS total,
    SUM(CASE WHEN resolved = 0 THEN 1 ELSE 0 END) AS unresolved
  FROM postback_dead_letter
  WHERE tenant_hint = ?
  GROUP BY network`

export const RESOLVE_POSTBACK_DLQ_SQL = `UPDATE postback_dead_letter
  SET resolved = 1, resolved_at = ?
  WHERE id = ? AND tenant_hint = ?`

export interface RawD1QueryHandle {
  prepare: (sql: string) => {
    bind: (...args: unknown[]) => {
      all: <T>() => Promise<{ results: T[] }>
    }
    all: <T>() => Promise<{ results: T[] }>
  }
}
