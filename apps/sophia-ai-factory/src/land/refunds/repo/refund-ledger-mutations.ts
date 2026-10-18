/**
 * Refund Ledger Mutations
 * Layer: land/refunds/repo
 */

import { getD1 } from '@/seed/db/client';
import { logger } from '@/seed/utils/logger-utility';
import type { Tier } from '@/seed/types';

/**
 * Insert a refund_ledger entry for audit trail.
 * Captures who was refunded, how much, tier before/after,
 * MCU clawback amount, and the blockchain transaction hash.
 */
export async function createRefundLedgerEntry(params: {
  refundRequestId: string;
  userId: string;
  purchaseId: string;
  paymentId: string;
  amountCents: number;
  tierBefore: Tier;
  tierAfter: Tier;
  mcuClawedBack: number;
  txHash: string;
}): Promise<string> {
  const db = await getD1();
  if (!db) throw new Error('D1 database binding not available');

  const id = crypto.randomUUID().replace(/-/g, '');

  await db
    .prepare(
      `INSERT INTO refund_ledger
         (id, refund_request_id, user_id, purchase_id, payment_id, amount_cents,
          tier_before, tier_after, mcu_clawed_back, tx_hash, created_at)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, strftime('%s','now'))`,
    )
    .bind(
      id,
      params.refundRequestId,
      params.userId,
      params.purchaseId,
      params.paymentId,
      params.amountCents,
      params.tierBefore,
      params.tierAfter,
      params.mcuClawedBack,
      params.txHash,
    )
    .run();

  logger.info('[RefundRepo] Ledger entry created', {
    id,
    refundRequestId: params.refundRequestId,
    amountCents: params.amountCents,
    tierBefore: params.tierBefore,
    tierAfter: params.tierAfter,
    mcuClawedBack: params.mcuClawedBack,
  });

  return id;
}
