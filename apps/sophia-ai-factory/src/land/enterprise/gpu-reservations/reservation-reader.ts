/**
 * Reader actions for Enterprise GPU Reservations
 *
 * @module land/enterprise/gpu-reservations/reservation-reader
 */

'use server';

import { getD1 } from '@/seed/db/client';
import { success, failure, type Result } from '@/seed/types/result';
import { logger } from '@/seed/utils/logger-utility';
import type {
  EnterpriseGpuReservation,
  EnterpriseGpuReservationRow,
  ReservationStatus,
  GpuMeshRegion,
} from '@/seed/types/gpu-mesh';
import { mapRowToReservation } from '@/seed/types/gpu-mesh';
import { getReservationById } from '@/tree/gpu-mesh/dedicated-lane-allocator';
import type { ActionError } from './types';
import { assertAdminAccess } from './auth-guard';

/**
 * Get an enterprise GPU reservation by ID
 */
export async function getGpuReservationAction(
  reservationId: string,
): Promise<Result<EnterpriseGpuReservation, ActionError>> {
  const auth = await assertAdminAccess();
  if (!auth.ok) return auth;

  const db = await getD1();
  if (!db) {
    return failure({ code: 'DB_ERROR', message: 'D1 database binding unavailable' });
  }

  const reservation = await getReservationById(db, reservationId);
  if (!reservation) {
    return failure({ code: 'NOT_FOUND', message: 'GPU reservation not found' });
  }

  return success(reservation);
}

/**
 * List enterprise GPU reservations with optional filters
 */
export async function listGpuReservationsAction(filters: {
  orgId?: string;
  status?: ReservationStatus;
  region?: GpuMeshRegion;
  limit?: number;
} = {}): Promise<Result<EnterpriseGpuReservation[], ActionError>> {
  const auth = await assertAdminAccess();
  if (!auth.ok) return auth;

  const db = await getD1();
  if (!db) {
    return failure({ code: 'DB_ERROR', message: 'D1 database binding unavailable' });
  }

  try {
    let query = 'SELECT * FROM enterprise_gpu_reservations WHERE 1=1';
    const params: unknown[] = [];

    if (filters.orgId) {
      params.push(filters.orgId);
      query += ` AND org_id = ?${params.length}`;
    }

    if (filters.status) {
      params.push(filters.status);
      query += ` AND status = ?${params.length}`;
    }

    if (filters.region) {
      params.push(filters.region);
      query += ` AND primary_region = ?${params.length}`;
    }

    query += ' ORDER BY created_at DESC';

    const limit = Math.min(Math.max(1, filters.limit ?? 50), 100);
    params.push(limit);
    query += ` LIMIT ?${params.length}`;

    const stmt = db.prepare(query);
    const { results } = await stmt.bind(...params).all<EnterpriseGpuReservationRow>();

    const reservations = (results ?? []).map(mapRowToReservation);
    return success(reservations);
  } catch (error) {
    logger.error('[gpu-reservations-actions] Error listing reservations', {
      error: String(error),
    });
    return failure({ code: 'DB_ERROR', message: `Database error: ${String(error)}` });
  }
}
