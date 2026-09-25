/**
 * Dedicated Enterprise GPU Lane Allocator & Arbitration Service
 *
 * Layer: tree/gpu-mesh (Domain services & pure algorithms)
 *
 * Implements:
 * - Dedicated lane isolation with priority score 300 (vs Master 200 / standard 100)
 * - Concurrency quota enforcement (default 20 concurrent jobs per enterprise reservation)
 * - Capacity reservation and MCU commitment validation (50K–500K MCU/month)
 * - Atomic job lane upgrade and D1 state synchronization
 *
 * @module tree/gpu-mesh/dedicated-lane-allocator
 */

import type { D1Database } from '@/seed/db/client';
import type {
  EnterpriseGpuReservation,
  EnterpriseGpuReservationRow,
  LaneAllocationResult,
  GpuMeshRegion,
} from '@/seed/types/gpu-mesh';
import { mapRowToReservation } from '@/seed/types/gpu-mesh';
import { GPU_MESH_SLA_CONFIG } from '@/seed/config/gpu-mesh';
import { logger } from '@/seed/utils/logger-utility';

/**
 * Fetch an enterprise GPU reservation by its primary ID
 */
export async function getReservationById(
  db: D1Database,
  reservationId: string,
): Promise<EnterpriseGpuReservation | null> {
  try {
    const row = await db
      .prepare('SELECT * FROM enterprise_gpu_reservations WHERE id = ?1 LIMIT 1')
      .bind(reservationId)
      .first<EnterpriseGpuReservationRow>();

    if (!row) return null;
    return mapRowToReservation(row);
  } catch (error) {
    logger.warn('[gpu-mesh] Error fetching reservation by ID', {
      reservationId,
      error: String(error),
    });
    return null;
  }
}

/**
 * Fetch an enterprise GPU reservation by its unique dedicated lane ID (e.g. 'lane_dedicated_ent_01')
 */
export async function getReservationByLaneId(
  db: D1Database,
  laneId: string,
): Promise<EnterpriseGpuReservation | null> {
  try {
    const row = await db
      .prepare('SELECT * FROM enterprise_gpu_reservations WHERE lane_id = ?1 LIMIT 1')
      .bind(laneId)
      .first<EnterpriseGpuReservationRow>();

    if (!row) return null;
    return mapRowToReservation(row);
  } catch (error) {
    logger.warn('[gpu-mesh] Error fetching reservation by lane ID', {
      laneId,
      error: String(error),
    });
    return null;
  }
}

/**
 * Fetch the active enterprise GPU reservation for an organization
 */
export async function getActiveReservationForOrg(
  db: D1Database,
  orgId: string,
  nowSeconds = Math.floor(Date.now() / 1000),
): Promise<EnterpriseGpuReservation | null> {
  try {
    const row = await db
      .prepare(
        `SELECT * FROM enterprise_gpu_reservations
         WHERE org_id = ?1 AND status = 'active' AND active_from <= ?2 AND active_until > ?2
         ORDER BY priority_score DESC, created_at DESC LIMIT 1`,
      )
      .bind(orgId, nowSeconds)
      .first<EnterpriseGpuReservationRow>();

    if (!row) return null;
    return mapRowToReservation(row);
  } catch (error) {
    logger.warn('[gpu-mesh] Error fetching active reservation for org', {
      orgId,
      error: String(error),
    });
    return null;
  }
}

/**
 * Pure validation of reservation capacity, validity window, and status
 */
export function validateReservationCapacity(
  reservation: EnterpriseGpuReservation,
  requestedMcu = 0,
  nowSeconds = Math.floor(Date.now() / 1000),
): { valid: boolean; reason?: string } {
  if (reservation.status !== 'active') {
    return {
      valid: false,
      reason: `RESERVATION_${reservation.status.toUpperCase()}`,
    };
  }

  if (reservation.activeUntil <= nowSeconds) {
    return {
      valid: false,
      reason: 'RESERVATION_EXPIRED',
    };
  }

  if (reservation.activeFrom > nowSeconds) {
    return {
      valid: false,
      reason: 'RESERVATION_NOT_YET_ACTIVE',
    };
  }

  if (reservation.mcuConsumed + requestedMcu > reservation.mcuMonthlyAllocation) {
    return {
      valid: false,
      reason: 'CAPACITY_EXHAUSTED',
    };
  }

  return { valid: true };
}

