/**
 * NOWPayments IPN Finished Event Processor for One-Time Bundles
 *
 * Layer: land (Business domain workflows)
 * @module land/billing/ipn/nowpayments-ipn-service
 */

import { logger } from '@/seed/utils/logger-utility';
import { insertPurchase, markPaid } from '@/seed/db/repositories/user-purchases-repo';
import { parseUserIdFromOrderId } from '../nowpayments-ipn-db';
import { success, failure, type Result } from '@/seed/types/result';
import { IPNError } from '../nowpayments-ipn-errors';
import type { NowPaymentsIpnPayload, OneTimeSku } from './types';
import { addMonths } from './types';
import { verifyPaymentAmountAndUnderpayment } from './ipn-signature-verifier';
import { runOneTimePostPaymentEffects } from './one-time-post-payment-effects';

/**
 * Handle one-time IPN `finished` event.
 * Inserts user_purchases row (idempotent), marks paid, triggers fulfillment.
 * Rejects underpayments — sets status='underpaid', skips fulfillment.
 */
export async function handleOneTimeFinished(
  ipn: NowPaymentsIpnPayload,
  sku: OneTimeSku,
): Promise<Result<void, IPNError>> {
  try {
    const userId = parseUserIdFromOrderId(ipn.order_id ?? '');
    if (!userId) {
      logger.warn('[IPN/OneTime] finished: cannot parse userId', { orderId: ipn.order_id, paymentId: ipn.payment_id });
      return success(undefined);
    }

    const verification = await verifyPaymentAmountAndUnderpayment(ipn, sku, userId);
    if (!verification.ok) {
      return success(undefined);
    }

    const expiresAt = Math.floor(addMonths(new Date(), sku.ttlMonths).getTime() / 1000);
    const amountCents = Math.round(ipn.price_amount * 100);

    // Insert purchase row (idempotent — returns existing id if conflict)
    const purchaseId = await insertPurchase({
      userId,
      kind: 'one_time',
      sku: sku.id,
      paymentId: ipn.payment_id,
      invoiceId: ipn.invoice_id ?? null,
      amountCents,
      creditsTotal: sku.credits,
      expiresAt,
      status: 'pending',
    });

    if (!purchaseId) {
      logger.error('[IPN/OneTime] finished: failed to insert purchase row', undefined, {
        paymentId: ipn.payment_id,
        userId,
      });
      return failure(new IPNError('INSERT_PURCHASE_FAILED', new Error('Failed to insert purchase row')));
    }

    // Mark paid + set credits_remaining
    await markPaid(ipn.payment_id, sku.credits, expiresAt);

    // Non-fatal post-payment side effects (pending_orders, audit, auto-handover, fulfillment)
    await runOneTimePostPaymentEffects(ipn, sku, userId, purchaseId, expiresAt);

    return success(undefined);
  } catch (err) {
    return failure(new IPNError('HANDLE_ONE_TIME_FINISHED_FAILED', err));
  }
}
