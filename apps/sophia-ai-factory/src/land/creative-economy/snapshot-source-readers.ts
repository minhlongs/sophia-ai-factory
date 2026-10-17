/**
 * CreativeEconomicSnapshot source readers & ID generator.
 *
 * Layer: land (business domain). Imports seed only. No forest import.
 *
 * @module land/creative-economy/snapshot-source-readers
 */

import { getD1 } from '@/seed/db/client';
import { logger } from '@/seed/utils/logger-utility';

/**
 * Generate a collision-resistant snapshot id without a UUID dependency.
 *
 * Mirrors the local-id pattern used by land/reality-loop/feedback-store.ts
 * (time-base32 + Math.random base32) — no external package, no async, safe
 * for serverless cold-start.
 */
export function newSnapshotId(): string {
  const now = Date.now().toString(36).padStart(9, '0');
  const rand = Math.random().toString(36).slice(2, 12).padEnd(12, '0');
  return `ces_${now}${rand}`.slice(0, 30);
}

/**
 * Read the recordSpend total for a mission. Returns null when the mission
 * has never had a spend recorded (or does not exist), or when the read fails
 * for any reason (missing table, unavailable D1). A failed read is logged
 * and treated as "no signal" — never propagated, per the never-throws
 * contract of this writer.
 */
export async function readSpendTotal(missionId: string): Promise<number | null> {
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
 * workspace-wide sum that cannot be attributed to the mission.
 */
export async function readMissionRevenue(): Promise<number | null> {
  return null;
}
