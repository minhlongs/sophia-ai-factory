/**
 * Churn calculator classification and timeline aggregation helpers.
 */

import type { ChurnEvent, ChurnTimelinePoint } from '@/seed/types/analytics-cohort';

const TIER_RANK: Record<string, number> = {
  BASIC: 1,
  PREMIUM: 2,
  ENTERPRISE: 3,
  MASTER: 4,
};

export interface TierChangeRow {
  user_id: string;
  from_tier: string | null;
  to_tier: string | null;
  event_type: string;
  created_at: string;
}

export interface LicenseCountRow {
  active_count: number;
}

export function isDowngrade(fromTier: string | null, toTier: string | null): boolean {
  if (!fromTier || !toTier) return false;
  const from = TIER_RANK[fromTier.toUpperCase()] ?? 0;
  const to = TIER_RANK[toTier.toUpperCase()] ?? 0;
  return to < from && to > 0;
}

/** Group events by YYYY-MM-DD date string */
export function groupByDate(events: ChurnEvent[]): Map<string, ChurnEvent[]> {
  const map = new Map<string, ChurnEvent[]>();
  for (const e of events) {
    const day = e.eventDate.slice(0, 10);
    if (!map.has(day)) map.set(day, []);
    map.get(day)!.push(e);
  }
  return map;
}

export function classifyTierChangeRows(rows: TierChangeRow[]): {
  cancellations: ChurnEvent[];
  downgrades: ChurnEvent[];
} {
  const cancellations: ChurnEvent[] = [];
  const downgrades: ChurnEvent[] = [];

  for (const row of rows) {
    const event: ChurnEvent = {
      userId: row.user_id,
      fromTier: row.from_tier,
      toTier: row.to_tier,
      eventDate: row.created_at,
      eventType: row.event_type as ChurnEvent['eventType'],
    };

    if (row.event_type === 'cancel' || row.to_tier === null) {
      cancellations.push(event);
    } else if (row.event_type === 'downgrade' || isDowngrade(row.from_tier, row.to_tier)) {
      downgrades.push(event);
    }
  }

  return { cancellations, downgrades };
}

export function buildChurnTimelinePoints(
  cancellations: ChurnEvent[],
  downgrades: ChurnEvent[],
  baseActiveCount: number,
): { points: ChurnTimelinePoint[]; avgMonthlyChurnRate: number } {
  const allEvents = [...cancellations, ...downgrades];
  const byDate = groupByDate(allEvents);
  const cancelsByDate = groupByDate(cancellations);
  const downgradesByDate = groupByDate(downgrades);

  const points: ChurnTimelinePoint[] = [];
  let runningActive = baseActiveCount;

  const sortedDates = Array.from(new Set(Array.from(byDate.keys()))).sort();

  for (const date of sortedDates) {
    const churnedCount = cancelsByDate.get(date)?.length ?? 0;
    const downgradedCount = downgradesByDate.get(date)?.length ?? 0;
    const activeAtStart = Math.max(runningActive, 0);
    const churnRate =
      activeAtStart > 0 ? Math.round((churnedCount / activeAtStart) * 10_000) / 100 : 0;

    points.push({ date, churnedCount, downgradedCount, activeAtStart, churnRate });
    runningActive = Math.max(runningActive - churnedCount, 0);
  }

  const avgMonthlyChurnRate =
    points.length > 0
      ? Math.round((points.reduce((s, p) => s + p.churnRate, 0) / points.length) * 100) / 100
      : 0;

  return { points, avgMonthlyChurnRate };
}
