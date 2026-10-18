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
  type CacheStats,
  type WorkflowStats,
  type SignalEventCount,
  type QueryResult,
  ZERO_CACHE,
  ZERO_WORKFLOW,
} from './monitoring-types';

export * from './monitoring-types';
export { aggregateByokEvents, getTraceStats } from './monitoring-signal-queries';

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
