/**
 * Admin Monitoring D1 Aggregates — Phase 4.7 Dashboard
 *
 * Thin, typed wrappers around D1 RPC aggregates defined in
 * `d1-query-builder.ts`. All queries swallow errors and return safe zero
 * values so the dashboard degrades gracefully when D1 is unavailable.
 *
 * Server-side only — do NOT import from client components.
 */

import { createServerClient } from '@/seed/db/client';
import {
  aggregateTraceStats,
  type TraceRow,
} from '@/tree/admin/trace-aggregator';
import {
  type CacheStats,
  type WorkflowStats,
  type SignalEventCount,
  type ByokEventCounts,
  type QueryResult,
  type D1Binding,
  ZERO_CACHE,
  ZERO_WORKFLOW,
  ZERO_BYOK,
} from './monitoring-types';

export * from './monitoring-types';

/**
 * LLM cache aggregate (all-time totals + fresh/expired split).
 */
export async function getCacheStats(): Promise<QueryResult<CacheStats>> {
  try {
    const db = createServerClient();
    const { data, error } = await db.rpc('llm_cache_stats');
    if (error || !data) return { ok: false, data: ZERO_CACHE };
    const row = data as Record<string, number>;
    return {
      ok: true,
      data: {
        total: Number(row.total ?? 0),
        fresh: Number(row.fresh ?? 0),
        expired: Number(row.expired ?? 0),
        totalHits: Number(row.total_hits ?? 0),
        tokensSaved: Number(row.tokens_saved ?? 0),
      },
    };
  } catch {
    return { ok: false, data: ZERO_CACHE };
  }
}

/** Workflow count by status, last 24h. */
export async function getWorkflowStats(): Promise<QueryResult<WorkflowStats>> {
  try {
    const db = createServerClient();
    const { data, error } = await db.rpc('workflow_stats_24h');
    if (error || !data) return { ok: false, data: ZERO_WORKFLOW };
    const row = data as Record<string, number>;
    return {
      ok: true,
      data: {
        queued: Number(row.queued ?? 0),
        running: Number(row.running ?? 0),
        completed: Number(row.completed ?? 0),
        failed: Number(row.failed ?? 0),
      },
    };
  } catch {
    return { ok: false, data: ZERO_WORKFLOW };
  }
}

/** Top N signals events by count, last 24h. Empty array on D1 failure. */
export async function getSignalsStats(limit: number = 10): Promise<QueryResult<SignalEventCount[]>> {
  try {
    const db = createServerClient();
    const { data, error } = await db.rpc('signals_top_events_24h', { p_limit: limit });
    if (error || !data) return { ok: false, data: [] };
    const rows = data as Array<{ event_type: string; cnt: number }>;
    return {
      ok: true,
      data: rows.map((r) => ({
        eventType: r.event_type,
        count: Number(r.cnt ?? 0),
      })),
    };
  } catch {
    return { ok: false, data: [] };
  }
}

/**
 * Count BYOK key-set / key-cleared signals_events within the last `hoursBack` hours.
 */
export async function aggregateByokEvents(hoursBack = 24): Promise<ByokEventCounts> {
  const db = (globalThis as unknown as { DB?: D1Binding }).DB;
  if (!db) return ZERO_BYOK;

  try {
    const cutoffMs = Date.now() - hoursBack * 3600 * 1000;
    const result = await db
      .prepare(
        `SELECT event_type, COUNT(*) AS cnt
         FROM signals_events
         WHERE event_type IN ('byok_key_set','byok_key_cleared')
           AND ts >= ?
         GROUP BY event_type`,
      )
      .bind(cutoffMs)
      .all();

    const rows = (result.results ?? []) as unknown as Array<{ event_type: string; cnt: number }>;
    let setCount = 0;
    let clearCount = 0;
    for (const row of rows) {
      if (row.event_type === 'byok_key_set') setCount = Number(row.cnt ?? 0);
      if (row.event_type === 'byok_key_cleared') clearCount = Number(row.cnt ?? 0);
    }
    return { setCount, clearCount, netChange: setCount - clearCount };
  } catch {
    return ZERO_BYOK;
  }
}

/**
 * LLM call trace aggregates — Phase 4K SSR helper.
 */
export async function getTraceStats() {
  const db = (globalThis as unknown as { DB?: D1Binding }).DB;
  if (!db) return null;

  try {
    const cutoffMs = Date.now() - 24 * 3600 * 1000;
    const result = await db
      .prepare(
        `SELECT props_json AS props FROM signals_events WHERE event_type = 'llm_call_trace' AND ts >= ?`,
      )
      .bind(cutoffMs)
      .all();

    const rows: TraceRow[] = (result.results ?? []) as TraceRow[];
    return aggregateTraceStats(rows);
  } catch {
    return null;
  }
}
