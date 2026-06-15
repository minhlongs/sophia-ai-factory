/**
 * audit.ts — Append-only audit log primitive
 * Phase 12: OpenClaw Orchestrator
 *
 * Rules:
 *   - INSERT only — no UPDATE/DELETE ever issued by this module
 *   - tenant_id always required
 *   - actor defaults to 'system'
 */

import { getD1Raw } from '@/seed/db/client';

export interface AuditEntry {
  tenantId: string;
  actor?: string;
  action: string;
  resource?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Append an immutable audit record to audit_log.
 * Never throws — silently swallows D1 errors to avoid breaking caller flows.
 */
export async function audit(entry: AuditEntry): Promise<void> {
  const { tenantId, actor = 'system', action, resource, metadata } = entry;
  const ts = Date.now();
  const metaJson = metadata ? JSON.stringify(metadata) : null;

  try {
    const db = await getD1Raw();
    await db
      .prepare(
        'INSERT INTO audit_log (tenant_id, actor, action, resource, metadata_json, ts) VALUES (?, ?, ?, ?, ?, ?)',
      )
      .bind(tenantId, actor, action, resource ?? null, metaJson, ts)
      .run();
  } catch {
    // Audit failures must not break caller flows
  }
}

/**
 * Query recent audit entries for a tenant. Read-only helper.
 */
export async function queryAuditLog(
  tenantId: string,
  limit = 50,
): Promise<AuditRow[]> {
  const db = await getD1Raw();
  const result = await db
    .prepare(
      'SELECT id, tenant_id, actor, action, resource, metadata_json, ts FROM audit_log WHERE tenant_id = ? ORDER BY ts DESC LIMIT ?',
    )
    .bind(tenantId, limit)
    .all<AuditRow>();
  return result.results ?? [];
}

export interface AuditRow {
  id: number;
  tenant_id: string;
  actor: string;
  action: string;
  resource: string | null;
  metadata_json: string | null;
  ts: number;
}
