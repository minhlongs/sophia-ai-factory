/**
 * Churn calculator.
 *
 * Reads tier_change_events table to build a churn timeline.
 * Distinguishes cancelled (to_tier = null) vs downgraded (lower tier rank).
 *
 * Churn rate = churned_users / active_users_at_start_of_period.
 * "Active at start" approximated from raas_licenses count at period start.
 */

import { logger } from '@/seed/utils/logger-utility';
import type { ChurnEvent, ChurnTimeline, ChurnTimelinePoint } from '@/seed/types/analytics-cohort';

// ── Tier rank for downgrade detection ────────────────────────────────────────

const TIER_RANK: Record<string, number> = {
  BASIC: 1,
  PREMIUM: 2,
  ENTERPRISE: 3,
  MASTER: 4,
};

function isDowngrade(fromTier: string | null, toTier: string | null): boolean {
  if (!fromTier || !toTier) return false;
  const from = TIER_RANK[fromTier.toUpperCase()] ?? 0;
  const to = TIER_RANK[toTier.toUpperCase()] ?? 0;
  return to < from && to > 0;
}

// ── D1 row types ─────────────────────────────────────────────────────────────

interface TierChangeRow {
  user_id: string;
  from_tier: string | null;
  to_tier: string | null;
  event_type: string;
  created_at: string;
}

interface LicenseCountRow {
  active_count: number;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Group events by YYYY-MM-DD date string */
function groupByDate(events: ChurnEvent[]): Map<string, ChurnEvent[]> {
  const map = new Map<string, ChurnEvent[]>();
  for (const e of events) {
    const day = e.eventDate.slice(0, 10);
    if (!map.has(day)) map.set(day, []);
    map.get(day)!.push(e);
  }
  return map;
}

// ── Core function ─────────────────────────────────────────────────────────────

/**
 * Fetch churn timeline from D1 tier_change_events table.
 *
 * @param db      - D1Database binding
 * @param days    - Lookback window in days (default 90)
 */
export async function fetchChurnTimeline(
  db: D1Database,
  days = 90,
): Promise<ChurnTimeline> {
  const clampedDays = Math.min(Math.max(days, 7), 365);
  const windowStart = new Date(Date.now() - clampedDays * 86_400_000).toISOString();

  // ── Step 1: load tier change events in window ──
  const eventsResult = await db
    .prepare(`
      SELECT user_id, from_tier, to_tier, event_type, created_at
      FROM tier_change_events
      WHERE created_at >= ?
      ORDER BY created_at ASC
    `)
    .bind(windowStart)
    .all<TierChangeRow>();

  const rows = eventsResult.results ?? [];

  // ── Step 2: classify events ──
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

  // ── Step 3: count active licenses at start of window ──
  const licenseResult = await db
    .prepare(`
      SELECT COUNT(*) AS active_count
      FROM raas_licenses
      WHERE is_revoked = 0 AND created_at <= ?
    `)
    .bind(windowStart)
    .first<LicenseCountRow>();

  const baseActiveCount = licenseResult?.active_count ?? 0;

  // ── Step 4: build timeline points (monthly buckets) ──
  const allEvents = [...cancellations, ...downgrades];
  const byDate = groupByDate(allEvents);
  const cancelsByDate = groupByDate(cancellations);
  const downgradesByDate = groupByDate(downgrades);

  const points: ChurnTimelinePoint[] = [];
  let runningActive = baseActiveCount;

  const sortedDates = Array.from(
    new Set(Array.from(byDate.keys())),
  ).sort();

  for (const date of sortedDates) {
    const churnedCount = cancelsByDate.get(date)?.length ?? 0;
    const downgradedCount = downgradesByDate.get(date)?.length ?? 0;
    const activeAtStart = Math.max(runningActive, 0);
    const churnRate = activeAtStart > 0
      ? Math.round((churnedCount / activeAtStart) * 10_000) / 100
      : 0;

    points.push({ date, churnedCount, downgradedCount, activeAtStart, churnRate });
    runningActive = Math.max(runningActive - churnedCount, 0);
  }

  const avgMonthlyChurnRate = points.length > 0
    ? Math.round((points.reduce((s, p) => s + p.churnRate, 0) / points.length) * 100) / 100
    : 0;

  logger.info('[ChurnCalculator] Built churn timeline', {
    events: rows.length,
    cancellations: cancellations.length,
    downgrades: downgrades.length,
  });

  return { points, avgMonthlyChurnRate, downgrades, cancellations };
}
