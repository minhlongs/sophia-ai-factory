/**
 * Affiliate Ledger Submodule: Payout Approval & Completion (OCC).
 * Layer: tree (domain reusable; imports from @/seed)
 *
 * @module tree/affiliates/ledger/payout-lifecycle
 */

import { logger } from '@/seed/utils/logger-utility';
import type { AffiliatePayoutRow } from '@/seed/types/affiliate';
import { resolveD1 } from './db-resolver';
import type {
  ApprovePayoutInput,
  CompletePayoutInput,
  PayoutMutationResult,
} from './types';

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

/**
 * Completes a payout disbursement upon proof of transaction execution (USDT txHash or VietQR bank ref).
 * Atomically increments version and updates partner balances.
 */
export async function completePayoutDisbursement(
  input: CompletePayoutInput
): Promise<PayoutMutationResult> {
  const d1 = await resolveD1(input.d1);
  if (!d1) return { success: false, error: 'DATABASE_UNAVAILABLE' };

  try {
    const payout = await d1
      .prepare(`SELECT * FROM affiliate_payouts WHERE id = ?1 LIMIT 1`)
      .bind(input.payoutId)
      .first<AffiliatePayoutRow>();

    if (!payout) return { success: false, error: 'PAYOUT_NOT_FOUND' };

    const nowMs = Date.now();
    const updateRes = await d1
      .prepare(
        `UPDATE affiliate_payouts
         SET status = 'completed',
             tx_hash_or_bank_ref = ?1,
             version = version + 1,
             updated_at = ?2
         WHERE id = ?3 AND version = ?4 AND status = 'approved'`
      )
      .bind(input.txHashOrBankRef, nowMs, input.payoutId, input.currentVersion)
      .run();

    const changes = updateRes.meta?.changes ?? 0;
    if (changes === 0) {
      logger.warn('[AffiliateLedgerService] OCC conflict completing payout', {
        payoutId: input.payoutId,
        currentVersion: input.currentVersion,
      });
      return {
        success: false,
        conflict: true,
        error: 'OCC_VERSION_CONFLICT',
      };
    }

    // Atomically transition commissions and partner pending balance
    await d1.batch([
      d1
        .prepare(
          `UPDATE affiliate_commissions
           SET status = 'settled',
               settled_at = ?1,
               version = version + 1,
               updated_at = ?1
           WHERE payout_id = ?2 AND status = 'payable'`
        )
        .bind(nowMs, input.payoutId),
      d1
        .prepare(
          `UPDATE affiliate_partners
           SET pending_payout_cents = MAX(0, pending_payout_cents - ?1),
               settled_payout_cents = COALESCE(settled_payout_cents, 0) + ?1,
               updated_at = ?2
           WHERE id = ?3`
        )
        .bind(payout.amount_cents, nowMs, payout.partner_id),
    ]);

    return {
      success: true,
      newVersion: input.currentVersion + 1,
    };
  } catch (err) {
    logger.error('[AffiliateLedgerService] Error completing payout', {
      payoutId: input.payoutId,
      error: String(err),
    });
    return { success: false, error: String(err) };
  }
}
