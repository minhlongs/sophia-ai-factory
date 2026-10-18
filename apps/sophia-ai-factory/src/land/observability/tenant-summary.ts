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
import {
  fetchTenantSnapshotRows,
  fetchTenantUserRow,
} from './tenant-summary-queries';

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

/**
 * Build the cross-table summary for one tenant. Returns null if user not found.
 */
export async function getTenantSummary(tenantId: string): Promise<TenantSummary | null> {
  if (!tenantId) return null;
  const db = await getD1();
  if (!db) throw new Error('D1 database binding not available');

  const user = await fetchTenantUserRow(db, tenantId);
  if (!user) return null;

  const [
    storageRow,
    apiKeyRow,
    videoJobRow,
    referralRow,
    auditCountRow,
    recentAuditRes,
  ] = await fetchTenantSnapshotRows(db, tenantId);

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
