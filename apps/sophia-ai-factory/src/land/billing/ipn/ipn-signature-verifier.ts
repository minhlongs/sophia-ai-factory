/**
 * NOWPayments IPN Verification and Refund Processing
 *
 * Layer: land (Business domain workflows)
 * @module land/billing/ipn/ipn-signature-verifier
 */

import { logger } from '@/seed/utils/logger-utility';
import { markRefunded, getByPaymentId } from '@/seed/db/repositories/user-purchases-repo';
import { markUnderpaid, UNDERPAYMENT_THRESHOLD } from '../nowpayments-ipn-underpaid';
import { parseUserIdFromOrderId } from '../nowpayments-ipn-db';
import { success, failure, type Result } from '@/seed/types/result';
import { IPNError } from '../nowpayments-ipn-errors';
import { checkCryptoPaidAmount } from '../ipn-amount-check';
import {
  recordRefundAudit,
  revokeRefundedPurchaseAccess,
} from './ipn-refund-helpers';
import type { NowPaymentsIpnPayload, OneTimeSku } from './types';

/**
 * Verify IPN price and underpayment guards.
 * Returns true if valid for fulfillment; returns false if dropped/underpaid.
 */
export async function verifyPaymentAmountAndUnderpayment(
  ipn: NowPaymentsIpnPayload,
  sku: OneTimeSku,
  userId: string,
): Promise<{ ok: boolean }> {
  // Compare paid and expected amounts in pay_currency. price_amount is fiat.
  // H8 fix: Cross-check IPN price_amount against SKU price
  const skuPriceUsd = sku.priceUsd ?? ipn.price_amount;
  const ipnPriceUsd = ipn.price_amount;
  const priceDiff = Math.abs(ipnPriceUsd - skuPriceUsd);
  if (skuPriceUsd > 0 && priceDiff > skuPriceUsd * 0.01) {
    logger.error('[IPN/OneTime] Price mismatch — IPN amount differs from SKU price', {
      userId,
      paymentId: ipn.payment_id,
      ipnPriceAmount: ipnPriceUsd,
      skuPriceUsd,
      priceDiff,
    });
    return { ok: false };
  }

  const actuallyPaid = ipn.actually_paid;
  const amountCheck = checkCryptoPaidAmount(actuallyPaid, ipn.pay_amount, UNDERPAYMENT_THRESHOLD);
  if (amountCheck.status === 'missing-expected' || amountCheck.status === 'invalid') {
    logger.error('[IPN/OneTime] Paid amount cannot be verified without a valid crypto payment amount', {
      userId,
      paymentId: ipn.payment_id,
      payAmount: ipn.pay_amount,
      actuallyPaid,
      payCurrency: ipn.pay_currency,
    });
    return { ok: false };
  }
  if (amountCheck.status === 'underpaid') {
    const required = amountCheck.required;
    if (actuallyPaid !== undefined && actuallyPaid !== null) {
      logger.warn('[IPN/OneTime] Underpayment detected — not fulfilling', {
        userId,
        paymentId: ipn.payment_id,
        payAmount: ipn.pay_amount,
        payCurrency: ipn.pay_currency,
        actuallyPaid,
        required,
      });
      await markUnderpaid(ipn.payment_id, userId, sku, actuallyPaid, amountCheck.expected, ipn.pay_currency ?? 'unknown');
      return { ok: false };
    }
  }

  return { ok: true };
}

/**
 * Handle one-time IPN `refunded` event.
 * Marks row refunded, zeros credits, and revokes access to all linked videos.
 */
export async function handleOneTimeRefunded(
  ipn: NowPaymentsIpnPayload,
): Promise<Result<void, IPNError>> {
  try {
    const userId = parseUserIdFromOrderId(ipn.order_id ?? '');
    if (!userId) {
      logger.warn('[IPN/OneTime] refunded: cannot parse userId', { orderId: ipn.order_id });
      return success(undefined);
    }

    const existingPurchase = await getByPaymentId(ipn.payment_id);
    const purchaseId = existingPurchase?.id ?? null;

    await markRefunded(ipn.payment_id);
    await revokeRefundedPurchaseAccess(userId, purchaseId, ipn.payment_id);
    await recordRefundAudit(userId, purchaseId, ipn.payment_id);

    logger.info('[IPN/OneTime] Purchase refunded — credits zeroed, access revoked', {
      userId,
      purchaseId,
      paymentId: ipn.payment_id,
    });
    return success(undefined);
  } catch (err) {
    return failure(new IPNError('HANDLE_ONE_TIME_REFUNDED_FAILED', err));
  }
}
