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
  SchedulerConfig,
  LeaseJobResult,
  QueueLane,
} from '@/seed/types/video-render-queue';
import { DEFAULT_SCHEDULER_CONFIG } from '@/seed/types/video-render-queue';
import { logger } from '@/seed/utils/logger-utility';
import { recoverExpiredLeases } from './lease-recovery';
import {
  getTenantsActiveRenderCounts,
  getTenantConcurrencyLimit,
} from './tenant-concurrency';
import {
  fetchLaneCandidates,
  tryAtomicLeaseCandidate,
} from './lease-candidate-sql';

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

  await recoverExpiredLeases(db, now);

  const lanesToScan: QueueLane[] = lanePreference
    ? [lanePreference, lanePreference === 'priority' ? 'standard' : 'priority']
    : ['priority', 'standard'];

  let throttledCount = 0;

  for (const lane of lanesToScan) {
    const rows = await fetchLaneCandidates(db, lane, now);
    if (rows.length === 0) {
      continue;
    }

    const orgIds = rows.map((r) => r.org_id);
    const tenantActiveCounts = await getTenantsActiveRenderCounts(db, orgIds, now);

    for (const candidate of rows) {
      const activeCount = tenantActiveCounts.get(candidate.org_id) ?? 0;
      const tenantLimit = getTenantConcurrencyLimit(candidate.tier, config);

      if (activeCount >= tenantLimit) {
        throttledCount++;
        continue;
      }

      const leasedJob = await tryAtomicLeaseCandidate(
        db,
        candidate,
        workerId,
        leasedUntil,
        now,
      );

      if (leasedJob) {
        logger.info(
          `[gpu-scheduler] Worker ${workerId} leased job ${candidate.id} (lane=${lane}, score=${candidate.priority_score})`,
        );

        return {
          leased: true,
          job: leasedJob,
        };
      }
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
