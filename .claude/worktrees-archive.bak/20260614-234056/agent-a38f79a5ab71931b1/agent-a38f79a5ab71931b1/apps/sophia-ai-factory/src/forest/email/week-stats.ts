/**
 * Compute first-week stats for D+7 email.
 * @module lib/email/week-stats
 */

import type { WeekStats } from './templates/first-week-summary';

interface RunRow {
  sop_slug: string | null;
  day: string;
}

/** Query usage_events / sop_executions for last 7d and return stats. */
export async function computeWeekStats(db: D1Database, userId: string): Promise<WeekStats> {
  const sevenDaysAgo = Math.floor(Date.now() / 1000) - 7 * 86400;

  // Use sop_executions as proxy for API calls
  const result = await db
    .prepare(
      `SELECT i.sop_slug, date(r.created_at, 'unixepoch') as day
       FROM sop_executions r
       JOIN user_sop_installations i ON r.installation_id = i.id
       WHERE i.user_id = ?1 AND r.created_at >= ?2
       LIMIT 1000`,
    )
    .bind(userId, sevenDaysAgo)
    .all<RunRow>()
    .catch(() => ({ results: [] as RunRow[] }));

  const rows = result.results ?? [];
  const totalCalls = rows.length;

  // Most common SOP
  const sopCounts = new Map<string, number>();
  const daySet = new Set<string>();
  for (const r of rows) {
    if (r.sop_slug) sopCounts.set(r.sop_slug, (sopCounts.get(r.sop_slug) ?? 0) + 1);
    if (r.day) daySet.add(r.day);
  }

  const topSop = sopCounts.size > 0
    ? [...sopCounts.entries()].sort((a, b) => b[1] - a[1])[0][0]
    : null;

  return {
    totalCalls,
    topSop,
    daysActive: daySet.size,
  };
}
