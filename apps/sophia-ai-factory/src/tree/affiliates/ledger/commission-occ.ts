/**
 * Affiliate Ledger Submodule: Commission Status OCC.
 * Layer: tree (domain reusable; imports from @/seed)
 *
 * @module tree/affiliates/ledger/commission-occ
 */

import { logger } from '@/seed/utils/logger-utility';
import { resolveD1 } from './db-resolver';
import type { UpdateCommissionOccInput, PayoutMutationResult } from './types';

/**
 * Updates a commission status with Optimistic Concurrency Control (OCC).
 */
export async function updateCommissionStatusWithOcc(
  input: UpdateCommissionOccInput
): Promise<PayoutMutationResult> {
  const d1 = await resolveD1(input.d1);
  if (!d1) return { success: false, error: 'DATABASE_UNAVAILABLE' };

  try {
    const nowMs = Date.now();
    const updateRes = await d1
      .prepare(
        `UPDATE affiliate_commissions
         SET status = ?1,
             payout_id = CASE WHEN ?2 IS NOT NULL THEN ?2 ELSE payout_id END,
             version = version + 1,
             updated_at = ?3
         WHERE id = ?4 AND version = ?5`
      )
      .bind(
        input.targetStatus,
        input.payoutId ?? null,
        nowMs,
        input.commissionId,
        input.currentVersion
      )
      .run();

    const changes = updateRes.meta?.changes ?? 0;
    if (changes === 0) {
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
    logger.error('[AffiliateLedgerService] Error updating commission with OCC', {
      commissionId: input.commissionId,
      error: String(err),
    });
    return { success: false, error: String(err) };
  }
}
