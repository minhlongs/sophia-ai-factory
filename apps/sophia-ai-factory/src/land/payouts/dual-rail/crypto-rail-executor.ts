/**
 * Web3 / Crypto Rail (USDT TRC-20) mass payout executor and balance updater.
 *
 * Layer: land/payouts/dual-rail
 * Allowed imports: @/seed/*, @/land/payouts/*
 */

import { logger } from '@/seed/utils/logger-utility';
import { sanitizeErrorText } from '../commission-cents';
import {
  executeMultiPayoutBatch,
  type MultiPayoutBatchResult,
} from '../nowpayments-mass-payout';
import type { PayoutBatchItem } from './types';

/**
 * Executes a batch of USDT payouts using NOWPayments multi-payout API
 * and decrements pending balances in D1 for successful payouts.
 */
export async function executeCryptoRailBatch(
  d1: D1Database,
  usdtItems: PayoutBatchItem[],
  batchId: string
): Promise<MultiPayoutBatchResult | undefined> {
  if (usdtItems.length === 0) return undefined;

  const nowMs = Date.now();
  try {
    const usdtResult = await executeMultiPayoutBatch({
      batchId: `${batchId}_USDT`,
      items: usdtItems.map((item) => ({
        partnerId: item.affiliateId,
        totalCents: item.amountCents,
        recipientAddrEncrypted: item.usdtAddress || '',
        network: 'TRC20',
      })),
    });

    if (usdtResult.successCount > 0) {
      for (const [partnerId] of Object.entries(usdtResult.externalPaymentIds)) {
        const item = usdtItems.find((i) => i.affiliateId === partnerId);
        if (item) {
          await d1
            .prepare(
              `UPDATE affiliate_partners
               SET pending_payout_cents = MAX(0, pending_payout_cents - ?),
                   updated_at = ?
               WHERE id = ?`
            )
            .bind(item.amountCents, nowMs, partnerId)
            .run();
        }
      }
    }

    return usdtResult;
  } catch (err) {
    logger.error('[dual-rail-payout-engine] USDT batch execution failed', {
      batchId,
      error: sanitizeErrorText(String(err)),
    });
    return undefined;
  }
}
