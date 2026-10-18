/**
 * Mutation actions for Enterprise GPU Reservations
 *
 * @module land/enterprise/gpu-reservations/reservation-mutator
 */

'use server';

import { getD1 } from '@/seed/db/client';
import { success, failure, type Result } from '@/seed/types/result';
import { logger } from '@/seed/utils/logger-utility';
import type {
  EnterpriseGpuReservation,
  UpdateReservationInput,
} from '@/seed/types/gpu-mesh';
import { getReservationById } from '@/tree/gpu-mesh/dedicated-lane-allocator';
import type { ActionError } from './types';
import { assertAdminAccess } from './auth-guard';
import { buildReservationUpdateClauses } from './reservation-mutator-sql';

/**
 * Update an existing enterprise GPU reservation
 */
export async function updateGpuReservationAction(
  reservationId: string,
  updates: UpdateReservationInput,
): Promise<Result<EnterpriseGpuReservation, ActionError>> {
  const auth = await assertAdminAccess();
  if (!auth.ok) return auth;

  const db = await getD1();
  if (!db) {
    return failure({ code: 'DB_ERROR', message: 'D1 database binding unavailable' });
  }

  const existing = await getReservationById(db, reservationId);
  if (!existing) {
    return failure({ code: 'NOT_FOUND', message: 'GPU reservation not found' });
  }

  const now = Math.floor(Date.now() / 1000);
  const { setClauses, params } = buildReservationUpdateClauses(updates, existing.metadata, now);

  params.push(reservationId);
  const sql = `UPDATE enterprise_gpu_reservations SET ${setClauses.join(', ')} WHERE id = ?${params.length}`;

  try {
    await db.prepare(sql).bind(...params).run();
    const updated = await getReservationById(db, reservationId);
    if (!updated) {
      return failure({ code: 'DB_ERROR', message: 'Failed to retrieve updated reservation' });
    }

    logger.info('[gpu-reservations-actions] Updated enterprise GPU reservation', {
      reservationId,
      updates,
      admin: auth.value.email,
    });

    return success(updated);
  } catch (error) {
    logger.error('[gpu-reservations-actions] Error updating reservation', {
      reservationId,
      error: String(error),
    });
    return failure({ code: 'DB_ERROR', message: `Database error: ${String(error)}` });
  }
}

/**
 * Terminate an enterprise GPU reservation
 */
export async function terminateGpuReservationAction(
  reservationId: string,
  reason = 'Admin terminated',
): Promise<Result<{ terminated: boolean; id: string }, ActionError>> {
  const auth = await assertAdminAccess();
  if (!auth.ok) return auth;

  const db = await getD1();
  if (!db) {
    return failure({ code: 'DB_ERROR', message: 'D1 database binding unavailable' });
  }

  const existing = await getReservationById(db, reservationId);
  if (!existing) {
    return failure({ code: 'NOT_FOUND', message: 'GPU reservation not found' });
  }

  const now = Math.floor(Date.now() / 1000);
  try {
    await db
      .prepare(
        `UPDATE enterprise_gpu_reservations
         SET status = 'terminated',
             updated_at = ?1
         WHERE id = ?2`,
      )
      .bind(now, reservationId)
      .run();

    logger.info('[gpu-reservations-actions] Terminated GPU reservation', {
      reservationId,
      reason,
      admin: auth.value.email,
    });

    return success({ terminated: true, id: reservationId });
  } catch (error) {
    logger.error('[gpu-reservations-actions] Error terminating reservation', {
      reservationId,
      error: String(error),
    });
    return failure({ code: 'DB_ERROR', message: `Database error: ${String(error)}` });
  }
}
