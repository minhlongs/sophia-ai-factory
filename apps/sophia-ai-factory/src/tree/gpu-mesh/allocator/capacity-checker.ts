/**
 * GPU Mesh Capacity and Reservation Validation
 *
 * Implements pure validation of reservation capacity, active time windows,
 * and active render job counts.
 *
 * Layer: tree/gpu-mesh/allocator
 */

import type { D1Database } from '@/seed/db/client';
import type { EnterpriseGpuReservation } from '@/seed/types/gpu-mesh';
import { logger } from '@/seed/utils/logger-utility';

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
