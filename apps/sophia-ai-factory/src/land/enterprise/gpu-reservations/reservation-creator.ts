/**
 * Creator action for Enterprise GPU Reservations
 *
 * @module land/enterprise/gpu-reservations/reservation-creator
 */

'use server';

import { getD1 } from '@/seed/db/client';
import { success, failure, type Result } from '@/seed/types/result';
import { logger } from '@/seed/utils/logger-utility';
import type {
  EnterpriseGpuReservation,
  CreateReservationInput,
} from '@/seed/types/gpu-mesh';
import { getReservationById } from '@/tree/gpu-mesh/dedicated-lane-allocator';
import type { ActionError } from './types';
import { assertAdminAccess } from './auth-guard';
import {
  buildReservationRecord,
  insertGpuReservationRow,
} from './reservation-creator-helper';

/**
 * Generate a random UUID-like reservation ID
 */
export function generateReservationId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `egr_${crypto.randomUUID().replace(/-/g, '')}`;
  }
  const timestamp = Date.now().toString(36);
  const randomPart = Math.random().toString(36).substring(2, 10);
  return `egr_${timestamp}${randomPart}`;
}

/**
 * Create and provision a new dedicated enterprise GPU reservation
 */
export async function createGpuReservationAction(
  input: CreateReservationInput,
): Promise<Result<EnterpriseGpuReservation, ActionError>> {
  const auth = await assertAdminAccess();
  if (!auth.ok) return auth;

  const db = await getD1();
  if (!db) {
    return failure({ code: 'DB_ERROR', message: 'D1 database binding unavailable' });
  }

  if (!input.orgId) {
    return failure({ code: 'VALIDATION_ERROR', message: 'Organization ID is required' });
  }

  const now = Math.floor(Date.now() / 1000);
  const id = generateReservationId();
  const rec = buildReservationRecord(id, input, now);

  if (rec.activeUntil <= rec.activeFrom) {
    return failure({
      code: 'VALIDATION_ERROR',
      message: 'activeUntil must be in the future beyond activeFrom',
    });
  }

  try {
    await insertGpuReservationRow(db, rec);

    const created = await getReservationById(db, id);
    if (!created) {
      return failure({ code: 'DB_ERROR', message: 'Failed to verify created reservation' });
    }

    logger.info('[gpu-reservations-actions] Created enterprise GPU reservation', {
      id,
      orgId: input.orgId,
      laneId: rec.laneId,
      admin: auth.value.email,
    });

    return success(created);
  } catch (error) {
    logger.error('[gpu-reservations-actions] Error creating GPU reservation', {
      error: String(error),
    });
    return failure({ code: 'DB_ERROR', message: `Database error: ${String(error)}` });
  }
}
