/**
 * Tenant 360 — one-shot snapshot across all admin-relevant tables.
 *
 * Used by /dashboard/admin/tenant-lookup. For Sophia's single-tenant model
 * `tenantId === user.id`, so this primitive looks up `"user"` directly. Returns
 * null when the user row is missing (caller renders "not found").
 *
 * @module land/observability/tenant-summary
 */

import { getD1 } from '@/seed/db/client';

export interface TenantUserInfo {
  id: string;
  email: string;
  name: string | null;
  role: string;
  createdAt: string;
}

export interface TenantStorageInfo {
  totalBytes: number;
  videoCount: number;
  lastCalculatedAt: number;
}

export interface TenantApiKeyCounts {
  active: number;
  total: number;
}

export interface TenantRecentAudit {
  id: number;
  action: string;
  resource: string | null;
  ts: number;
}

export interface TenantSummary {
  user: TenantUserInfo;
  storage: TenantStorageInfo | null;
  apiKeys: TenantApiKeyCounts;
  /** Total `video_jobs` rows for this tenant. */
  videoJobCount: number;
  /** Total referral codes registered for this user. */
  referralCodeCount: number;
  /** Total `audit_log` entries scoped to this tenant. */
  auditLogCount: number;
  recentAudit: TenantRecentAudit[];
}

interface RawUser {
  id: string;
  email: string;
  name: string | null;
  role: string;
  createdAt: string;
}
interface RawStorage {
  total_bytes: number;
  video_count: number;
  last_calculated_at: number;
}
interface RawApiKeys {
  active: number;
  total: number;
}
interface RawCount { n: number }
interface RawAudit {
  id: number;
  action: string;
  resource: string | null;
  ts: number;
}

/**
 * Build the cross-table summary for one tenant. Returns null if user not found.
 */
export async function getTenantSummary(tenantId: string): Promise<TenantSummary | null> {
  if (!tenantId) return null;
  const db = getD1();
  if (!db) throw new Error('D1 database binding not available');

  const user = await db
    .prepare(
      `SELECT id, email, name, role, createdAt
       FROM "user" WHERE id = ?1 LIMIT 1`,
    )
    .bind(tenantId)
    .first<RawUser>();
  if (!user) return null;

  const [
    storageRow,
    apiKeyRow,
    videoJobRow,
    referralRow,
    auditCountRow,
    recentAuditRes,
  ] = await Promise.all([
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

  return {
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      createdAt: user.createdAt,
    },
    storage: storageRow
      ? {
          totalBytes: Number(storageRow.total_bytes),
          videoCount: Number(storageRow.video_count),
          lastCalculatedAt: Number(storageRow.last_calculated_at),
        }
      : null,
    apiKeys: {
      active: Number(apiKeyRow?.active ?? 0),
      total: Number(apiKeyRow?.total ?? 0),
    },
    videoJobCount: Number(videoJobRow?.n ?? 0),
    referralCodeCount: Number(referralRow?.n ?? 0),
    auditLogCount: Number(auditCountRow?.n ?? 0),
    recentAudit: (recentAuditRes.results ?? []).map((r) => ({
      id: Number(r.id),
      action: r.action,
      resource: r.resource,
      ts: Number(r.ts),
    })),
  };
}
