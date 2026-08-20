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

const LOOKBACK_MS = 7 * 24 * 60 * 60 * 1000; // 7-day window
const EARLY_RATIO = 0.4; // first 40% vs last 60% of window

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
       WHERE created_at >= ? AND created_at <= ?`,
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

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

interface EventRow {
  metrics_json: string;
}

function parseMetrics(row: EventRow): Record<string, number> {
  try {
    const raw = JSON.parse(row.metrics_json) as Record<string, unknown>;
    const out: Record<string, number> = {};
    for (const [k, v] of Object.entries(raw)) {
      if (typeof v === 'number') out[k] = v;
    }
    return out;
  } catch {
    return {};
  }
}

function avgMetrics(rows: EventRow[]): Record<string, number> {
  const accum: Record<string, number[]> = {};
  for (const r of rows) {
    for (const [k, v] of Object.entries(parseMetrics(r))) {
      if (!accum[k]) accum[k] = [];
      accum[k].push(v);
    }
  }
  const out: Record<string, number> = {};
  for (const [k, vals] of Object.entries(accum)) {
    out[k] = vals.reduce((s, n) => s + n, 0) / vals.length;
  }
  return out;
}

function computeVelocityScore(
  early: Record<string, number>,
  late: Record<string, number>,
): number {
  const keys = new Set([...Object.keys(early), ...Object.keys(late)]);
  if (keys.size === 0) return 50; // no data → neutral

  let totalChange = 0;
  let count = 0;
  for (const k of keys) {
    const e = early[k] ?? 0;
    const l = late[k] ?? 0;
    const denom = Math.abs(e) + Math.abs(l);
    if (denom === 0) continue;
    totalChange += (l - e) / denom;
    count++;
  }
  if (count === 0) return 50;

  // Map [-1, 1] change ratio to [0, 100] score
  const avg = totalChange / count;
  return Math.round(Math.max(0, Math.min(100, (avg + 1) * 50)));
}

async function computeVelocity(
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
       AND created_at >= ? AND created_at <= ?`,
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

async function writeVelocity(
  db: NonNullable<Awaited<ReturnType<typeof getD1>>>,
  metric: LearningVelocityMetric,
): Promise<void> {
  await db.prepare(
    `INSERT OR REPLACE INTO learning_velocity
     (id, workspace_id, entity_type, channel, velocity_score, event_count,
      window_start_ms, window_end_ms, avg_metrics, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).bind(
    metric.id,
    metric.workspaceId,
    metric.entityType,
    metric.channel,
    metric.velocityScore,
    metric.eventCount,
    metric.windowStartMs,
    metric.windowEndMs,
    JSON.stringify(metric.avgMetrics),
    metric.createdAt,
  ).run();
}
