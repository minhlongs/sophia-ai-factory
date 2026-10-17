/**
 * CreativeEconomicSnapshot writer (Phase H) — measurement boundaries ONLY.
 *
 * Populates strictly from EXISTING producers. Never synthesizes a value,
 * never computes ROI. Missing source data → field stays NULL.
 *
 * Source-of-truth map (verified against source):
 *   creative_cost     ← recordSpend totals (tree/mission/repository.ts:183).
 *                      recordSpend writes ONE aggregate (spent_cents) and
 *                      emits no per-category breakdown, so the whole total
 *                      lands in creative_cost. production_cost and
 *                      distribution_cost have no producer and stay NULL.
 *   revenue           ← existing idempotent revenue bridges write
 *                      performance_events with entity_id = videoId/offerId/
 *                      externalId — NOT a mission id. Stays NULL rather than
 *                      fabricating a workspace-wide sum.
 *   leads             ← NO producer. Always NULL.
 *   conversions       ← NO producer. Always NULL.
 *
 * Layer: land (business domain). Imports seed only. No forest import.
 *
 * @module land/creative-economy/snapshot-writer
 */

'use server';

import { getD1 } from '@/seed/db/client';
import { logger } from '@/seed/utils/logger-utility';
import type { CreativeEconomicSnapshot } from './types';
import { newSnapshotId, readMissionRevenue, readSpendTotal } from './snapshot-source-readers';

/**
 * Write one mission-scoped economic snapshot.
 *
 * Returns the snapshot with NULLs preserved for every field whose source
 * datum is missing. Never throws: a missing table or unavailable D1 is
 * surfaced as a fully-null snapshot so callers can still render "no data".
 */
export async function writeCreativeEconomicSnapshot(
  missionId: string,
  workspaceId: string,
): Promise<CreativeEconomicSnapshot> {
  const id = newSnapshotId();
  const recordedAt = Date.now();

  const creativeCost = await readSpendTotal(missionId);
  const revenue = await readMissionRevenue();

  const snapshot: CreativeEconomicSnapshot = {
    id,
    workspaceId,
    missionId,
    creativeCost,
    productionCost: null,
    distributionCost: null,
    leads: null,
    conversions: null,
    revenue,
    recordedAt,
  };

  const db = await getD1();
  if (!db) {
    logger.warn('[snapshot-writer] D1 unavailable — returning null-populated snapshot', {
      missionId,
      workspaceId,
    });
    return snapshot;
  }

  try {
    await db
      .prepare(
        `INSERT INTO creative_economic_snapshot
           (id, workspace_id, mission_id, creative_cost, production_cost,
            distribution_cost, leads, conversions, revenue, recorded_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        snapshot.id,
        snapshot.workspaceId,
        snapshot.missionId,
        snapshot.creativeCost,
        snapshot.productionCost,
        snapshot.distributionCost,
        snapshot.leads,
        snapshot.conversions,
        snapshot.revenue,
        snapshot.recordedAt,
      )
      .run();
  } catch (err) {
    logger.warn('[snapshot-writer] insert failed (non-fatal) — returning null-populated snapshot', {
      missionId,
      workspaceId,
      error: err instanceof Error ? err.message : String(err),
    });
  }

  return snapshot;
}
