/**
 * Algorithm: ROI modeling math for Creative Economics — pure functions,
 * no I/O, deterministic output.
 *
 * Revenue side: performance_events rows with event_type in
 * ('revenue', 'sponsorship', 'conversion') — exactly the types written by
 * the revenue ingestion producers (land/ingestion/revenue-events.ts maps
 * ad-revenue/affiliate/commerce → 'revenue', sponsorship → 'sponsorship';
 * the TikTok bridge writes 'conversion').
 *
 * Cost side: event_type = 'mission_completed' (agent-mission-executor writes
 * value_cents = costCents there; there is no 'cost' event type).
 *
 * Zero-cost guard: ROI is null (never Infinity/NaN) when cost <= 0.
 * Timestamps are MILLISECONDS (performance_events convention).
 *
 * @module land/creative-economy/roi-modeling
 */

export const REVENUE_EVENT_TYPES = ['revenue', 'sponsorship', 'conversion'] as const;

export type RevenueEventType = (typeof REVENUE_EVENT_TYPES)[number];

export const COST_EVENT_TYPE = 'mission_completed';

/** Minimal event shape needed for ROI aggregation (camelCase domain view). */
export interface PerfEventLike {
  entityType: string;
  entityId: string;
  channel: string | null;
  eventType: string;
  valueCents: number;
}

/** One aggregated ROI row per (entityType, entityId, channel). */
export interface RoiRow {
  entityId: string;
  entityType: string;
  channel: string;
  revenueCents: number;
  costCents: number;
  /** ROI percent ((revenue - cost) / cost * 100); null when cost <= 0. */
  roiPct: number | null;
}

/** Inclusive ms window bounds ending at nowMs. */
export function windowBoundsMs(
  nowMs: number,
  days: number,
): { startMs: number; endMs: number } {
  return { startMs: nowMs - days * 24 * 60 * 60 * 1000, endMs: nowMs };
}

/** True when recordedAtMs falls inside [startMs, endMs] (inclusive). */
export function inWindowMs(recordedAtMs: number, startMs: number, endMs: number): boolean {
  return recordedAtMs >= startMs && recordedAtMs <= endMs;
}

/**
 * ROI percent with the zero-cost guard: null when costCents <= 0 (or either
 * input is non-finite) so callers never serialize Infinity/NaN. Rounded to
 * 2 decimals.
 */
export function computeRoi(revenueCents: number, costCents: number): number | null {
  if (!Number.isFinite(revenueCents) || !Number.isFinite(costCents) || costCents <= 0) {
    return null;
  }
  return Math.round(((revenueCents - costCents) / costCents) * 100 * 100) / 100;
}

/**
 * Aggregate event rows into one RoiRow per (entityType, entityId, channel).
 * Event types outside the revenue set and 'mission_completed' are ignored.
 * Deterministic order: roiPct desc (nulls last), revenueCents desc,
 * entityId asc.
 */
export function aggregateRoiByEntity(rows: PerfEventLike[]): RoiRow[] {
  const byKey = new Map<string, RoiRow>();

  for (const row of rows) {
    const channel = row.channel ?? 'unknown';
    const key = `${row.entityType}:${row.entityId}:${channel}`;
    let agg = byKey.get(key);
    if (!agg) {
      agg = {
        entityId: row.entityId,
        entityType: row.entityType,
        channel,
        revenueCents: 0,
        costCents: 0,
        roiPct: null,
      };
      byKey.set(key, agg);
    }
    if ((REVENUE_EVENT_TYPES as readonly string[]).includes(row.eventType)) {
      agg.revenueCents += row.valueCents;
    } else if (row.eventType === COST_EVENT_TYPE) {
      agg.costCents += row.valueCents;
    }
  }

  const result = [...byKey.values()];
  for (const agg of result) {
    agg.roiPct = computeRoi(agg.revenueCents, agg.costCents);
  }

  result.sort((a, b) => {
    const ar = a.roiPct === null ? Number.NEGATIVE_INFINITY : a.roiPct;
    const br = b.roiPct === null ? Number.NEGATIVE_INFINITY : b.roiPct;
    if (br !== ar) return br - ar;
    if (b.revenueCents !== a.revenueCents) return b.revenueCents - a.revenueCents;
    if (a.entityId < b.entityId) return -1;
    if (a.entityId > b.entityId) return 1;
    return 0;
  });

  return result;
}
