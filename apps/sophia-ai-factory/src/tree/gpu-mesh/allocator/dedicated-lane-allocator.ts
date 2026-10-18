/**
 * Dedicated Enterprise GPU Lane Allocator & Arbitration Service
 *
 * Layer: tree/gpu-mesh/allocator
 */

import type { D1Database } from '@/seed/db/client';
import type { LaneAllocationResult } from '@/seed/types/gpu-mesh';
import { GPU_MESH_SLA_CONFIG } from '@/seed/config/gpu-mesh';
import { logger } from '@/seed/utils/logger-utility';
import type { AllocateLaneOptions } from './types';
import {
  applyDedicatedLaneUpgradeAndConsumeMcu,
  releaseDedicatedLane,
} from './dedicated-lane-sql';
import { verifyReservationEligibility } from './allocation-validator';

export { releaseDedicatedLane };

/**
 * Allocate a dedicated GPU lane for a job, elevating its priority to 300,
 * linking it to the enterprise reservation, and applying concurrency limits.
 */
export async function allocateDedicatedLane(
  db: D1Database,
  jobId: string,
  reservationId: string,
  options: AllocateLaneOptions = {},
): Promise<LaneAllocationResult> {
  const now = options.nowSeconds ?? Math.floor(Date.now() / 1000);
  const requestedMcu = options.requestedMcu ?? 0;

  const eligibility = await verifyReservationEligibility({
    db,
    jobId,
    reservationId,
    requestedMcu,
    now,
  });

  if (!eligibility.eligible) {
    return eligibility.failureResult;
  }

  const { reservation, activeCount } = eligibility;
  const targetRegion = options.targetRegion ?? reservation.primaryRegion;
  const priorityScore =
    reservation.priorityScore || GPU_MESH_SLA_CONFIG.dedicatedLanePriorityScore;

  try {
    const updated = await applyDedicatedLaneUpgradeAndConsumeMcu({
      db,
      jobId,
      reservationId: reservation.id,
      priorityScore,
      targetRegion,
      requestedMcu,
      now,
    });

    if (!updated) {
      return {
        success: false,
        jobId,
        reservationId,
        lane: 'priority',
        priorityScore,
        reason: 'FAILED_TO_UPDATE_JOB',
      };
    }

    logger.info('[gpu-mesh] Allocated dedicated enterprise lane', {
      jobId,
      reservationId: reservation.id,
      laneId: reservation.laneId,
      priorityScore,
      targetRegion,
      activeJobs: activeCount + 1,
      concurrencyLimit: reservation.concurrencyLimit,
    });

    return {
      success: true,
      jobId,
      reservationId: reservation.id,
      lane: 'priority',
      priorityScore,
      allocatedRegion: targetRegion,
      activeJobs: activeCount + 1,
      concurrencyLimit: reservation.concurrencyLimit,
    };
  } catch (error) {
    logger.error('[gpu-mesh] Error allocating dedicated lane', {
      jobId,
      reservationId,
      error: String(error),
    });
    return {
      success: false,
      jobId,
      reservationId,
      lane: 'priority',
      priorityScore,
      reason: 'INTERNAL_ALLOCATION_ERROR',
    };
  }
}
