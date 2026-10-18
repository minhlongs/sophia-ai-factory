/**
 * Tenant 360 D1 Query Helpers
 *
 * Extracted from tenant-summary.ts to keep modules compact while preserving
 * exact D1 query execution order.
 *
 * @module land/observability/tenant-summary-queries
 */

export interface RawUser {
  id: string;
  email: string;
  name: string | null;
  role: string;
  createdAt: string;
}

export interface RawStorage {
  total_bytes: number;
  video_count: number;
  last_calculated_at: number;
}

export interface RawApiKeys {
  active: number;
  total: number;
}

export interface RawCount {
  n: number;
}

export interface RawAudit {
  id: number;
  action: string;
  resource: string | null;
  ts: number;
}

export async function fetchTenantUserRow(
  db: D1Database,
  tenantId: string
): Promise<RawUser | null> {
  return db
    .prepare(
      `SELECT id, email, name, role, createdAt
       FROM "user" WHERE id = ?1 LIMIT 1`,
    )
    .bind(tenantId)
    .first<RawUser>();
}

export async function fetchTenantSnapshotRows(
  db: D1Database,
  tenantId: string
) {
  return Promise.all([
    db
      .prepare(
        `SELECT total_bytes, video_count, last_calculated_at
         FROM tenant_storage_usage WHERE tenant_id = ?1 LIMIT 1`,
      )
      .bind(tenantId)
      .first<RawStorage>(),
    db
      .prepare(
        `SELECT
           SUM(CASE WHEN is_active = 1 THEN 1 ELSE 0 END) AS active,
           COUNT(*) AS total
         FROM raas_api_keys
         WHERE org_id = ?1`,
      )
      .bind(tenantId)
      .first<RawApiKeys>(),
    db
      .prepare(`SELECT COUNT(*) AS n FROM video_jobs WHERE tenant_id = ?1`)
      .bind(tenantId)
      .first<RawCount>(),
    db
      .prepare(`SELECT COUNT(*) AS n FROM referral_codes WHERE user_id = ?1`)
      .bind(tenantId)
      .first<RawCount>(),
    db
      .prepare(`SELECT COUNT(*) AS n FROM audit_log WHERE tenant_id = ?1`)
      .bind(tenantId)
      .first<RawCount>(),
    db
      .prepare(
        `SELECT id, action, resource, ts
         FROM audit_log
         WHERE tenant_id = ?1
         ORDER BY ts DESC
         LIMIT 10`,
      )
      .bind(tenantId)
      .all<RawAudit>(),
  ]);
}
