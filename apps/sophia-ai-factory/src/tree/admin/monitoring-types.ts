/**
 * Monitoring query contract interfaces and result wrappers.
 */

import type { TraceRow } from '@/tree/admin/trace-aggregator';

// Re-export TraceStats shape for consumers (page.tsx, tests)
export type { AggregateStats as TraceStats } from '@/tree/admin/trace-aggregator';

/** D1 binding shape — mirrors the minimal interface used by llm-trace-stats route */
export interface D1Binding {
  prepare: (sql: string) => {
    bind: (...args: unknown[]) => {
      all: () => Promise<{ results?: TraceRow[] }>;
    };
  };
}

export interface CacheStats {
  total: number;
  fresh: number;
  expired: number;
  totalHits: number;
  tokensSaved: number;
}

export interface WorkflowStats {
  queued: number;
  running: number;
  completed: number;
  failed: number;
}

export interface SignalEventCount {
  eventType: string;
  count: number;
}

export interface ByokEventCounts {
  setCount: number;
  clearCount: number;
  netChange: number; // setCount - clearCount
}

export interface QueryOk<T> {
  ok: true;
  data: T;
}
export interface QueryErr<T> {
  ok: false;
  data: T;
}
export type QueryResult<T> = QueryOk<T> | QueryErr<T>;

export const ZERO_CACHE: CacheStats = { total: 0, fresh: 0, expired: 0, totalHits: 0, tokensSaved: 0 };
export const ZERO_WORKFLOW: WorkflowStats = { queued: 0, running: 0, completed: 0, failed: 0 };
export const ZERO_BYOK: ByokEventCounts = { setCount: 0, clearCount: 0, netChange: 0 };

export function cacheHitRate(stats: CacheStats): number {
  const denom = stats.totalHits + stats.total;
  if (denom === 0) return 0;
  return stats.totalHits / denom;
}
