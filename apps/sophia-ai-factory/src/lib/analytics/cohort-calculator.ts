/**
 * Cohort retention calculator.
 *
 * Groups users by signup month (cohort) and calculates retention percentage
 * at each subsequent month using usage_logs activity as the retention signal.
 *
 * "Active" definition: user had ≥1 usage_log entry in that month window.
 * NULL created_at → bucketed as "unknown" cohort (pre-migration users).
 */

import { logger } from '@/lib/utils/logger-utility';
import type { CohortRow, CohortRetentionMatrix } from '@/types/analytics-cohort';

// ── D1 row types ─────────────────────────────────────────────────────────────

interface UserSignupRow {
  user_id: string;
  cohort_month: string; // YYYY-MM or "unknown"
}

interface ActivityRow {
  user_id: string;
  activity_month: string; // YYYY-MM
}

// ── Helpers ───────────────────────────────────────────────────────────────────

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
function addMonths(yyyyMM: string, n: number): string {
  const [yearStr, monthStr] = yyyyMM.split('-');
  const d = new Date(parseInt(yearStr, 10), parseInt(monthStr, 10) - 1 + n, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

/** Current YYYY-MM */
function currentMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

// ── Core function ─────────────────────────────────────────────────────────────

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
  const signupResult = await db
    .prepare(`
      SELECT
        id AS user_id,
        CASE
          WHEN created_at IS NULL THEN 'unknown'
          ELSE strftime('%Y-%m', created_at)
        END AS cohort_month
      FROM users
      ORDER BY cohort_month ASC
    `)
    .all<UserSignupRow>();

  const signupRows = signupResult.results ?? [];
  if (signupRows.length === 0) {
    return { cohorts: [], monthsTracked: clampedMonths };
  }

  // ── Step 2: user activity months from usage_logs (org_id maps to user_id) ──
  const activityResult = await db
    .prepare(`
      SELECT
        org_id AS user_id,
        strftime('%Y-%m', created_at) AS activity_month
      FROM usage_logs
      GROUP BY org_id, activity_month
    `)
    .all<ActivityRow>();

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
    const usersAtStart = userIds.length;
    const retentionByMonth: number[] = [100]; // Month 0 = 100%

    for (let offset = 1; offset <= clampedMonths; offset++) {
      if (cohortMonth === 'unknown') {
        retentionByMonth.push(0);
        continue;
      }
      const targetMonth = addMonths(cohortMonth, offset);
      if (targetMonth > nowMonth) break; // Future — not measurable yet

      const active = userIds.filter(uid => userActivity.get(uid)?.has(targetMonth)).length;
      const pct = usersAtStart > 0
        ? Math.round((active / usersAtStart) * 10_000) / 100
        : 0;
      retentionByMonth.push(pct);
    }

    cohorts.push({ cohortMonth, usersAtStart, retentionByMonth });
  }

  logger.info('[CohortCalculator] Built retention matrix', {
    cohortCount: cohorts.length,
    monthsTracked: clampedMonths,
  });

  return { cohorts, monthsTracked: clampedMonths };
}
