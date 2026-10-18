/**
 * Cohort retention helpers, D1 row types, and date math utilities.
 *
 * @module land/analytics/cohort-calculator-helpers
 */

import type { CohortRow } from '@/seed/types/analytics-cohort';

export interface UserSignupRow {
  user_id: string;
  cohort_month: string; // YYYY-MM or "unknown"
}

export interface ActivityRow {
  user_id: string;
  activity_month: string; // YYYY-MM
}

export const SELECT_USER_SIGNUPS_SQL = `
  SELECT
    id AS user_id,
    CASE
      WHEN created_at IS NULL THEN 'unknown'
      ELSE strftime('%Y-%m', created_at)
    END AS cohort_month
  FROM users
  ORDER BY cohort_month ASC
`;

export const SELECT_USER_ACTIVITY_SQL = `
  SELECT
    org_id AS user_id,
    strftime('%Y-%m', created_at) AS activity_month
  FROM usage_logs
  GROUP BY org_id, activity_month
`;

/** Get D1Database binding from globalThis (CF Workers runtime) */
export function getD1Database(): D1Database {
  const env = (globalThis as unknown as Record<string, Record<string, unknown>>).__env;
  if (env?.DB) return env.DB as D1Database;
  const sym = Symbol.for('__cloudflare-context__');
  const ctx = (globalThis as Record<symbol, { env?: Record<string, unknown> }>)[sym];
  if (ctx?.env?.DB) return ctx.env.DB as D1Database;
  const globalDb = (globalThis as Record<string, unknown>).__D1_DB as D1Database | undefined;
  if (globalDb) return globalDb;
  throw new Error('D1 binding unavailable');
}

/** Add N months to a YYYY-MM string, returns YYYY-MM */
export function addMonths(yyyyMM: string, n: number): string {
  const [yearStr, monthStr] = yyyyMM.split('-');
  const d = new Date(parseInt(yearStr, 10), parseInt(monthStr, 10) - 1 + n, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

/** Current YYYY-MM */
export function currentMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

/** Calculate retention row for a single cohort */
export function computeCohortRow(
  cohortMonth: string,
  userIds: string[],
  userActivity: Map<string, Set<string>>,
  clampedMonths: number,
  nowMonth: string,
): CohortRow {
  const usersAtStart = userIds.length;
  const retentionByMonth: number[] = [100]; // Month 0 = 100%

  for (let offset = 1; offset <= clampedMonths; offset++) {
    if (cohortMonth === 'unknown') {
      retentionByMonth.push(0);
      continue;
    }
    const targetMonth = addMonths(cohortMonth, offset);
    if (targetMonth > nowMonth) break; // Future — not measurable yet

    const active = userIds.filter((uid) => userActivity.get(uid)?.has(targetMonth)).length;
    const pct = usersAtStart > 0 ? Math.round((active / usersAtStart) * 10_000) / 100 : 0;
    retentionByMonth.push(pct);
  }

  return { cohortMonth, usersAtStart, retentionByMonth };
}
