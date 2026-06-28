/**
 * R2 storage usage observability.
 *
 * Reads `tenant_storage_usage` (one row per tenant; updated by recalc job).
 * Surfaces global totals + top consumers + stale-recalc count so an admin
 * can spot tenants approaching quota and rows that haven't been recomputed
 * recently.
 *
 * @module land/observability/storage-usage-stats
 */

import { getD1 } from '@/seed/db/client';

export interface StorageGlobalSummary {
  /** Number of tenant rows in the usage table. */
  tenantCount: number;
  /** SUM(total_bytes) across all tenants. */
  totalBytes: number;
  /** SUM(video_count). */
  totalVideos: number;
  /** Tenants whose `last_calculated_at` is older than `staleAfterSec`. */
  staleTenantCount: number;
}

export interface TenantStorageRow {
  tenantId: string;
  totalBytes: number;
  videoCount: number;
  lastCalculatedAt: number;
  /** Seconds since last_calculated_at (computed at call time). */
  ageSec: number;
}

export interface StorageSnapshot {
  global: StorageGlobalSummary;
  topTenants: TenantStorageRow[];
}

interface RawTenantRow {
  tenant_id: string;
  total_bytes: number;
  video_count: number;
  last_calculated_at: number;
}

interface RawSummary {
  tenant_count: number;
  total_bytes: number;
  total_videos: number;
  stale_count: number;
}

/** Default stale threshold = 24h (matches typical recalc cadence). */
export const STALE_AFTER_SEC = 24 * 3600;

/**
 * Snapshot: global summary + top-N tenants by `total_bytes`.
 * `limit` clamped to [1, 100].
 */
export async function getStorageSnapshot(
  limit: number,
  staleAfterSec: number = STALE_AFTER_SEC,
): Promise<StorageSnapshot> {
  const safeLimit = Math.max(1, Math.min(100, Math.floor(limit)));
  const nowSec = Math.floor(Date.now() / 1000);
  const staleCutoff = nowSec - staleAfterSec;
  const db = getD1();
  if (!db) throw new Error('D1 database binding not available');

  const [summaryRow, topRes] = await Promise.all([
    db
      .prepare(
        `SELECT
           COUNT(*) AS tenant_count,
           COALESCE(SUM(total_bytes), 0) AS total_bytes,
           COALESCE(SUM(video_count), 0) AS total_videos,
           SUM(CASE WHEN last_calculated_at < ?1 THEN 1 ELSE 0 END) AS stale_count
         FROM tenant_storage_usage`,
      )
      .bind(staleCutoff)
      .first<RawSummary>(),
    db
      .prepare(
        `SELECT tenant_id, total_bytes, video_count, last_calculated_at
         FROM tenant_storage_usage
         ORDER BY total_bytes DESC
         LIMIT ?1`,
      )
      .bind(safeLimit)
      .all<RawTenantRow>(),
  ]);

  const global: StorageGlobalSummary = {
    tenantCount: Number(summaryRow?.tenant_count ?? 0),
    totalBytes: Number(summaryRow?.total_bytes ?? 0),
    totalVideos: Number(summaryRow?.total_videos ?? 0),
    staleTenantCount: Number(summaryRow?.stale_count ?? 0),
  };

  const topTenants: TenantStorageRow[] = (topRes.results ?? []).map((r) => {
    const lastCalc = Number(r.last_calculated_at);
    return {
      tenantId: r.tenant_id,
      totalBytes: Number(r.total_bytes),
      videoCount: Number(r.video_count),
      lastCalculatedAt: lastCalc,
      ageSec: nowSec - lastCalc,
    };
  });

  return { global, topTenants };
}
