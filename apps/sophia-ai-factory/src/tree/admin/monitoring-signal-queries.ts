/**
 * Admin Monitoring Signal & Trace Queries — Phase 4.7 / 4K
 *
 * Direct D1 signal event and LLM call trace aggregations.
 */

import {
  aggregateTraceStats,
  type TraceRow,
} from '@/tree/admin/trace-aggregator';
import {
  type ByokEventCounts,
  type D1Binding,
  ZERO_BYOK,
} from './monitoring-types';

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
