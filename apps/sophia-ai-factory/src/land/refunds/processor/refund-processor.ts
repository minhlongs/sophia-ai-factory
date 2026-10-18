/**
 * Core refund processing orchestrator with atomic guarantees
 * @module land/refunds/processor/refund-processor
 */

import { getD1 } from '@/seed/db/client';
import { logger } from '@/seed/utils/logger-utility';
import { success, failure, type Result } from '@/seed/types/result';
import type { Tier } from '@/seed/types';
import { getMcuMonthlyLimit } from '@/seed/config/tiers/unified-limits';
import { getRefundById, processRefundStatus, createRefundLedgerEntry } from '../refund-repo';
import {
  DELETE_REFUND_LOCK_SQL,
  RELEASE_REFUND_LOCK_SQL,
  acquireRefundEventLock,
  type RefundProcessInput,
  type RefundProcessResult,
  type RefundError,
  RefundProcessError,
} from './types';
import { resolveCurrentTier, rollbackTier } from './eligibility-checker';
import { callNowPaymentsRefund } from './gateway-refund-dispatcher';

export async function processRefund(
  input: RefundProcessInput,
): Promise<Result<RefundProcessResult, RefundError>> {
  const db = await getD1();
  if (!db) {
    return failure({ code: 'INTERNAL_ERROR', message: 'D1 database binding not available' });
  }

  const eventId = `refund_${input.refundRequestId}`;
  const now = new Date().toISOString();

  // 1. Atomic lock: Single INSERT determines lock ownership atomically
  const lockOutcome = await acquireRefundEventLock(db, eventId, input, now);
  if (!lockOutcome.ok) {
    return failure(lockOutcome.error);
  }

  try {
    // 2. Look up refund request
    const refund = await getRefundById(input.refundRequestId);
    if (!refund) {
      await db.prepare(DELETE_REFUND_LOCK_SQL).bind(eventId).run();
      return failure({ code: 'NOT_FOUND', message: `Refund request ${input.refundRequestId} not found` });
    }

    // 3. Resolve current tier and MCU baseline
    const tierBefore = await resolveCurrentTier(refund.user_id, db);
    const tierAfter: Tier = 'BASIC';
    const mcuClawedBack = Math.max(0, getMcuMonthlyLimit(tierBefore) - getMcuMonthlyLimit(tierAfter));

    // 4. Call NOWPayments refund API (crypto) & roll back tier to BASIC
    await callNowPaymentsRefund(refund.payment_id, refund.customer_wallet_address);
    await rollbackTier(refund.user_id, tierAfter, db);

    // 5. Write refund_ledger entry & mark refund_request as refunded
    const ledgerEntryId = await createRefundLedgerEntry({
      refundRequestId: refund.id,
      userId: refund.user_id,
      purchaseId: refund.purchase_id,
      paymentId: refund.payment_id,
      amountCents: refund.amount_cents,
      tierBefore,
      tierAfter,
      mcuClawedBack,
      txHash: input.txHash,
    });

    await processRefundStatus({
      id: refund.id,
      reviewedByUserId: input.reviewedByUserId,
      adminNotes: input.notes,
      refundTxHash: input.txHash,
    });

    // 6. Release lock
    await db.prepare(RELEASE_REFUND_LOCK_SQL).bind(now, eventId).run();

    logger.info('[RefundProcessor] Refund processed', {
      refundRequestId: refund.id,
      tierBefore,
      tierAfter,
      mcuClawedBack,
      ledgerEntryId,
      txHash: input.txHash,
    });

    return success({
      refundRequestId: refund.id,
      ledgerEntryId,
      tierBefore,
      tierAfter,
      mcuClawedBack,
      transactionHash: input.txHash,
    });
  } catch (err) {
    await db.prepare(DELETE_REFUND_LOCK_SQL).bind(eventId).run().catch(() => {});

    if (err instanceof RefundProcessError) {
      logger.warn('[RefundProcessor] Refund processing failed', {
        code: err.code,
        message: err.message,
        refundRequestId: input.refundRequestId,
      });
      return failure({ code: err.code, message: err.message });
    }

    const message = err instanceof Error ? err.message : String(err);
    logger.error('[RefundProcessor] Unexpected error', err instanceof Error ? err : undefined, {
      refundRequestId: input.refundRequestId,
    });
    return failure({ code: 'INTERNAL_ERROR', message });
  }
}
