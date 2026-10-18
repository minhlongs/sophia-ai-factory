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
import type { ChurnTimeline } from '@/seed/types/analytics-cohort';
import {
  buildChurnTimelinePoints,
  classifyTierChangeRows,
  type LicenseCountRow,
  type TierChangeRow,
} from './churn-calculator-helpers';

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
  const { cancellations, downgrades } = classifyTierChangeRows(rows);

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
  const { points, avgMonthlyChurnRate } = buildChurnTimelinePoints(
    cancellations,
    downgrades,
    baseActiveCount,
  );

  logger.info('[ChurnCalculator] Built churn timeline', {
    events: rows.length,
    cancellations: cancellations.length,
    downgrades: downgrades.length,
  });

  return { points, avgMonthlyChurnRate, downgrades, cancellations };
}
