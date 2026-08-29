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
 *   revenue           ← existing idempotent revenue bridges:
 *                        land/analytics/revenue-ingestion.ts  (YouTube)
 *                        land/analytics/tiktok-revenue-ingestion.ts
 *                        land/ingestion/revenue-events.ts
 *                      All write performance_events with event_type in
 *                      ('revenue','sponsorship','conversion'), but entity_id
 *                      is a videoId/offerId/externalId — NOT a mission id.
 *                      There is therefore NO mission-scoped revenue producer
 *                      today; revenue stays NULL rather than fabricating a
 *                      workspace-wide sum that cannot be attributed to the
 *                      mission. Callers that want workspace-wide revenue use
 *                      dashboard-summary.
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

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Generate a collision-resistant snapshot id without a UUID dependency.
 *
 * Mirrors the local-id pattern used by land/reality-loop/feedback-store.ts
 * (time-base32 + Math.random base32) — no external package, no async, safe
 * for serverless cold-start.
 */
function newSnapshotId(): string {
  const now = Date.now().toString(36).padStart(9, '0');
  const rand = Math.random().toString(36).slice(2, 12).padEnd(12, '0');
  return `ces_${now}${rand}`.slice(0, 30);
}

// ─── Source readers ──────────────────────────────────────────────────────────

/**
 * Read the recordSpend total for a mission. Returns null when the mission
 * has never had a spend recorded (or does not exist), or when the read fails
 * for any reason (missing table, unavailable D1). A failed read is logged
 * and treated as "no signal" — never propagated, per the never-throws
 * contract of this writer.
 */
async function readSpendTotal(missionId: string): Promise<number | null> {
  let db: Awaited<ReturnType<typeof getD1>>;
  try {
    db = await getD1();
  } catch (err) {
    logger.warn('[snapshot-writer] getD1 failed during spend read', {
      missionId,
      error: err instanceof Error ? err.message : String(err),
    });
    return null;
  }
  if (!db) return null;
  try {
    const row = await db
      .prepare(`SELECT spent_cents FROM creative_missions WHERE id = ?1 LIMIT 1`)
      .bind(missionId)
      .first<{ spent_cents: number | null }>();
    if (!row || row.spent_cents == null) return null;
    return row.spent_cents;
  } catch (err) {
    logger.warn('[snapshot-writer] spend read failed — treating as no signal', {
      missionId,
      error: err instanceof Error ? err.message : String(err),
    });
    return null;
  }
}

/**
 * Read mission-scoped revenue.
 *
 * Returns null by design. The existing idempotent revenue bridges
 * (YouTube / TikTok / ad-revenue / sponsorship / affiliate / commerce) write
 * performance_events with entity_id = videoId / offerId / externalId — NOT a
 * mission id. There is no producer in production today that attributes revenue
 * to a specific mission, so this reader returns null rather than fabricating a
 * workspace-wide sum that cannot be attributed to the mission. Callers that
 * want workspace-wide revenue use dashboard-summary.
 */
async function readMissionRevenue(): Promise<number | null> {
  return null;
}

// ─── Writer ──────────────────────────────────────────────────────────────────

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