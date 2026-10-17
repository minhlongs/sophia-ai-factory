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
import { queryCostBreakdowns } from './cost-snapshot-queries';

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

/** Compute the cost snapshot over the window. `limit` clamped to [1, 100]. */
export async function getCostSnapshot(
  fromTs: number,
  toTs: number,
  limit: number = 25,
): Promise<CostSnapshot> {
  if (fromTs > toTs) throw new Error('fromTs must be <= toTs');
  const safeLimit = Math.max(1, Math.min(100, Math.floor(limit)));
  const db = await getD1();
  if (!db) throw new Error('D1 database binding not available');

  const { global, byStage, byProvider, topTenants } = await queryCostBreakdowns(
    db,
    fromTs,
    toTs,
    safeLimit,
  );

  const windowSec = Math.max(1, toTs - fromTs);
  const monthlyProjectionUsd = (global.totalCostUsd / windowSec) * (30 * 86400);

  return {
    fromTs,
    toTs,
    global,
    byStage,
    byProvider,
    topTenants,
    monthlyProjectionUsd,
  };
}