/**
 * Get count of active renders (leased + rendering) on a dedicated reservation
 */
export async function getReservationActiveJobCount(
  db: D1Database,
  reservationId: string,
  nowSeconds = Math.floor(Date.now() / 1000),
): Promise<number> {
  try {
    const row = await db
      .prepare(
        `SELECT COUNT(*) as count FROM video_render_jobs
         WHERE reservation_id = ?1 AND (
           status = 'rendering' OR
           (status = 'leased' AND leased_until >= ?2)
         )`,
      )
      .bind(reservationId, nowSeconds)
      .first<{ count: number }>();

    return row?.count ?? 0;
  } catch (error) {
    logger.warn('[gpu-mesh] Error counting active jobs for reservation', {
      reservationId,
      error: String(error),
    });
    return 0;
  }
}

export interface AllocateLaneOptions {
  requestedMcu?: number;
  nowSeconds?: number;
  targetRegion?: GpuMeshRegion;
}

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

  const reservation = await getReservationById(db, reservationId);
  if (!reservation) {
    return {
      success: false,
      jobId,
      reservationId,
      lane: 'priority',
      priorityScore: 10,
      reason: 'RESERVATION_NOT_FOUND',
    };
  }

  const capacityCheck = validateReservationCapacity(reservation, requestedMcu, now);
  if (!capacityCheck.valid) {
    return {
      success: false,
      jobId,
      reservationId,
      lane: 'priority',
      priorityScore: reservation.priorityScore,
      reason: capacityCheck.reason,
    };
  }

  const activeCount = await getReservationActiveJobCount(db, reservation.id, now);
  if (activeCount >= reservation.concurrencyLimit) {
    return {
      success: false,
      jobId,
      reservationId,
      lane: 'priority',
      priorityScore: reservation.priorityScore,
      activeJobs: activeCount,
      concurrencyLimit: reservation.concurrencyLimit,
      reason: 'CONCURRENCY_LIMIT_EXCEEDED',
    };
  }

  const targetRegion = options.targetRegion ?? reservation.primaryRegion;
  const priorityScore =
    reservation.priorityScore || GPU_MESH_SLA_CONFIG.dedicatedLanePriorityScore;

  try {
    // 1. Upgrade job to dedicated priority lane
    const jobUpdateRes = await db
      .prepare(
        `UPDATE video_render_jobs
         SET lane = 'priority',
             priority_score = ?1,
             reservation_id = ?2,
             target_region = ?3,
             updated_at = ?4
         WHERE id = ?5`,
      )
      .bind(priorityScore, reservation.id, targetRegion, now, jobId)
      .run();

    if (!jobUpdateRes.success) {
      return {
        success: false,
        jobId,
        reservationId,
        lane: 'priority',
        priorityScore,
        reason: 'FAILED_TO_UPDATE_JOB',
      };
    }

    // 2. Increment MCU consumed if requested
    if (requestedMcu > 0) {
      await db
        .prepare(
          `UPDATE enterprise_gpu_reservations
           SET mcu_consumed = mcu_consumed + ?1,
               updated_at = ?2
           WHERE id = ?3`,
        )
        .bind(requestedMcu, now, reservation.id)
        .run();
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

/**
 * Release dedicated lane upon job completion or failure, recording latency and executed region
 */
export async function releaseDedicatedLane(
  db: D1Database,
  jobId: string,
  executionResult?: {
    status?: 'completed' | 'failed';
    executionLatencyMs?: number;
    executedRegion?: string;
  },
): Promise<boolean> {
  const now = Math.floor(Date.now() / 1000);
  try {
    const status = executionResult?.status ?? 'completed';
    const latency = executionResult?.executionLatencyMs ?? null;
    const region = executionResult?.executedRegion ?? null;

    const res = await db
      .prepare(
        `UPDATE video_render_jobs
         SET status = ?1,
             execution_latency_ms = COALESCE(?2, execution_latency_ms),
             executed_region = COALESCE(?3, executed_region),
             updated_at = ?4
         WHERE id = ?5`,
      )
      .bind(status, latency, region, now, jobId)
      .run();

    return res.success;
  } catch (error) {
    logger.warn('[gpu-mesh] Error releasing dedicated lane', {
      jobId,
      error: String(error),
    });
    return false;
  }
}
