/**
 * ROI Tracker — Phase 4: Creative Learning Loop
 *
 * Computes revenue / generation-cost ratio per content unit (mission or asset).
 * Layer: tree (domain-specific reusable)
 */

import { getD1 } from '@/seed/db/client';
import { logger } from '@/seed/utils/logger-utility';
import { PerformanceError } from '@/tree/performance/errors';

export { getWorkspaceROI, getTopROIChannels } from './roi-queries';

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
  const db = await getD1();
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
