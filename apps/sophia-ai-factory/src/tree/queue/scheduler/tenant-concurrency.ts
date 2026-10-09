/**
 * Fair-Share GPU Scheduler: Tenant Concurrency & Limit Resolution
 *
 * Layer: tree/queue (Domain services & algorithms)
 *
 * @module tree/queue/scheduler/tenant-concurrency
 */

import type { D1Database } from '@/seed/db/client';
import type { SchedulerConfig } from '@/seed/types/video-render-queue';
import { DEFAULT_SCHEDULER_CONFIG } from '@/seed/types/video-render-queue';
import { logger } from '@/seed/utils/logger-utility';

/**
 * Get count of active renders (leased + rendering) for a tenant organization
 */
export async function getTenantActiveRenderCount(
  db: D1Database,
  orgId: string,
  nowSeconds = Math.floor(Date.now() / 1000),
): Promise<number> {
  try {
    const row = await db
      .prepare(
        `SELECT COUNT(*) as count FROM video_render_jobs
         WHERE org_id = ? AND (
           status = 'rendering' OR
           (status = 'leased' AND leased_until >= ?)
         )`,
      )
      .bind(orgId, nowSeconds)
      .first<{ count: number }>();

    return row?.count ?? 0;
  } catch (error) {
    logger.warn('[gpu-scheduler] Error fetching tenant active render count', {
      orgId,
      error: String(error),
    });
    return 0;
  }
}

/**
 * Batch query active render counts for multiple tenants in a single grouped query.
 * Eliminates N+1 query loops when evaluating lease candidates.
 */
export async function getTenantsActiveRenderCounts(
  db: D1Database,
  orgIds: string[],
  nowSeconds = Math.floor(Date.now() / 1000),
): Promise<Map<string, number>> {
  const counts = new Map<string, number>();
  if (orgIds.length === 0) return counts;

  try {
    const uniqueOrgIds = Array.from(new Set(orgIds));
    const placeholders = uniqueOrgIds.map(() => '?').join(', ');
    const query = `SELECT org_id, COUNT(*) as count FROM video_render_jobs
         WHERE org_id IN (${placeholders}) AND (
           status = 'rendering' OR
           (status = 'leased' AND leased_until >= ?)
         )
         GROUP BY org_id`;
    const res = await db
      .prepare(query)
      .bind(...uniqueOrgIds, nowSeconds)
      .all<{ org_id: string; count: number }>();

    for (const row of res.results ?? []) {
      counts.set(row.org_id, Number(row.count));
    }
  } catch (error) {
    logger.warn('[gpu-scheduler] Error fetching batched tenant active render counts', {
      orgCount: orgIds.length,
      error: String(error),
    });
  }

  return counts;
}

/**
 * Resolve concurrency limit for an organization given its tier
 */
export function getTenantConcurrencyLimit(
  tier: string | null | undefined,
  config: SchedulerConfig = DEFAULT_SCHEDULER_CONFIG,
): number {
  const limits =
    config.maxActiveRendersPerTenant ?? DEFAULT_SCHEDULER_CONFIG.maxActiveRendersPerTenant!;
  const normalizedTier = (tier || 'basic').toLowerCase();

  return (
    limits[normalizedTier] ??
    limits[tier?.toUpperCase() || ''] ??
    limits.default ??
    5
  );
}
