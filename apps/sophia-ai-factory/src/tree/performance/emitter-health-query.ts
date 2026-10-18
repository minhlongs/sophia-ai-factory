/**
 * Reality Loop Emitter Health D1 Query Helper.
 *
 * Layer: tree (domain-specific reusable). Imports seed only.
 *
 * @module tree/performance/emitter-health-query
 */

import { REALITY_LOOP_EVENT_TYPES } from './loop-events';
import { getD1Safe } from '@/seed/db/client';

/** A wired emitter with no event in this window is considered stale. */
export const STALE_EMITTER_WINDOW_MS = 24 * 60 * 60 * 1000; // 24h

interface EventAggRow {
  event_type: string;
  cnt: number;
  last_ms: number | null;
}

/** Single-grouped-query event counts: { eventType: { count24h, lastMs } }. */
export async function queryEventCounts(): Promise<Map<string, { count24h: number; lastMs: number | null }>> {
  const db = await getD1Safe();
  if (!db) return new Map();

  try {
    const since24h = Date.now() - STALE_EMITTER_WINDOW_MS;
    const { results } = await db
      .prepare(
        `SELECT event_type,
                SUM(CASE WHEN recorded_at >= ? THEN 1 ELSE 0 END) AS cnt_24h,
                MAX(recorded_at) AS last_ms
         FROM performance_events
         WHERE event_type IN (${REALITY_LOOP_EVENT_TYPES.map(() => '?').join(',')})
         GROUP BY event_type`
      )
      .bind(since24h, ...REALITY_LOOP_EVENT_TYPES)
      .all<EventAggRow>();
    const out = new Map<string, { count24h: number; lastMs: number | null }>();
    for (const row of (results ?? []) as EventAggRow[]) {
      out.set(row.event_type, { count24h: row.cnt ?? 0, lastMs: row.last_ms ?? null });
    }
    return out;
  } catch {
    // D1 read failure → static wiring-only report. Never throw from health.
    return new Map();
  }
}
