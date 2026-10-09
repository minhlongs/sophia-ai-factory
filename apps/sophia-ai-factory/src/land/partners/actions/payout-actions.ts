/**
 * Partner Payout Batch Execution Server Actions
 *
 * Layer: land
 *
 * @module land/partners/actions/payout-actions
 */

'use server';

import { getD1 } from '@/seed/db/client';
import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { success, failure, type Result } from '@/seed/types/result';
import { logger } from '@/seed/utils/logger-utility';
import { toError } from '@/seed/utils/to-error';
import {
  createPayoutBatch,
  executePayoutBatch,
  getPayoutBatchById,
  type CreatePayoutBatchResult,
} from '@/tree/partners/payout-batcher';
import type { PayoutBatchExecutionResult } from '@/tree/partners/types';
import { verifyPartnerOwnership } from './ownership-verifier';
import type { CreatePayoutBatchActionInput, CoOpActionError } from './types';

/**
 * Creates a batch payout for pending commissions and/or approved Co-Op claims.
 */
export async function createPayoutBatchAction(
  input: CreatePayoutBatchActionInput,
): Promise<Result<CreatePayoutBatchResult, CoOpActionError>> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return failure({ code: 'UNAUTHORIZED', message: 'Authentication required to create payout batch' });
    }

    const db = await getD1();
    if (!db) {
      return failure({ code: 'DB_UNAVAILABLE', message: 'Database binding unavailable' });
    }

    // If partner-specific batch, verify ownership; if platform-wide batch, verify admin
    if (input.partnerId) {
      const authCheck = await verifyPartnerOwnership(db, input.partnerId.trim(), user.id, user.role);
      if (!authCheck.ok) {
        return failure(authCheck.error);
      }
    } else if (user.role !== 'admin') {
      return failure({ code: 'FORBIDDEN', message: 'Admin access required to create platform-wide payout batches' });
    }

    const result = await createPayoutBatch(
      db,
      input.partnerId?.trim() ?? null,
      input.batchType,
      input.rail,
      input.currency ?? 'USD',
      { fxRate: input.fxRate, destinationAddress: input.destinationAddress },
    );

    if (!result.success || !result.batch) {
      return failure({
        code: result.error ?? 'PAYOUT_BATCH_CREATION_FAILED',
        message: `Failed to create payout batch: ${result.error ?? 'unknown error'}`,
      });
    }

    return success(result);
  } catch (err: unknown) {
    const error = toError(err);
    logger.error('createPayoutBatchAction failed', { error: error.message, input });
    return failure({ code: 'INTERNAL_ERROR', message: error.message });
  }
}

/**
 * Executes a payout batch across the specified rail and handles atomic rollback on failure.
 */
export async function executePayoutBatchAction(
  batchId: string,
): Promise<Result<PayoutBatchExecutionResult, CoOpActionError>> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return failure({ code: 'UNAUTHORIZED', message: 'Authentication required to execute payout batch' });
    }

    const db = await getD1();
    if (!db) {
      return failure({ code: 'DB_UNAVAILABLE', message: 'Database binding unavailable' });
    }

    const trimmedBatchId = batchId?.trim();
    if (!trimmedBatchId) {
      return failure({ code: 'INVALID_INPUT', message: 'batchId is required' });
    }

    const existingBatch = await getPayoutBatchById(db, trimmedBatchId);
    if (!existingBatch) {
      return failure({ code: 'BATCH_NOT_FOUND', message: 'Payout batch not found' });
    }

    // Verify ownership of the batch
    if (existingBatch.partner_id) {
      const authCheck = await verifyPartnerOwnership(db, existingBatch.partner_id, user.id, user.role);
      if (!authCheck.ok) {
        return failure(authCheck.error);
      }
    } else if (user.role !== 'admin') {
      return failure({ code: 'FORBIDDEN', message: 'Admin access required to execute platform-wide payout batches' });
    }

    const result = await executePayoutBatch(db, trimmedBatchId);

    if (!result.success) {
      return failure({
        code: result.error ?? 'PAYOUT_EXECUTION_FAILED',
        message: `Payout batch execution failed: ${result.error ?? 'unknown error'}`,
      });
    }

    return success(result);
  } catch (err: unknown) {
    const error = toError(err);
    logger.error('executePayoutBatchAction failed', { error: error.message, batchId });
    return failure({ code: 'INTERNAL_ERROR', message: error.message });
  }
}
