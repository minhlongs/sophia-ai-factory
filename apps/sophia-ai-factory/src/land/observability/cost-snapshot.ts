/**
 * Cost dashboard primitive.
 *
 * Joins `video_cost_log` with `video_jobs` (for tenant attribution) and slices
 * the result four ways:
 *   1. Global totals (cost, units, line count)
 *   2. By stage (script, tts, visual, etc.)
 *   3. By provider (which vendor are we burning $ on)
 *   4. Top tenants by cost — the consumers driving the bill
 *
 * Used by /dashboard/admin/cost.
 *
 * @module land/observability/cost-snapshot
 */

import { getD1 } from '@/seed/db/client';

export interface CostGlobalSummary {
  totalCostUsd: number;
  totalUnits: number;
  lineCount: number;
  jobCount: number;
}

export interface CostBucketRow {
  /** Stage or provider name. */
  bucket: string;
  costUsd: number;
  units: number;
  lineCount: number;
}

export interface CostTenantRow {
  tenantId: string;
  costUsd: number;
  lineCount: number;
  jobCount: number;
}

export interface CostSnapshot {
  fromTs: number;
  toTs: number;
  global: CostGlobalSummary;
  byStage: CostBucketRow[];
  byProvider: CostBucketRow[];
  topTenants: CostTenantRow[];
  /**
   * Monthly projection extrapolated from `totalCostUsd` over the window
   * length. Caller can choose whether to display it (defaults to 30-day
   * runway when window is exactly 30 days).
   */
  monthlyProjectionUsd: number;
}

interface RawGlobal {
  total_cost: number;
  total_units: number;
  line_count: number;
  job_count: number;
}
interface RawBucket {
  bucket: string;
  cost: number;
  units: number;
  n: number;
}
interface RawTenant {
  tenant_id: string;
  cost: number;
  line_count: number;
  job_count: number;
}

/** Compute the cost snapshot over the window. `limit` clamped to [1, 100]. */
export async function getCostSnapshot(
  fromTs: number,
  toTs: number,
  limit: number = 25,
): Promise<CostSnapshot> {
  if (fromTs > toTs) throw new Error('fromTs must be <= toTs');
  const safeLimit = Math.max(1, Math.min(100, Math.floor(limit)));
  const db = getD1();
  if (!db) throw new Error('D1 database binding not available');

  // Window filter shared by all queries — recorded_at is unix seconds.
  const [globalRow, stageRes, providerRes, tenantRes] = await Promise.all([
    db
      .prepare(
        `SELECT
           COALESCE(SUM(c.cost_usd), 0) AS total_cost,
           COALESCE(SUM(c.units), 0)    AS total_units,
           COUNT(*)                     AS line_count,
           COUNT(DISTINCT c.job_id)     AS job_count
         FROM video_cost_log c
         WHERE c.recorded_at >= ?1 AND c.recorded_at <= ?2`,
      )
      .bind(fromTs, toTs)
      .first<RawGlobal>(),
    db
      .prepare(
        `SELECT c.stage AS bucket,
                COALESCE(SUM(c.cost_usd), 0) AS cost,
                COALESCE(SUM(c.units), 0)    AS units,
                COUNT(*)                     AS n
         FROM video_cost_log c
         WHERE c.recorded_at >= ?1 AND c.recorded_at <= ?2
         GROUP BY c.stage
         ORDER BY cost DESC`,
      )
      .bind(fromTs, toTs)
      .all<RawBucket>(),
    db
      .prepare(
        `SELECT c.provider AS bucket,
                COALESCE(SUM(c.cost_usd), 0) AS cost,
                COALESCE(SUM(c.units), 0)    AS units,
                COUNT(*)                     AS n
         FROM video_cost_log c
         WHERE c.recorded_at >= ?1 AND c.recorded_at <= ?2
         GROUP BY c.provider
         ORDER BY cost DESC`,
      )
      .bind(fromTs, toTs)
      .all<RawBucket>(),
    db
      .prepare(
        `SELECT v.tenant_id,
                COALESCE(SUM(c.cost_usd), 0)   AS cost,
                COUNT(*)                       AS line_count,
                COUNT(DISTINCT c.job_id)       AS job_count
         FROM video_cost_log c
         JOIN video_jobs v ON v.id = c.job_id
         WHERE c.recorded_at >= ?1 AND c.recorded_at <= ?2
         GROUP BY v.tenant_id
         ORDER BY cost DESC
         LIMIT ?3`,
      )
      .bind(fromTs, toTs, safeLimit)
      .all<RawTenant>(),
  ]);

  const global: CostGlobalSummary = {
    totalCostUsd: Number(globalRow?.total_cost ?? 0),
    totalUnits: Number(globalRow?.total_units ?? 0),
    lineCount: Number(globalRow?.line_count ?? 0),
    jobCount: Number(globalRow?.job_count ?? 0),
  };

  const windowSec = Math.max(1, toTs - fromTs);
  const monthlyProjectionUsd = (global.totalCostUsd / windowSec) * (30 * 86400);

  return {
    fromTs,
    toTs,
    global,
    byStage: (stageRes.results ?? []).map((r) => ({
      bucket: r.bucket,
      costUsd: Number(r.cost),
      units: Number(r.units),
      lineCount: Number(r.n),
    })),
    byProvider: (providerRes.results ?? []).map((r) => ({
      bucket: r.bucket,
      costUsd: Number(r.cost),
      units: Number(r.units),
      lineCount: Number(r.n),
    })),
    topTenants: (tenantRes.results ?? []).map((r) => ({
      tenantId: r.tenant_id,
      costUsd: Number(r.cost),
      lineCount: Number(r.line_count),
      jobCount: Number(r.job_count),
    })),
    monthlyProjectionUsd,
  };
}
