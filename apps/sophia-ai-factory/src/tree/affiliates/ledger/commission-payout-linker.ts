/**
 * Affiliate Ledger Submodule: Payout ↔ Commission linking.
 *
 * Reserving the commissions a payout was created from is what makes a payout
 * sweep safe to re-run. Until a commission carries the `payout_id` it was swept
 * into, it still looks `payable` with a null `payout_id`, so the next sweep
 * would aggregate it again and create a second payout for money already moved.
 *
 * This is a reservation, not a settlement: the commission stays `payable` until
 * the payout is actually completed, so a payout that is cancelled still leaves
 * the commission claimable.
 *
 * Layer: tree (domain reusable; imports from @/seed)
 *
 * @module tree/affiliates/ledger/commission-payout-linker
 */

import { logger } from '@/seed/utils/logger-utility';
import { resolveD1 } from './db-resolver';
import type { LinkCommissionsInput, PayoutMutationResult } from './types';

/**
 * Claims every mature, unclaimed commission for a partner against a payout.
 *
 * Scoped on `status = 'payable' AND payout_id IS NULL` so a commission already
 * reserved by another payout can never be claimed twice. Returns the number
 * reserved so the caller can compare it against what it expected to sweep.
 */
export async function linkCommissionsToPayout(
  input: LinkCommissionsInput
): Promise<PayoutMutationResult & { reservedCount: number }> {
  const d1 = await resolveD1(input.d1);
  if (!d1) return { success: false, error: 'DATABASE_UNAVAILABLE', reservedCount: 0 };

  try {
    const nowMs = Date.now();
    const result = await d1
      .prepare(
        `UPDATE affiliate_commissions
         SET payout_id = ?1,
             version = version + 1,
             updated_at = ?2
         WHERE partner_id = ?3
           AND status = 'payable'
           AND payout_id IS NULL
           AND (payable_at IS NULL OR payable_at <= ?4)`
      )
      .bind(input.payoutId, nowMs, input.partnerId, input.maturedBeforeMs)
      .run();

    const reservedCount = result.meta?.changes ?? 0;
    return { success: true, reservedCount };
  } catch (err) {
    logger.error('[AffiliateLedgerService] Failed to reserve commissions for payout', {
      payoutId: input.payoutId,
      partnerId: input.partnerId,
      error: String(err),
    });
    return { success: false, error: String(err), reservedCount: 0 };
  }
}
