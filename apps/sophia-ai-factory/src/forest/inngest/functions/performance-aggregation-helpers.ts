/**
 * Metrics Merging and Memory Upsert Helpers for Performance Aggregation
 * @module forest/inngest/functions/performance-aggregation-helpers
 */

import { upsertMemory, recordLearning } from '@/tree/creative-memory';

export const AGGREGATION_WINDOW_MS = 24 * 60 * 60 * 1000; // 24h
export const HIGH_CONFIDENCE_THRESHOLD = 10; // events needed for high confidence

export interface PerformanceWindowRow {
  id: string;
  event_type: string;
  entity_type: string;
  entity_id: string;
  metrics_json: string;
  channel: string | null;
  recorded_at: number;
}

export function mergeMetrics(events: Array<{ metrics_json: string }>): Record<string, number> {
  const accumulator: Record<string, number[]> = {};
  for (const ev of events) {
    try {
      const metrics = JSON.parse(ev.metrics_json) as Record<string, unknown>;
      for (const [k, v] of Object.entries(metrics)) {
        if (typeof v !== 'number') continue;
        const list = accumulator[k] ?? (accumulator[k] = []);
        list.push(v);
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

export async function persistChannelAggregates(
  workspaceId: string,
  windowStart: number,
  byChannel: Map<string, PerformanceWindowRow[]>,
): Promise<void> {
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
}

export async function persistEntityTypeAggregates(
  workspaceId: string,
  byEntityType: Map<string, PerformanceWindowRow[]>,
): Promise<void> {
  for (const [entityType, typeEvents] of byEntityType) {
    const count = typeEvents.length;
    if (count < 2) continue;

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
