/**
 * Admin Monitoring D1 Aggregates — Phase 4.7 Dashboard
 *
 * Thin, typed wrappers around D1 RPC aggregates defined in
 * `d1-query-builder.ts`. All queries swallow errors and return safe zero
 * values so the dashboard degrades gracefully when D1 is unavailable.
 *
 * Server-side only — do NOT import from client components.
 */

import { createServerClient } from '@/lib/db/client'
import {
  aggregateTraceStats,
  type TraceRow,
} from '@/lib/admin/trace-aggregator'

// Re-export TraceStats shape for consumers (page.tsx, tests)
export type { AggregateStats as TraceStats } from '@/lib/admin/trace-aggregator'

/** D1 binding shape — mirrors the minimal interface used by llm-trace-stats route */
interface D1Binding {
  prepare: (sql: string) => {
    bind: (...args: unknown[]) => {
      all: () => Promise<{ results?: TraceRow[] }>
    }
  }
}

export interface CacheStats {
  total:        number
  fresh:        number
  expired:      number
  totalHits:    number
  tokensSaved:  number
}

export interface WorkflowStats {
  queued:    number
  running:   number
  completed: number
  failed:    number
}

export interface SignalEventCount {
  eventType: string
  count:     number
}

/**
 * Wrapper that distinguishes "D1 returned zeros" from "D1 unavailable". The
 * dashboard uses `ok=false` to show a degraded banner — without this the
 * operator cannot tell an idle system from a broken one.
 */
export interface QueryOk<T> { ok: true;  data: T }
export interface QueryErr<T> { ok: false; data: T }
export type QueryResult<T> = QueryOk<T> | QueryErr<T>

const ZERO_CACHE: CacheStats = { total: 0, fresh: 0, expired: 0, totalHits: 0, tokensSaved: 0 }
const ZERO_WORKFLOW: WorkflowStats = { queued: 0, running: 0, completed: 0, failed: 0 }

/**
 * LLM cache aggregate (all-time totals + fresh/expired split).
 * tokensSaved = Σ (input_tokens + output_tokens) × hit_count.
 */
export async function getCacheStats(): Promise<QueryResult<CacheStats>> {
  try {
    const db = createServerClient()
    const { data, error } = await db.rpc('llm_cache_stats')
    if (error || !data) return { ok: false, data: ZERO_CACHE }
    const row = data as Record<string, number>
    return {
      ok: true,
      data: {
        total:        Number(row.total        ?? 0),
        fresh:        Number(row.fresh        ?? 0),
        expired:      Number(row.expired      ?? 0),
        totalHits:    Number(row.total_hits   ?? 0),
        tokensSaved:  Number(row.tokens_saved ?? 0),
      },
    }
  } catch {
    return { ok: false, data: ZERO_CACHE }
  }
}

/** Workflow count by status, last 24h. */
export async function getWorkflowStats(): Promise<QueryResult<WorkflowStats>> {
  try {
    const db = createServerClient()
    const { data, error } = await db.rpc('workflow_stats_24h')
    if (error || !data) return { ok: false, data: ZERO_WORKFLOW }
    const row = data as Record<string, number>
    return {
      ok: true,
      data: {
        queued:    Number(row.queued    ?? 0),
        running:   Number(row.running   ?? 0),
        completed: Number(row.completed ?? 0),
        failed:    Number(row.failed    ?? 0),
      },
    }
  } catch {
    return { ok: false, data: ZERO_WORKFLOW }
  }
}

/** Top N signals events by count, last 24h. Empty array on D1 failure. */
export async function getSignalsStats(limit: number = 10): Promise<QueryResult<SignalEventCount[]>> {
  try {
    const db = createServerClient()
    const { data, error } = await db.rpc('signals_top_events_24h', { p_limit: limit })
    if (error || !data) return { ok: false, data: [] }
    const rows = data as Array<{ event_type: string; cnt: number }>
    return {
      ok: true,
      data: rows.map((r) => ({
        eventType: r.event_type,
        count:     Number(r.cnt ?? 0),
      })),
    }
  } catch {
    return { ok: false, data: [] }
  }
}

/**
 * Approximate cache hit ratio as a fraction 0..1. Upsert semantics mean
 * `total` counts distinct cache rows (not distinct misses), so this slightly
 * overstates true hit rate on hot keys whose TTL was bumped. Treat as a
 * directional indicator until Phase 4.7.1 adds an explicit miss counter.
 *
 * ratio = hits / (hits + distinct entries)
 */
export function cacheHitRate(stats: CacheStats): number {
  const denom = stats.totalHits + stats.total
  if (denom === 0) return 0
  return stats.totalHits / denom
}

export interface ByokEventCounts {
  setCount:  number
  clearCount: number
  netChange:  number // setCount - clearCount
}

const ZERO_BYOK: ByokEventCounts = { setCount: 0, clearCount: 0, netChange: 0 }

/**
 * Count BYOK key-set / key-cleared signals_events within the last `hoursBack` hours.
 * Returns zero-safe object on D1 failure — dashboard degrades gracefully.
 */
export async function aggregateByokEvents(hoursBack = 24): Promise<ByokEventCounts> {
  const db = (globalThis as unknown as { DB?: D1Binding }).DB
  if (!db) return ZERO_BYOK

  try {
    const result = await db
      .prepare(
        `SELECT event_type, COUNT(*) AS cnt
         FROM signals_events
         WHERE event_type IN ('byok_key_set','byok_key_cleared')
           AND created_at >= datetime('now', '-' || ? || ' hours')
         GROUP BY event_type`,
      )
      .bind(hoursBack)
      .all()

    const rows = (result.results ?? []) as unknown as Array<{ event_type: string; cnt: number }>
    let setCount = 0
    let clearCount = 0
    for (const row of rows) {
      if (row.event_type === 'byok_key_set')     setCount  = Number(row.cnt ?? 0)
      if (row.event_type === 'byok_key_cleared') clearCount = Number(row.cnt ?? 0)
    }
    return { setCount, clearCount, netChange: setCount - clearCount }
  } catch {
    return ZERO_BYOK
  }
}

/**
 * LLM call trace aggregates — Phase 4K SSR helper.
 *
 * Reads last 24h of llm_call_trace events from D1 signals_events and
 * delegates to the pure `aggregateTraceStats()` from `@/lib/admin/trace-aggregator`
 * (extracted in Phase 4M). Returns null when D1 is unavailable or query throws —
 * page renders a graceful "No LLM traces yet" placeholder without error banners.
 */
export async function getTraceStats() {
  const db = (globalThis as unknown as { DB?: D1Binding }).DB
  if (!db) return null

  try {
    const result = await db
      .prepare(
        `SELECT props FROM signals_events WHERE event_type='llm_call_trace' AND created_at >= datetime('now','-24 hours')`,
      )
      .bind()
      .all()

    const rows: TraceRow[] = (result.results ?? []) as TraceRow[]
    return aggregateTraceStats(rows)
  } catch {
    return null
  }
}
