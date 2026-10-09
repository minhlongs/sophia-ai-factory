/**
 * Partner Payout Batch Queries (Server Actions)
 *
 * Layer: land
 *
 * @module land/partners/actions/payout-queries
 */

'use server';

import { getD1 } from '@/seed/db/client';
import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { success, failure, type Result } from '@/seed/types/result';
import { logger } from '@/seed/utils/logger-utility';
import { toError } from '@/seed/utils/to-error';
import { getPayoutBatchById } from '@/tree/partners/payout-batcher';
import type { PartnerPayoutBatch } from '@/tree/partners/types';
import { verifyPartnerOwnership } from './ownership-verifier';
import type { CoOpActionError } from './types';

/**
 * Retrieves a payout batch by ID.
 */
export async function getPayoutBatchByIdAction(
  batchId: string,
): Promise<Result<PartnerPayoutBatch, CoOpActionError>> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return failure({ code: 'UNAUTHORIZED', message: 'Authentication required to view payout batch' });
    }

    const db = await getD1();
    if (!db) {
      return failure({ code: 'DB_UNAVAILABLE', message: 'Database binding unavailable' });
    }

    const trimmedBatchId = batchId?.trim();
    if (!trimmedBatchId) {
      return failure({ code: 'INVALID_INPUT', message: 'batchId is required' });
    }

    const batch = await getPayoutBatchById(db, trimmedBatchId);
    if (!batch) {
      return failure({ code: 'BATCH_NOT_FOUND', message: 'Payout batch not found' });
    }

    // Enforce object ownership
    if (batch.partner_id) {
      const authCheck = await verifyPartnerOwnership(db, batch.partner_id, user.id, user.role);
      if (!authCheck.ok) {
        return failure(authCheck.error);
      }
    } else if (user.role !== 'admin') {
      return failure({ code: 'FORBIDDEN', message: 'Admin access required to view platform-wide payout batches' });
    }

    return success(batch);
  } catch (err: unknown) {
    const error = toError(err);
    logger.error('getPayoutBatchByIdAction failed', { error: error.message, batchId });
    return failure({ code: 'INTERNAL_ERROR', message: error.message });
  }
}

/**
 * Retrieves payout batches for a partner.
 */
export async function getPartnerPayoutBatchesAction(
  partnerId: string,
): Promise<Result<PartnerPayoutBatch[], CoOpActionError>> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return failure({ code: 'UNAUTHORIZED', message: 'Authentication required to view partner payout batches' });
    }

    const db = await getD1();
    if (!db) {
      return failure({ code: 'DB_UNAVAILABLE', message: 'Database binding unavailable' });
    }

    const trimmedPartnerId = partnerId?.trim();
    if (!trimmedPartnerId) {
      return failure({ code: 'INVALID_INPUT', message: 'partnerId is required' });
    }

    const authCheck = await verifyPartnerOwnership(db, trimmedPartnerId, user.id, user.role);
    if (!authCheck.ok) {
      return failure(authCheck.error);
    }

    const rows = await db
      .prepare('SELECT * FROM partner_payout_batches WHERE partner_id = ? ORDER BY created_at DESC')
      .bind(trimmedPartnerId)
      .all<PartnerPayoutBatch>();

    return success(rows.results ?? []);
  } catch (err: unknown) {
    const error = toError(err);
    logger.error('getPartnerPayoutBatchesAction failed', { error: error.message, partnerId });
    return failure({ code: 'INTERNAL_ERROR', message: error.message });
  }
}
