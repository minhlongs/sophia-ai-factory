/**
 * @file batch-coordinator.ts
 * @description Batch queue coordination and status lifecycle in D1 SQLite.
 * @layer forest
 */

import type { D1Database } from '@cloudflare/workers-types';
import { success, failure, type Result } from '@/seed/types/result';
import { logger } from '@/seed/utils/logger-utility';
import { isOffPeakUtcHour } from '@/tree/growth-v11/compute-arbitrage';
import type {
  QueueCoordinationResult,
  SchedulerError,
} from './types';
import { getDatabase } from './time-window-resolver';
import { leasePendingJobs } from './lease-manager';

export { updateJobStatus } from './job-status-updater';

/**
 * Coordinates batch queues in D1 SQLite:
 * 1. Inspects current UTC hour.
 * 2. Promotes due off-peak jobs if in window.
 * 3. Atomically leases eligible jobs.
 * 4. Dispatches high-velocity renders immediately.
 */
export async function coordinateBatchQueue(
  db: D1Database,
  options?: { currentDate?: Date; batchLimit?: number }
): Promise<Result<QueueCoordinationResult, SchedulerError>> {
  const activeDb = getDatabase(db);
  const now = options?.currentDate ?? new Date();
  const nowSec = Math.floor(now.getTime() / 1000);
  const currentHourUtc = now.getUTCHours();
  const isOffPeak = isOffPeakUtcHour(currentHourUtc);
  const limit = options?.batchLimit ?? 20;

  let promotedCount = 0;

  try {
    if (isOffPeak) {
      const promoteQuery = `
        UPDATE growth_v11_compute_jobs
        SET status = 'PENDING', updated_at = ?
        WHERE status = 'QUEUED' AND is_off_peak = 1 AND earliest_execution_sec <= ?
      `;
      const promoteRes = await activeDb.prepare(promoteQuery).bind(nowSec, nowSec).run();
      promotedCount = promoteRes.meta?.changes ?? 0;
      if (promotedCount > 0) {
        logger.info('[OpportunisticScheduler] Promoted off-peak jobs to PENDING', { promotedCount });
      }
    }

    const leaseResult = await leasePendingJobs(activeDb, {
      currentDate: now,
      limit,
    });

    if (!leaseResult.ok) {
      return failure(leaseResult.error);
    }

    const leasedJobs = leaseResult.value;
    let dispatchedCount = 0;

    for (const job of leasedJobs) {
      if (job.priority === 'IMMEDIATE_PREMIUM' || job.velocityScore >= 75 || isOffPeak) {
        await activeDb
          .prepare("UPDATE growth_v11_compute_jobs SET status = 'DISPATCHED', updated_at = ? WHERE job_id = ?")
          .bind(nowSec, job.jobId)
          .run();
        job.status = 'DISPATCHED';
        job.updatedAt = nowSec;
        dispatchedCount++;
      }
    }

    const queuedCountRes = await activeDb
      .prepare("SELECT COUNT(*) as count FROM growth_v11_compute_jobs WHERE status = 'QUEUED'")
      .bind()
      .first<{ count: number }>();
    const heldInQueueCount = queuedCountRes?.count ?? 0;

    const summary = isOffPeak
      ? `Off-peak window [02:00-08:00 UTC] active. Promoted ${promotedCount}, leased ${leasedJobs.length}, dispatched ${dispatchedCount}.`
      : `Peak hours active (${currentHourUtc}:00 UTC). Immediate high-velocity dispatched: ${dispatchedCount}, off-peak held in queue: ${heldInQueueCount}.`;

    return success({
      isOffPeak,
      currentHourUtc,
      promotedCount,
      leasedCount: leasedJobs.length,
      dispatchedCount,
      heldInQueueCount,
      leasedJobs,
      summary,
    });
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    logger.error('[OpportunisticScheduler] Batch queue coordination failed', { error: errorMsg });
    return failure({
      code: 'COORDINATION_FAILED',
      message: `Failed to coordinate compute queue: ${errorMsg}`,
    });
  }
}
