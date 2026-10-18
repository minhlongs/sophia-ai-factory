/**
 * Affiliate Ledger Submodule: Payout Approval & Completion (OCC).
 * Layer: tree (domain reusable; imports from @/seed)
 *
 * @module tree/affiliates/ledger/payout-lifecycle
 */

import { logger } from '@/seed/utils/logger-utility';
import { resolveD1 } from './db-resolver';
import type {
  ApprovePayoutInput,
  PayoutMutationResult,
} from './types';
export { completePayoutDisbursement } from './payout-completion';

/**
 * Approves a payout disbursement using Optimistic Concurrency Control (OCC).
 * Atomically updates version = version + 1 WHERE id = ? AND version = ?.
 */
export async function approvePayoutDisbursement(
  input: ApprovePayoutInput
): Promise<PayoutMutationResult> {
  const d1 = await resolveD1(input.d1);
  if (!d1) return { success: false, error: 'DATABASE_UNAVAILABLE' };

  try {
    const nowMs = Date.now();
    const updateRes = await d1
      .prepare(
        `UPDATE affiliate_payouts
         SET status = 'approved',
             approved_by = ?1,
             approved_at = ?2,
             version = version + 1,
             updated_at = ?2
         WHERE id = ?3 AND version = ?4 AND status IN ('draft', 'pending_approval')`
      )
      .bind(input.approvedBy, nowMs, input.payoutId, input.currentVersion)
      .run();

    const changes = updateRes.meta?.changes ?? 0;
    if (changes === 0) {
      logger.warn('[AffiliateLedgerService] OCC conflict during payout approval', {
        payoutId: input.payoutId,
        currentVersion: input.currentVersion,
      });
      return {
        success: false,
        conflict: true,
        error: 'OCC_VERSION_CONFLICT',
      };
    }

    return {
      success: true,
      newVersion: input.currentVersion + 1,
    };
  } catch (err) {
    logger.error('[AffiliateLedgerService] Error approving payout', {
      payoutId: input.payoutId,
      error: String(err),
    });
    return { success: false, error: String(err) };
  }
}
