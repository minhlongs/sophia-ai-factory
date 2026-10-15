/**
 * Inngest: Learning Velocity Cron (Phase 4.3 — Creative Memory Feedback Loop)
 *
 * Daily cron that computes learning velocity per (workspace, entity_type, channel).
 * Compares early vs late period performance to derive an improvement rate (0-100).
 * Writes results to the learning_velocity table.
 *
 * Layer: forest (infrastructure orchestration)
 */

import { inngest } from '@/seed/inngest/client';
import { getD1 } from '@/seed/db/client';
import { logger } from '@/seed/utils/logger-utility';
import type { LearningVelocityMetric } from '@/seed/types/learning-velocity';
import { LOOKBACK_MS, EARLY_RATIO, avgMetrics, computeVelocityScore, writeVelocity, type EventRow } from './learning-velocity-helpers';

export {
  parseMetrics,
  avgMetrics,
  computeVelocityScore,
  writeVelocity,
  type EventRow,
} from './learning-velocity-helpers';

export const learningVelocityCron = inngest.createFunction(
  { id: 'learning-velocity-cron' },
  { cron: '0 3 * * *' }, // daily at 03:00 UTC
  async () => {
    const nowMs = Date.now();
    const windowStartMs = nowMs - LOOKBACK_MS;

    const db = await getD1();
    if (!db) {
      logger.error('[learning-velocity-cron] D1 not available');
      return { computed: 0 };
    }

    // Distinct (workspace_id, entity_type, channel) combos in the window
    const combos = await db.prepare(
      `SELECT DISTINCT workspace_id, entity_type, channel
       FROM performance_events
       WHERE recorded_at >= ? AND recorded_at <= ?`,
    ).bind(windowStartMs, nowMs).all<{
      workspace_id: string;
      entity_type: string;
      channel: string;
    }>();

    const rows = combos.results ?? [];
    let written = 0;
    const cutoffMs = windowStartMs + LOOKBACK_MS * EARLY_RATIO;

    for (const combo of rows) {
      try {
        const metric = await computeVelocity(
          db, combo.workspace_id, combo.entity_type, combo.channel,
          windowStartMs, cutoffMs, nowMs,
        );
        if (metric) {
          await writeVelocity(db, metric);
          written++;
        }
      } catch (err) {
        logger.error('[learning-velocity-cron] combo failed', {
          error: err instanceof Error ? err.message : String(err),
          workspaceId: combo.workspace_id,
          entityType: combo.entity_type,
          channel: combo.channel,
        });
      }
    }

    logger.info('[learning-velocity-cron] Completed', { computed: written });
    return { computed: written };
  },
);

export async function computeVelocity(
  db: NonNullable<Awaited<ReturnType<typeof getD1>>>,
  workspaceId: string,
  entityType: string,
  channel: string,
  windowStartMs: number,
  cutoffMs: number,
  nowMs: number,
): Promise<LearningVelocityMetric | null> {
  const all = await db.prepare(
    `SELECT metrics_json FROM performance_events
     WHERE workspace_id = ? AND entity_type = ? AND channel = ?
       AND recorded_at >= ? AND recorded_at <= ?
     ORDER BY recorded_at ASC`,
  ).bind(workspaceId, entityType, channel, windowStartMs, nowMs)
    .all<EventRow>();

  const events = all.results ?? [];
  if (events.length < 4) return null; // need minimum sample

  const early = events.filter((_, i) => i < Math.floor(events.length * EARLY_RATIO));
  const late = events.slice(Math.floor(events.length * EARLY_RATIO));

  if (early.length === 0 || late.length === 0) return null;

  const earlyAvg = avgMetrics(early);
  const lateAvg = avgMetrics(late);
  const velocityScore = computeVelocityScore(earlyAvg, lateAvg);

  return {
    id: `vel_${workspaceId.slice(0, 8)}_${entityType}_${channel}_${nowMs}`,
    workspaceId,
    entityType,
    channel,
    velocityScore,
    eventCount: events.length,
    windowStartMs,
    windowEndMs: nowMs,
    avgMetrics: lateAvg,
    createdAt: nowMs,
  };
}
