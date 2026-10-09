/**
 * Fair-Share GPU Scheduler: Two-Lane Lease Arbitration Service
 *
 * Implements atomic CAS lease acquisition and fair-share queue priority.
 *
 * Layer: tree/queue (Domain services & algorithms)
 *
 * @module tree/queue/scheduler/lease-service
 */

import type { D1Database } from '@/seed/db/client';
import type {
  VideoRenderRow,
  SchedulerConfig,
  LeaseJobResult,
  QueueLane,
} from '@/seed/types/video-render-queue';
import {
  DEFAULT_SCHEDULER_CONFIG,
  mapRowToJob,
} from '@/seed/types/video-render-queue';
import { logger } from '@/seed/utils/logger-utility';
import { recoverExpiredLeases } from './lease-recovery';
import {
  getTenantsActiveRenderCounts,
  getTenantConcurrencyLimit,
} from './tenant-concurrency';

/**
 * Lease the next available job for a worker using atomic CAS and fair-share arbitration
 */
export async function leaseNextJob(
  db: D1Database,
  workerId: string,
  leaseDurationSeconds = 60,
  lanePreference?: QueueLane,
  customConfig?: Partial<SchedulerConfig>,
): Promise<LeaseJobResult> {
  const config: SchedulerConfig = { ...DEFAULT_SCHEDULER_CONFIG, ...customConfig };
  const now = Math.floor(Date.now() / 1000);
  const leasedUntil = now + (leaseDurationSeconds || config.defaultLeaseDurationSeconds || 60);

  // Step 1: Recover any expired leases
  await recoverExpiredLeases(db, now);

  // Step 2: Determine lane order based on preference or fair-share
  const lanesToScan: QueueLane[] = lanePreference
    ? [lanePreference, lanePreference === 'priority' ? 'standard' : 'priority']
    : ['priority', 'standard'];

  let throttledCount = 0;

  for (const lane of lanesToScan) {
    const candidates = await db
      .prepare(
        `SELECT * FROM video_render_jobs
         WHERE lane = ? AND (
           status = 'queued' OR
           (status = 'leased' AND leased_until < ?)
         )
         ORDER BY priority_score DESC, created_at ASC
         LIMIT 25`,
      )
      .bind(lane, now)
      .all<VideoRenderRow>();

    const rows = candidates.results ?? [];
    if (rows.length === 0) {
      continue;
    }

    // Batch query active render counts for all candidates in this lane
    const orgIds = rows.map((r) => r.org_id);
    const tenantActiveCounts = await getTenantsActiveRenderCounts(db, orgIds, now);

    for (const candidate of rows) {
      // Step 3: Check tenant concurrency limits
      const activeCount = tenantActiveCounts.get(candidate.org_id) ?? 0;
      const tenantLimit = getTenantConcurrencyLimit(candidate.tier, config);

      if (activeCount >= tenantLimit) {
        throttledCount++;
        continue;
      }

      // Step 4: Atomic CAS lease update
      const updateResult = await db
        .prepare(
          `UPDATE video_render_jobs
           SET status = 'leased',
               leased_by = ?,
               leased_until = ?,
               updated_at = ?
           WHERE id = ? AND (
             status = 'queued' OR
             (status = 'leased' AND leased_until < ?)
           )`,
        )
        .bind(workerId, leasedUntil, now, candidate.id, now)
        .run();

      const changes = updateResult.meta?.changes ?? 0;
      if (changes > 0) {
        const leasedRow: VideoRenderRow = {
          ...candidate,
          status: 'leased',
          leased_by: workerId,
          leased_until: leasedUntil,
          updated_at: now,
        };
        const leasedJob = mapRowToJob(leasedRow);

        logger.info(
          `[gpu-scheduler] Worker ${workerId} leased job ${candidate.id} (lane=${lane}, score=${candidate.priority_score})`,
        );

        return {
          leased: true,
          job: leasedJob,
        };
      }
      // CAS contention: another worker claimed it, continue search
    }
  }

  if (throttledCount > 0) {
    return {
      leased: false,
      reason: 'TENANT_CONCURRENCY_LIMIT',
    };
  }

  return {
    leased: false,
    reason: 'NO_JOBS',
  };
}
