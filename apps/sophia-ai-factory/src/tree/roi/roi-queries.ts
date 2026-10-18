/**
 * ROI Aggregation Queries
 * Layer: tree/roi
 *
 * @module tree/roi/roi-queries
 */

import { getD1 } from '@/seed/db/client';
import { PerformanceError } from '@/tree/performance/errors';
import type { ROIAggregate } from './tracker';

export async function getWorkspaceROI(
  workspaceId: string,
  opts?: { channel?: string; since?: number },
): Promise<ROIAggregate | null> {
  const db = await getD1();
  if (!db) throw new PerformanceError('D1_UNAVAILABLE', 'D1 not available');

  const conditions: string[] = ['workspace_id = ?'];
  const params: unknown[] = [workspaceId];
  let idx = 2;

  if (opts?.channel) {
    conditions.push(`channel = ?${idx++}`);
    params.push(opts.channel);
  }
  if (opts?.since) {
    conditions.push(`recorded_at >= ?${idx++}`);
    params.push(opts.since);
  }

  const where = conditions.join(' AND ');
  const rows = await db
    .prepare(
      `SELECT SUM(revenue_cents) AS total_revenue, SUM(cost_cents) AS total_cost, COUNT(*) AS unit_count
       FROM roi_records WHERE ${where}`,
    )
    .bind(...params)
    .all<{ total_revenue: number | null; total_cost: number | null; unit_count: number }>();

  const row = rows.results?.[0];
  if (!row || row.unit_count === 0) return null;

  const totalRevenueCents = row.total_revenue ?? 0;
  const totalCostCents = row.total_cost ?? 0;
  const roi = totalCostCents > 0 ? ((totalRevenueCents - totalCostCents) / totalCostCents) * 100 : 0;

  return {
    workspaceId,
    channel: opts?.channel,
    totalRevenueCents,
    totalCostCents,
    roi,
    unitCount: row.unit_count,
    avgRevenuePerUnit: totalRevenueCents / row.unit_count,
    avgCostPerUnit: totalCostCents / row.unit_count,
  };
}

export async function getTopROIChannels(
  workspaceId: string,
  limit = 10,
  since?: number,
): Promise<ROIAggregate[]> {
  const db = await getD1();
  if (!db) throw new PerformanceError('D1_UNAVAILABLE', 'D1 not available');

  const conditions = ['workspace_id = ?'];
  const params: unknown[] = [workspaceId];
  if (since) {
    conditions.push('recorded_at >= ?');
    params.push(since);
  }

  const rows = await db
    .prepare(
      `SELECT channel, SUM(revenue_cents) AS total_revenue, SUM(cost_cents) AS total_cost, COUNT(*) AS unit_count
       FROM roi_records WHERE ${conditions.join(' AND ')}
       GROUP BY channel ORDER BY total_revenue DESC LIMIT ?`,
    )
    .bind(...params, limit)
    .all<{
      channel: string | null;
      total_revenue: number | null;
      total_cost: number | null;
      unit_count: number;
    }>();

  return (rows.results ?? [])
    .filter((r) => r.channel)
    .map((r) => {
      const rev = r.total_revenue ?? 0;
      const cost = r.total_cost ?? 0;
      const roi = cost > 0 ? ((rev - cost) / cost) * 100 : rev > 0 ? 100 : 0;
      return {
        workspaceId,
        channel: r.channel ?? undefined,
        totalRevenueCents: rev,
        totalCostCents: cost,
        roi,
        unitCount: r.unit_count,
        avgRevenuePerUnit: rev / r.unit_count,
        avgCostPerUnit: cost / r.unit_count,
      };
    });
}
