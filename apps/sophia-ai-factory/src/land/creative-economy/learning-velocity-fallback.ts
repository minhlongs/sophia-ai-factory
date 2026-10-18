/**
 * Fallback 7-day learning velocity inline computation when precomputed table is empty.
 * @module land/creative-economy/learning-velocity-fallback
 */

import type { createServerClient } from '@/seed/db/client';
import { avgMetrics, computeVelocityScore, type EventRow } from './velocity-math';
import type { VelocityPoint } from './types';

export async function computeFreshLearningVelocityFallback(
  db: ReturnType<typeof createServerClient>,
  workspaceId: string,
  options: {
    lookbackMs: number;
    earlyRatio: number;
    minEvents: number;
  },
): Promise<VelocityPoint[]> {
  const nowMs = Date.now();
  const windowStartMs = nowMs - options.lookbackMs;

  const combos = await db
    .prepare(
      `SELECT DISTINCT entity_type, channel FROM performance_events
       WHERE workspace_id = ?1 AND recorded_at >= ?2 AND recorded_at <= ?3`,
    )
    .bind(workspaceId, windowStartMs, nowMs)
    .all<{ entity_type: string; channel: string }>();

  const points: VelocityPoint[] = [];

  for (const combo of combos.results ?? []) {
    const all = await db
      .prepare(
        `SELECT metrics_json FROM performance_events
         WHERE workspace_id = ?1 AND entity_type = ?2 AND channel = ?3
           AND recorded_at >= ?4 AND recorded_at <= ?5
         ORDER BY recorded_at ASC`,
      )
      .bind(workspaceId, combo.entity_type, combo.channel, windowStartMs, nowMs)
      .all<EventRow>();

    const events = all.results ?? [];
    if (events.length < options.minEvents) continue;

    const splitIdx = Math.floor(events.length * options.earlyRatio);
    const early = events.slice(0, splitIdx);
    const late = events.slice(splitIdx);
    if (early.length === 0 || late.length === 0) continue;

    points.push({
      entityType: combo.entity_type,
      channel: combo.channel,
      velocityScore: computeVelocityScore(avgMetrics(early), avgMetrics(late)),
      eventCount: events.length,
      windowStartMs,
      windowEndMs: nowMs,
    });
  }

  return points;
}
