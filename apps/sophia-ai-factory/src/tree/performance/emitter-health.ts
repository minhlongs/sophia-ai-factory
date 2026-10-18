/**
 * Reality Loop Emitter Health — observability for the 13 canonical event types.
 *
 * Layer: tree (domain-specific reusable). Imports seed only.
 * Read-only queries against performance_events — no writes, no new tables.
 *
 * @module tree/performance/emitter-health
 */

import type { RealityLoopEventType } from './loop-events';
import { REALITY_LOOP_EVENT_TYPES } from './loop-events';
import { queryEventCounts, STALE_EMITTER_WINDOW_MS } from './emitter-health-query';

export { STALE_EMITTER_WINDOW_MS } from './emitter-health-query';

/** Event types with production call sites (all 13 canonical events wired). */
const WIRED_EVENT_TYPES: ReadonlySet<RealityLoopEventType> = new Set(REALITY_LOOP_EVENT_TYPES);

/** Event types deferred pending a production call site (none deferred in v1.2). */
const DEFERRED_EVENT_TYPES: ReadonlySet<RealityLoopEventType> = new Set();

/**
 * Event types that fire only on human interventions, errors, or cancellations.
 * In a healthy or idle system, zero events in 24h is expected rather than an anomaly.
 */
export const CONTINGENT_EVENT_TYPES: ReadonlySet<RealityLoopEventType> = new Set([
  'creative.edited',
  'memory.corrected',
  'mission.abandoned',
  'agent.failed',
  'approval.rejected',
  'creative.rejected',
]);

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

/** Pure predicate for wired status (exported for tests + static registry use). */
export function isWiredEventType(eventType: RealityLoopEventType): boolean {
  return WIRED_EVENT_TYPES.has(eventType);
}

/** Pure predicate for deferred status. */
export function isDeferredEventType(eventType: RealityLoopEventType): boolean {
  return DEFERRED_EVENT_TYPES.has(eventType);
}

/** Pure predicate for contingent status. */
export function isContingentEventType(eventType: RealityLoopEventType): boolean {
  return CONTINGENT_EVENT_TYPES.has(eventType);
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
    const contingent = CONTINGENT_EVENT_TYPES.has(eventType);
    const row = counts.get(eventType);
    const count24h = row?.count24h ?? 0;
    const lastEmittedAt = row?.lastMs ?? null;
    const lagMs = wired && lastEmittedAt !== null ? Math.max(0, nowMs - lastEmittedAt) : null;
    const stale = wired && !contingent && (lastEmittedAt === null || nowMs - lastEmittedAt > STALE_EMITTER_WINDOW_MS);
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
