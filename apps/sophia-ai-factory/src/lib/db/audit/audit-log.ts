/**
 * Audit log helper — append-only trail for tier-changing table mutations.
 *
 * Works with both raw D1Database AND D1Client (via from() chain).
 * Writes are fire-and-forget; failures are non-fatal (logged only).
 *
 * @module lib/db/audit/audit-log
 */

import { z } from 'zod'
import { logger } from '@/lib/utils/logger-utility'
import { getErrorMessage } from '@/lib/utils/to-error'

// ── Types ─────────────────────────────────────────────────────────────────────

export const AuditActionSchema = z.enum(['insert', 'update', 'delete'])
export type AuditAction = z.infer<typeof AuditActionSchema>

/** Tier enum guard — app-layer constraint (DB CHECK not supported via ALTER in SQLite). */
export const TierEnum = z.enum(['BASIC', 'PREMIUM', 'ENTERPRISE', 'MASTER'])
export type TierValue = z.infer<typeof TierEnum>

export interface AuditParams {
  tableName: string
  rowId: string
  action: AuditAction
  actorId?: string
  before?: Record<string, unknown>
  after?: Record<string, unknown>
}

export interface AuditRow {
  id: number
  table_name: string
  row_id: string
  action: AuditAction
  actor_id: string | null
  before_json: string | null
  after_json: string | null
  created_at: number
}

// ── Core functions ─────────────────────────────────────────────────────────────

/**
 * Append one audit record to the audit_log table.
 * Accepts raw D1Database binding directly.
 * Silently no-ops on binding unavailability (non-CF environments).
 */
export async function recordAudit(db: D1Database, params: AuditParams): Promise<void> {
  const parsed = AuditActionSchema.safeParse(params.action)
  if (!parsed.success) {
    logger.warn('[audit] invalid action — skipping', { action: params.action })
    return
  }

  const beforeJson = params.before != null ? JSON.stringify(params.before) : null
  const afterJson  = params.after  != null ? JSON.stringify(params.after)  : null

  try {
    await db
      .prepare(
        `INSERT INTO audit_log (table_name, row_id, action, actor_id, before_json, after_json)
         VALUES (?, ?, ?, ?, ?, ?)`,
      )
      .bind(params.tableName, params.rowId, params.action, params.actorId ?? null, beforeJson, afterJson)
      .run()
  } catch (err) {
    // Non-fatal — audit failure must never block the primary mutation path
    logger.warn('[audit] recordAudit failed', { error: getErrorMessage(err), ...params })
  }
}

/**
 * Fetch the audit trail for a specific row, newest-first.
 *
 * @param db        Raw D1Database binding
 * @param tableName Table name to query
 * @param rowId     Row identifier (primary key cast as string)
 * @param limit     Max rows to return (default 50)
 */
export async function queryAuditTrail(
  db: D1Database,
  tableName: string,
  rowId: string,
  limit = 50,
): Promise<AuditRow[]> {
  try {
    const result = await db
      .prepare(
        `SELECT id, table_name, row_id, action, actor_id, before_json, after_json, created_at
         FROM audit_log
         WHERE table_name = ? AND row_id = ?
         ORDER BY created_at DESC
         LIMIT ?`,
      )
      .bind(tableName, rowId, limit)
      .all<AuditRow>()

    return result.results ?? []
  } catch (err) {
    logger.warn('[audit] queryAuditTrail failed', { error: getErrorMessage(err), tableName, rowId })
    return []
  }
}
