/**
 * ROI Tracker — Phase 4: Creative Learning Loop
 *
 * Computes revenue / generation-cost ratio per content unit (mission or asset).
 * Layer: tree (domain-specific reusable)
 */

import { getD1 } from '@/seed/db/client';
import { logger } from '@/seed/utils/logger-utility';
import { PerformanceError } from '@/tree/performance/errors';

export interface ROIRecord {
  workspaceId: string;
  entityType: 'mission' | 'asset' | 'campaign';
  entityId: string;
  revenueCents: number;
  costCents: number;
  roi: number; // (revenue - cost) / cost * 100, or 0 if cost=0
  channel?: string;
  recordedAt: number;
}

export interface ROIAggregate {
  workspaceId: string;
  channel?: string;
  totalRevenueCents: number;
  totalCostCents: number;
  roi: number;
  unitCount: number;
  avgRevenuePerUnit: number;
  avgCostPerUnit: number;
}

export async function recordROI(record: Omit<ROIRecord, 'roi'>): Promise<ROIRecord> {
  const db = getD1();
  if (!db) throw new PerformanceError('D1_UNAVAILABLE', 'D1 not available');

  const roi =
    record.costCents > 0
      ? ((record.revenueCents - record.costCents) / record.costCents) * 100
      : record.revenueCents > 0
        ? 100
        : 0;

  const roiRecord: ROIRecord = { ...record, roi };

  await db
    .prepare(
      `INSERT INTO roi_records (id, workspace_id, entity_type, entity_id, revenue_cents, cost_cents, roi, channel, recorded_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      `roi_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      record.workspaceId,
      record.entityType,
      record.entityId,
      record.revenueCents,
      record.costCents,
      roi,
      record.channel ?? null,
      record.recordedAt,
    )
    .run();

  logger.info('[roi-tracker] recorded', { workspaceId: record.workspaceId, entityId: record.entityId, roi });
  return roiRecord;
}

export async function getWorkspaceROI(
  workspaceId: string,
  opts?: { channel?: string; since?: number },
): Promise<ROIAggregate | null> {
  const db = getD1();
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
  const db = getD1();
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