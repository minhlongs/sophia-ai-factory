/**
 * Cost dashboard SQL queries & row mappers.
 *
 * @module land/observability/cost-snapshot-queries
 */

import type { getD1 } from '@/seed/db/client';
import type { CostBucketRow, CostGlobalSummary, CostTenantRow } from './cost-snapshot';

type D1Binding = NonNullable<Awaited<ReturnType<typeof getD1>>>;

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

export async function queryCostBreakdowns(
  db: D1Binding,
  fromTs: number,
  toTs: number,
  safeLimit: number,
): Promise<{
  global: CostGlobalSummary;
  byStage: CostBucketRow[];
  byProvider: CostBucketRow[];
  topTenants: CostTenantRow[];
}> {
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

  return {
    global: {
      totalCostUsd: Number(globalRow?.total_cost ?? 0),
      totalUnits: Number(globalRow?.total_units ?? 0),
      lineCount: Number(globalRow?.line_count ?? 0),
      jobCount: Number(globalRow?.job_count ?? 0),
    },
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
  };
}
