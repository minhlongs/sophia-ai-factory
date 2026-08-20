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
import { upsertMemory, recordLearning } from '@/tree/creative-memory';

export const AGGREGATION_WINDOW_MS = 24 * 60 * 60 * 1000; // 24h
export const HIGH_CONFIDENCE_THRESHOLD = 10; // events needed for high confidence

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
    .all<{
      id: string;
      event_type: string;
      entity_type: string;
      entity_id: string;
      metrics_json: string;
      channel: string | null;
      recorded_at: number;
    }>();

  const rows = events.results ?? [];
  if (rows.length === 0) return;

  // 3. Group by channel + entity_type
  const byChannel = new Map<string, typeof rows>();
  const byEntityType = new Map<string, typeof rows>();

  for (const row of rows) {
    const ch = row.channel ?? 'unknown';
    if (!byChannel.has(ch)) byChannel.set(ch, []);
    byChannel.get(ch)!.push(row);

    const et = row.entity_type;
    if (!byEntityType.has(et)) byEntityType.set(et, []);
    byEntityType.get(et)!.push(row);
  }

  // 4. Per-channel aggregate
  for (const [channel, channelEvents] of byChannel) {
    const count = channelEvents.length;
    const confidence = count >= HIGH_CONFIDENCE_THRESHOLD ? 'high' : count >= 3 ? 'medium' : 'low';

    const merged = mergeMetrics(channelEvents);
    const evidenceIds = channelEvents.slice(0, 5).map((e) => e.id);

    await upsertMemory({
      id: `mem_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      workspaceId,
      category: 'performance',
      key: `channel:${channel}:aggregate`,
      value: JSON.stringify({
        channel,
        eventCount: count,
        avgMetrics: merged,
        periodStart: windowStart,
        periodEnd: Date.now(),
      }),
      confidence,
      source: 'performance',
      evidence: JSON.stringify(evidenceIds),
      scope: 'global',
      version: 0,
      isDeleted: false,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    if (confidence === 'high') {
      await recordLearning(
        workspaceId,
        'performance',
        `channel:${channel}:high_activity`,
        JSON.stringify({ channel, count }),
        JSON.stringify(evidenceIds),
        'global',
      );
    }
  }

  // 5. Per-entity-type aggregate
  for (const [entityType, typeEvents] of byEntityType) {
    const count = typeEvents.length;
    if (count < 2) continue; // skip noise

    const merged = mergeMetrics(typeEvents);
    const evidenceIds = typeEvents.slice(0, 5).map((e) => e.id);
    const confidence = count >= HIGH_CONFIDENCE_THRESHOLD ? 'high' : 'medium';

    await upsertMemory({
      id: `mem_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      workspaceId,
      category: 'performance',
      key: `entity:${entityType}:aggregate`,
      value: JSON.stringify({
        entityType,
        eventCount: count,
        avgMetrics: merged,
      }),
      confidence,
      source: 'performance',
      evidence: JSON.stringify(evidenceIds),
      scope: 'global',
      version: 0,
      isDeleted: false,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
  }
}

function mergeMetrics(events: Array<{ metrics_json: string }>): Record<string, number> {
  const accumulator: Record<string, number[]> = {};
  for (const ev of events) {
    try {
      const metrics = JSON.parse(ev.metrics_json) as Record<string, unknown>;
      for (const [k, v] of Object.entries(metrics)) {
        if (typeof v === 'number') {
          if (!accumulator[k]) accumulator[k] = [];
          accumulator[k].push(v);
        }
      }
    } catch {
      // skip malformed
    }
  }
  const result: Record<string, number> = {};
  for (const [k, values] of Object.entries(accumulator)) {
    result[k] = values.reduce((s, n) => s + n, 0) / values.length;
  }
  return result;
}