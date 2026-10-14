/**
 * Metrics parsing, averaging, and velocity score helpers for Learning Velocity Cron.
 * @module forest/inngest/functions/learning-velocity-helpers
 */

import type { getD1 } from '@/seed/db/client';
import type { LearningVelocityMetric } from '@/seed/types/learning-velocity';

export const LOOKBACK_MS = 7 * 24 * 60 * 60 * 1000; // 7-day window
export const EARLY_RATIO = 0.4; // first 40% vs last 60% of window

export interface EventRow {
  metrics_json: string;
}

export function parseMetrics(row: EventRow): Record<string, number> {
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

export function avgMetrics(rows: EventRow[]): Record<string, number> {
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

export function computeVelocityScore(
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

export async function writeVelocity(
  db: NonNullable<Awaited<ReturnType<typeof getD1>>>,
  metric: LearningVelocityMetric,
): Promise<void> {
  await db
    .prepare(
      `INSERT OR REPLACE INTO learning_velocity
       (id, workspace_id, entity_type, channel, velocity_score, event_count,
        window_start_ms, window_end_ms, avg_metrics, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
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
    )
    .run();
}
