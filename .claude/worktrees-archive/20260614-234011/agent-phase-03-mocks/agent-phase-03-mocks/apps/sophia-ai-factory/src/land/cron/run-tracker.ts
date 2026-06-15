/**
 * Cron Run Tracker
 * Provides idempotency guards and observability for scheduled cron jobs.
 * Uses D1 cron_run_log table (migration 0026).
 */

import { logger } from '@/seed/utils/logger-utility';
import { toError } from '@/seed/utils/to-error';

export type CronStatus = 'success' | 'failure' | 'skipped';

export interface CronRunRecord {
  cron_name: string;
  last_run_at: number;
  last_status: string;
  last_error: string | null;
  run_count: number;
}

/**
 * Record a cron job execution result into cron_run_log.
 * Upserts: updates on existing row, inserts on first run.
 */
export async function recordCronRun(
  db: D1Database,
  cronName: string,
  status: CronStatus,
  error?: string
): Promise<void> {
  const nowSec = Math.floor(Date.now() / 1000);
  const errorVal = error ?? null;

  try {
    await db
      .prepare(
        `INSERT INTO cron_run_log (cron_name, last_run_at, last_status, last_error, run_count)
         VALUES (?1, ?2, ?3, ?4, 1)
         ON CONFLICT(cron_name) DO UPDATE SET
           last_run_at = excluded.last_run_at,
           last_status = excluded.last_status,
           last_error  = excluded.last_error,
           run_count   = cron_run_log.run_count + 1`
      )
      .bind(cronName, nowSec, status, errorVal)
      .run();
  } catch (err) {
    logger.error('cron-run-tracker: recordCronRun failed', toError(err), { cronName, status });
  }
}

/**
 * Idempotency guard: returns true if cron ran within the given window.
 * Prevents double-execution when the same cron fires twice rapidly.
 */
export async function wasRecentlyRun(
  db: D1Database,
  cronName: string,
  withinMs: number
): Promise<boolean> {
  const thresholdSec = Math.floor((Date.now() - withinMs) / 1000);

  try {
    const row = await db
      .prepare(
        `SELECT last_run_at FROM cron_run_log
         WHERE cron_name = ?1 AND last_run_at >= ?2
         LIMIT 1`
      )
      .bind(cronName, thresholdSec)
      .first<{ last_run_at: number }>();

    return row !== null;
  } catch (err) {
    logger.error('cron-run-tracker: wasRecentlyRun failed', toError(err), { cronName });
    // Fail CLOSED — if DB is unavailable, assume cron already ran to prevent double-execution
    return true;
  }
}

/**
 * Health check helper: returns the latest run record for a cron job.
 * Used by /api/health to surface cron observability data.
 */
export async function getCronHealth(
  db: D1Database,
  cronName: string
): Promise<CronRunRecord | null> {
  try {
    const row = await db
      .prepare(
        `SELECT cron_name, last_run_at, last_status, last_error, run_count
         FROM cron_run_log
         WHERE cron_name = ?1
         LIMIT 1`
      )
      .bind(cronName)
      .first<CronRunRecord>();

    return row ?? null;
  } catch (err) {
    logger.error('cron-run-tracker: getCronHealth failed', toError(err), { cronName });
    return null;
  }
}
