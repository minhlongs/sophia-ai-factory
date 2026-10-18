/**
 * Cohort retention calculator.
 *
 * Groups users by signup month (cohort) and calculates retention percentage
 * at each subsequent month using usage_logs activity as the retention signal.
 *
 * "Active" definition: user had ≥1 usage_log entry in that month window.
 * NULL created_at → bucketed as "unknown" cohort (pre-migration users).
 */

import { logger } from '@/seed/utils/logger-utility';
import type { CohortRow, CohortRetentionMatrix } from '@/seed/types/analytics-cohort';
import {
  getD1Database,
  currentMonth,
  computeCohortRow,
  SELECT_USER_SIGNUPS_SQL,
  SELECT_USER_ACTIVITY_SQL,
  type UserSignupRow,
  type ActivityRow,
} from './cohort-calculator-helpers';

export { getD1Database };

/**
 * Fetch cohort retention matrix from D1.
 *
 * @param db     - D1Database binding (injected for testability)
 * @param months - Subsequent months to track (1–24, default 12)
 */
export async function fetchCohortRetention(
  db: D1Database,
  months = 12,
): Promise<CohortRetentionMatrix> {
  const clampedMonths = Math.min(Math.max(months, 1), 24);
  const nowMonth = currentMonth();

  // ── Step 1: all users with cohort month ──
  const signupResult = await db.prepare(SELECT_USER_SIGNUPS_SQL).all<UserSignupRow>();

  const signupRows = signupResult.results ?? [];
  if (signupRows.length === 0) {
    return { cohorts: [], monthsTracked: clampedMonths };
  }

  // ── Step 2: user activity months from usage_logs (org_id maps to user_id) ──
  const activityResult = await db.prepare(SELECT_USER_ACTIVITY_SQL).all<ActivityRow>();

  // user_id → Set<activity_month>
  const userActivity = new Map<string, Set<string>>();
  for (const row of activityResult.results ?? []) {
    if (!userActivity.has(row.user_id)) userActivity.set(row.user_id, new Set());
    userActivity.get(row.user_id)!.add(row.activity_month);
  }

  // ── Step 3: group users by cohort month ──
  const cohortMap = new Map<string, string[]>();
  for (const row of signupRows) {
    if (!cohortMap.has(row.cohort_month)) cohortMap.set(row.cohort_month, []);
    cohortMap.get(row.cohort_month)!.push(row.user_id);
  }

  // ── Step 4: calculate retention per cohort ──
  const cohorts: CohortRow[] = [];

  for (const [cohortMonth, userIds] of cohortMap.entries()) {
    cohorts.push(computeCohortRow(cohortMonth, userIds, userActivity, clampedMonths, nowMonth));
  }

  logger.info('[CohortCalculator] Built retention matrix', {
    cohortCount: cohorts.length,
    monthsTracked: clampedMonths,
  });

  return { cohorts, monthsTracked: clampedMonths };
}
