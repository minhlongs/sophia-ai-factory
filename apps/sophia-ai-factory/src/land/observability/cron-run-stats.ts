/**
 * Cron run observability — list every scheduled job's last execution.
 *
 * Reads `cron_run_log` (migration 0026) which `recordCronRun` upserts after
 * every cron tick. One row per cron_name; tracks last_run_at, last_status,
 * last_error, run_count.
 *
 * Used by the admin monitor page + status checks. Tenant-agnostic (admin scope).
 *
 * @module land/observability/cron-run-stats
 */

import { getD1 } from '@/seed/db/client';

export type CronStatus = 'success' | 'failure' | 'skipped';

export interface CronRunSummary {
  cronName: string;
  lastRunAt: number;
  lastStatus: CronStatus;
  lastError: string | null;
  runCount: number;
  /** Seconds since last_run_at, computed at call time. */
  ageSec: number;
}

interface CronRowRaw {
  cron_name: string;
  last_run_at: number;
  last_status: string;
  last_error: string | null;
  run_count: number;
}

/** All cron rows ordered by most recent run first. */
export async function listCronRunSummaries(): Promise<CronRunSummary[]> {
  const db = await getD1();
  if (!db) throw new Error('D1 database binding not available');
  const result = await db
    .prepare(
      `SELECT cron_name, last_run_at, last_status, last_error, run_count
       FROM cron_run_log
       ORDER BY last_run_at DESC`,
    )
    .all<CronRowRaw>();

  const nowSec = Math.floor(Date.now() / 1000);
  return (result.results ?? []).map((r) => ({
    cronName: r.cron_name,
    lastRunAt: Number(r.last_run_at),
    lastStatus: (r.last_status as CronStatus) ?? 'success',
    lastError: r.last_error,
    runCount: Number(r.run_count),
    ageSec: nowSec - Number(r.last_run_at),
  }));
}
