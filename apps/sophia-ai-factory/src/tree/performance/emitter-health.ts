/**
 * Reality Loop Emitter Health — observability for the 13 canonical event types.
 *
 * Layer: tree (domain-specific reusable). Imports seed only.
 * Read-only queries against performance_events — no writes, no new tables.
 *
 * Static wired-registry: 11 of 13 event types have production call sites.
 * 2 are deferred by design (no production call site yet — wiring them to a
 * fake site would produce garbage data):
 *   - creative.edited  (no creative-edit UI flow exists yet)
 *   - memory.corrected (no human-correction hook exists yet)
 *
 * @module tree/performance/emitter-health
 */

import type { RealityLoopEventType } from './loop-events';
import { REALITY_LOOP_EVENT_TYPES } from './loop-events';
import { getD1Safe } from '@/seed/db/client';

/** Event types with production call sites (static registry, scouted 2026-09). */
const WIRED_EVENT_TYPES: ReadonlySet<RealityLoopEventType> = new Set([
  'mission.created',
  'mission.abandoned',
  'agent.started',
  'agent.failed',
  'approval.requested',
  'approval.approved',
  'approval.rejected',
  'creative.accepted',
  'creative.rejected',
  'memory.used',
  'mission.cost_recorded',
]);

/** Event types deferred pending a production call site (do not alert on). */
const DEFERRED_EVENT_TYPES: ReadonlySet<RealityLoopEventType> = new Set([
  'creative.edited',
  'memory.corrected',
]);

/** A wired emitter with no event in this window is considered stale. */
export const STALE_EMITTER_WINDOW_MS = 24 * 60 * 60 * 1000; // 24h

/** Per-event-type health snapshot. */
export interface EmitterHealthEntry {
  eventType: RealityLoopEventType;
  /** True when a production call site exists. */
  wired: boolean;
  /** True when deferred pending a call site (suppressed from staleness). */
  deferred: boolean;
  /** Count of events in trailing 24h. */
  count24h: number;
  /** Max recorded_at (epoch ms) for this event type — null if never emitted. */
  lastEmittedAt: number | null;
  /** now - lastEmittedAt (ms); null when never emitted. Wired-only concept. */
  lagMs: number | null;
  /** True when wired and last event older than the stale window. */
  stale: boolean;
}

/** Aggregate Reality Loop health. */
export interface EmitterHealthReport {
  totalEventTypes: number;
  wired: number;
  deferred: number;
  /** Wired event types with zero trailing-24h events. */
  staleEmitterTypes: RealityLoopEventType[];
  /** Per-event-type entries (all 13). */
  entries: EmitterHealthEntry[];
  /** Max lag among wired emitters that have ever emitted (ms, null-safe). */
  maxLagMs: number | null;
}

interface EventAggRow {
  event_type: string;
  cnt: number;
  last_ms: number | null;
}

/** Pure predicate for wired status (exported for tests + static registry use). */
export function isWiredEventType(eventType: RealityLoopEventType): boolean {
  return WIRED_EVENT_TYPES.has(eventType);
}

/** Pure predicate for deferred status. */
export function isDeferredEventType(eventType: RealityLoopEventType): boolean {
  return DEFERRED_EVENT_TYPES.has(eventType);
}

/**
 * Compute the full emitter-health report. Reads D1 via a single aggregate
 * query — errors degrade to a static-wiring-only report (never throws).
 */
export async function getEmitterHealth(nowMs: number = Date.now()): Promise<EmitterHealthReport> {
  const counts = await queryEventCounts();
  const entries: EmitterHealthEntry[] = REALITY_LOOP_EVENT_TYPES.map((eventType) => {
    const wired = WIRED_EVENT_TYPES.has(eventType);
    const deferred = DEFERRED_EVENT_TYPES.has(eventType);
    const row = counts.get(eventType);
    const count24h = row?.count24h ?? 0;
    const lastEmittedAt = row?.lastMs ?? null;
    const lagMs = wired && lastEmittedAt !== null ? Math.max(0, nowMs - lastEmittedAt) : null;
    const stale = wired && (lastEmittedAt === null || nowMs - lastEmittedAt > STALE_EMITTER_WINDOW_MS);
    return { eventType, wired, deferred, count24h, lastEmittedAt, lagMs, stale };
  });

  const wiredEntries = entries.filter((e) => e.wired);
  const lagValues = wiredEntries
    .map((e) => e.lagMs)
    .filter((v): v is number => v !== null);
  const maxLagMs = lagValues.length > 0 ? Math.max(...lagValues) : null;

  return {
    totalEventTypes: REALITY_LOOP_EVENT_TYPES.length,
    wired: wiredEntries.length,
    deferred: entries.filter((e) => e.deferred).length,
    staleEmitterTypes: entries.filter((e) => e.stale).map((e) => e.eventType),
    entries,
    maxLagMs,
  };
}

/** Single-grouped-query event counts: { eventType: { count24h, lastMs } }. */
async function queryEventCounts(): Promise<Map<string, { count24h: number; lastMs: number | null }>> {
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
