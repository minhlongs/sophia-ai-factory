import { getD1 } from '@/seed/db/client';
import { decryptSecret } from '@/tree/crypto/encrypt-secret';
import { logger } from '@/seed/utils/logger-utility';
import { fromCents, sanitizeErrorText } from '../commission-cents';
import { sendSinglePayout, sleep, RATE_LIMIT_MS } from './single-payout';
import type {
  BatchQueueInput,
  MultiPayoutBatchInput,
  MultiPayoutBatchResult,
} from './types';
import { exportBankReconciliationCsv } from './bank-reconciliation-csv';

export { exportBankReconciliationCsv };

/**
 * Queue and send a payout batch.
 * Decrypts recipient address and sends payout at 5/sec rate.
 * Idempotent: already-confirmed or already-sending batches skip silently.
 * Converts cents → USDT float at API call boundary.
 */
export async function queueBatch(input: BatchQueueInput): Promise<{ externalPaymentId: string }> {
  const _db = await getD1();
  if (!_db) throw new Error('D1 database binding not available');
  const db = _db;
  const apiKey = process.env.NOWPAYMENTS_API_KEY;

  const existing = await db
    .prepare(`SELECT external_payment_id, status FROM payout_batches WHERE id = ?`)
    .bind(input.batchId)
    .first<{ external_payment_id: string | null; status: string }>();

  if (existing && (existing.status === 'confirmed' || existing.status === 'sending')) {
    if (existing.status === 'confirmed' && existing.external_payment_id) {
      return { externalPaymentId: existing.external_payment_id };
    }
    return { externalPaymentId: existing.external_payment_id ?? 'in_progress' };
  }

  const now = Math.floor(Date.now() / 1000);

  await db
    .prepare(`UPDATE payout_batches SET status = 'sending' WHERE id = ?`)
    .bind(input.batchId)
    .run();

  let externalPaymentId: string;

  if (!apiKey) {
    externalPaymentId = `mock_${input.batchId}_${now}`;
    await sleep(RATE_LIMIT_MS);
  } else {
    const plainAddr = await decryptSecret(
      input.recipientAddrEncrypted,
      process.env.PAYOUT_ENC_KEY,
    );
    const callbackUrl = `${process.env.NEXT_PUBLIC_APP_URL ?? ''}/api/webhooks/nowpayments-payout`;
    const amountUsdt = fromCents(input.totalCents);

    try {
      externalPaymentId = await sendSinglePayout(apiKey, {
        address: plainAddr,
        currency: 'usdttrc20',
        amountUsdt,
        ipn_callback_url: callbackUrl,
        extraId: input.batchId,
      });
    } catch (err) {
      const safeMsg = sanitizeErrorText(err instanceof Error ? err.message : String(err));
      try {
        await db
          .prepare(
            `UPDATE payout_batches SET status = 'failed', failed_reason = ? WHERE id = ?`,
          )
          .bind(safeMsg, input.batchId)
          .run();
        logger.error('[NOWPayments] Mass payout failed — status updated to failed', undefined, {
          batchId: input.batchId,
          error: safeMsg,
        });
      } catch (updateErr) {
        logger.error('[NOWPayments] Failed to update payout_batches status after API error', undefined, {
          batchId: input.batchId,
          updateError: String(updateErr),
        });
      }
      throw new Error(safeMsg);
    }
    await sleep(RATE_LIMIT_MS);
  }

  await db
    .prepare(`UPDATE payout_batches SET external_payment_id = ? WHERE id = ?`)
    .bind(externalPaymentId, input.batchId)
    .run();

  return { externalPaymentId };
}

/**
 * Execute mass-payout across multiple affiliate partners with rate limiting (5 req/sec).
 */
export async function executeMultiPayoutBatch(
  input: MultiPayoutBatchInput,
): Promise<MultiPayoutBatchResult> {
  const externalPaymentIds: Record<string, string> = {};
  const failures: Array<{ partnerId: string; error: string }> = [];

  let successCount = 0;
  let failureCount = 0;

  for (const item of input.items) {
    const singleBatchId = `${input.batchId}_${item.partnerId}`;
    try {
      const res = await queueBatch({
        batchId: singleBatchId,
        affiliateId: item.partnerId,
        totalCents: item.totalCents,
        recipientAddrEncrypted: item.recipientAddrEncrypted,
        network: item.network || 'TRC20',
      });
      externalPaymentIds[item.partnerId] = res.externalPaymentId;
      successCount++;
    } catch (err) {
      const safeErr = sanitizeErrorText(err instanceof Error ? err.message : String(err));
      failures.push({ partnerId: item.partnerId, error: safeErr });
      failureCount++;
    }
  }

  return {
    batchId: input.batchId,
    totalCount: input.items.length,
    successCount,
    failureCount,
    externalPaymentIds,
    failures,
  };
}
