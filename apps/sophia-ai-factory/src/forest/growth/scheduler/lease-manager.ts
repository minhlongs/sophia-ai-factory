/**
 * @file lease-manager.ts
 * @description Atomic CAS lease management for pending compute jobs in D1 SQLite.
 * @layer forest
 */

import type { D1Database, D1Result } from '@cloudflare/workers-types';
import { success, failure, type Result } from '@/seed/types/result';
import { logger } from '@/seed/utils/logger-utility';
import { isOffPeakUtcHour } from '@/tree/growth-v11/compute-arbitrage';
import type {
  ComputeJobRow,
  ComputeJobRecord,
  LeaseOptions,
  SchedulerError,
} from './types';
import { getDatabase, mapRowToRecord } from './time-window-resolver';

/**
 * Leases pending jobs atomically using Compare-And-Swap (CAS) in D1 SQLite.
 * Handles stale leases past leaseDurationSec.
 */
export async function leasePendingJobs(
  db: D1Database,
  options?: LeaseOptions
): Promise<Result<ComputeJobRecord[], SchedulerError>> {
  const activeDb = getDatabase(db);
  const now = options?.currentDate ?? new Date();
  const nowSec = Math.floor(now.getTime() / 1000);
  const limit = options?.limit ?? 10;
  const leaseDurationSec = options?.leaseDurationSec ?? 300;
  const staleLeaseCutoffSec = nowSec - leaseDurationSec;
  const offPeak = isOffPeakUtcHour(now.getUTCHours());

  try {
    let candidateQuery: string;
    let candidates: ComputeJobRow[] = [];

    if (offPeak) {
      candidateQuery = `
        SELECT * FROM growth_v11_compute_jobs
        WHERE (
          status = 'PENDING'
          OR (status = 'QUEUED' AND is_off_peak = 1 AND earliest_execution_sec <= ?)
          OR (status = 'LEASED' AND updated_at < ?)
        )
        ORDER BY velocity_score DESC, created_at ASC
        LIMIT ?
      `;
      const res = await activeDb
        .prepare(candidateQuery)
        .bind(nowSec, staleLeaseCutoffSec, limit)
        .all<ComputeJobRow>();
      candidates = res.results || [];
    } else {
      candidateQuery = `
        SELECT * FROM growth_v11_compute_jobs
        WHERE (
          (status = 'PENDING' AND priority != 'OFF_PEAK_ECONOMIC')
          OR (status = 'LEASED' AND priority != 'OFF_PEAK_ECONOMIC' AND updated_at < ?)
        )
        ORDER BY velocity_score DESC, created_at ASC
        LIMIT ?
      `;
      const res = await activeDb
        .prepare(candidateQuery)
        .bind(staleLeaseCutoffSec, limit)
        .all<ComputeJobRow>();
      candidates = res.results || [];
    }

    const leasedRecords: ComputeJobRecord[] = [];

    for (const candidate of candidates) {
      const updateQuery = `
        UPDATE growth_v11_compute_jobs
        SET status = 'LEASED', updated_at = ?
        WHERE id = ? AND (
          status IN ('PENDING', 'QUEUED')
          OR (status = 'LEASED' AND updated_at < ?)
        )
      `;

      const updateRes: D1Result = await activeDb
        .prepare(updateQuery)
        .bind(nowSec, candidate.id, staleLeaseCutoffSec)
        .run();

      const changes = updateRes.meta?.changes ?? 0;
      if (changes > 0) {
        candidate.status = 'LEASED';
        candidate.updated_at = nowSec;
        leasedRecords.push(mapRowToRecord(candidate));
      }
    }

    return success(leasedRecords);
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    logger.error('[OpportunisticScheduler] Failed to lease pending jobs', { error: errorMsg });
    return failure({
      code: 'LEASE_FAILED',
      message: `Failed to lease pending compute jobs: ${errorMsg}`,
    });
  }
}
