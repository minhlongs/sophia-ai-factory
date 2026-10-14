/**
 * Inngest: Performance Aggregation (Phase 4 — Creative Learning Loop)
 *
 * Cron: every 15 minutes
 * Reads performance_events → computes workspace-level aggregates →
 * updates creative_memory with high-confidence performance signals.
 *
 * Layer: forest (infrastructure orchestration)
 */

import { inngest } from '@/seed/inngest/client';
import { getD1 } from '@/seed/db/client';
import { logger } from '@/seed/utils/logger-utility';
import {
  AGGREGATION_WINDOW_MS,
  HIGH_CONFIDENCE_THRESHOLD,
  mergeMetrics,
  persistChannelAggregates,
  persistEntityTypeAggregates,
  type PerformanceWindowRow,
} from './performance-aggregation-helpers';

export { AGGREGATION_WINDOW_MS, HIGH_CONFIDENCE_THRESHOLD, mergeMetrics };

export const performanceAggregationCron = inngest.createFunction(
  {
    id: 'performance-aggregation',
    retries: 2,
  },
  { cron: '*/15 * * * *' },
  async () => {
    const db = await getD1();
    if (!db) {
      logger.warn('[performance-aggregation] D1 unavailable, skipping');
      return { skipped: true, reason: 'D1_UNAVAILABLE' };
    }

    const windowStart = Date.now() - AGGREGATION_WINDOW_MS;

    // 1. Fetch distinct workspace_ids with recent events
    const workspaces = await db
      .prepare(
        `SELECT DISTINCT workspace_id FROM performance_events WHERE recorded_at >= ?`,
      )
      .bind(windowStart)
      .all<{ workspace_id: string }>();

    if (!workspaces.results?.length) {
      return { skipped: true, reason: 'NO_RECENT_EVENTS' };
    }

    let processed = 0;
    for (const ws of workspaces.results) {
      try {
        await aggregateWorkspace(db, ws.workspace_id, windowStart);
        processed++;
      } catch (err) {
        logger.error('[performance-aggregation] workspace failed', {
          workspaceId: ws.workspace_id,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    logger.info('[performance-aggregation] completed', { processed, total: workspaces.results.length });
    return { processed, total: workspaces.results.length };
  },
);

async function aggregateWorkspace(
  db: NonNullable<Awaited<ReturnType<typeof getD1>>>,
  workspaceId: string,
  windowStart: number,
): Promise<void> {
  // 2. Fetch all events in window for this workspace
  const events = await db
    .prepare(
      `SELECT id, event_type, entity_type, entity_id, metrics_json, channel, recorded_at
       FROM performance_events
       WHERE workspace_id = ? AND recorded_at >= ?
       ORDER BY recorded_at DESC`,
    )
    .bind(workspaceId, windowStart)
    .all<PerformanceWindowRow>();

  const rows = events.results ?? [];
  if (rows.length === 0) return;

  // 3. Group by channel + entity_type
  const byChannel = new Map<string, PerformanceWindowRow[]>();
  const byEntityType = new Map<string, PerformanceWindowRow[]>();

  for (const row of rows) {
    const ch = row.channel ?? 'unknown';
    if (!byChannel.has(ch)) byChannel.set(ch, []);
    byChannel.get(ch)!.push(row);

    const et = row.entity_type;
    if (!byEntityType.has(et)) byEntityType.set(et, []);
    byEntityType.get(et)!.push(row);
  }

  await persistChannelAggregates(workspaceId, windowStart, byChannel);
  await persistEntityTypeAggregates(workspaceId, byEntityType);
}