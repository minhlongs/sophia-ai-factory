/**
 * GPU Mesh Reservation Readers and Lookups
 *
 * Implements database queries for enterprise GPU reservations by ID, lane, and org.
 *
 * Layer: tree/gpu-mesh/allocator
 */

import type { D1Database } from '@/seed/db/client';
import type {
  EnterpriseGpuReservation,
  EnterpriseGpuReservationRow,
} from '@/seed/types/gpu-mesh';
import { mapRowToReservation } from '@/seed/types/gpu-mesh';
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
