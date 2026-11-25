/**
 * Commerce payment confirmation — the bridge between the protected
 * NOWPayments IPN chain and the commerce order lifecycle.
 *
 * Enforces:
 * - Fiat `priceAmount` & `priceCurrency` match `order.amountCents` & `order.currency` (within 1%)
 * - `checkCryptoPaidAmount(actuallyPaid, payAmount, UNDERPAYMENT_THRESHOLD).status === 'sufficient'`
 *   before `markOrderPaid`
 *
 * Contract with the webhook route: a non-commerce order_id MUST return
 * failure code ORDER_NOT_FOUND so the route falls through to the standard
 * tier-activation chain.
 *
 * @module land/commerce/commerce-payment
 */
import { inngest } from '@/seed/inngest/client';
import { success, failure, type Result } from '@/seed/types/result';
import { logger } from '@/seed/utils/logger-utility';
import { toError } from '@/seed/utils/to-error';
import { checkCryptoPaidAmount } from '@/land/billing/ipn-amount-check';
import { UNDERPAYMENT_THRESHOLD } from '@/land/billing/nowpayments-ipn-underpaid';
import { getOrder, markOrderPaid } from './commerce-order';
import {
  CommercePaymentSchema,
  type CommercePaymentInput,
  type PaymentErrorCode,
  type PaymentError,
  type PaymentOk,
} from './commerce-payment-types';

export {
  CommercePaymentSchema,
  type CommercePaymentInput,
  type PaymentErrorCode,
  type PaymentError,
  type PaymentOk,
};

const FIAT_PRICE_TOLERANCE_RATIO = 0.01;

/**
 * Apply a NOWPayments payment confirmation to a commerce order.
 * Returns success (markedPaid=false) for replays on already-paid orders.
 * Returns ORDER_NOT_FOUND for non-commerce order ids (webhook fall-through).
 */
export async function confirmCommercePayment(
  raw: unknown,
): Promise<Result<PaymentOk, PaymentError>> {
  const parsed = CommercePaymentSchema.safeParse(raw);
  if (!parsed.success) {
    return failure({ code: 'INVALID_INPUT', message: parsed.error.message });
  }
  const data = parsed.data;

  const orderResult = await getOrder(data.orderId);
  if (!orderResult.ok) {
    if (orderResult.error.code === 'NOT_FOUND') {
      return failure({
        code: 'ORDER_NOT_FOUND',
        message: `Commerce order ${data.orderId} not found`,
      });
    }
    const code = orderResult.error.code === 'WRITE_FAILED' ? 'WRITE_FAILED' : 'DB_UNAVAILABLE';
    return failure({ code, message: orderResult.error.message });
  }
  const order = orderResult.value;

  if (order.status === 'failed' || order.status === 'refunded') {
    return failure({
      code: 'WRITE_FAILED',
      message: `Order ${data.orderId} is ${order.status}; cannot confirm payment`,
    });
  }

  const expectedCurrency = order.currency.trim().toUpperCase();
  const receivedCurrency = data.priceCurrency.trim().toUpperCase();
  if (receivedCurrency !== expectedCurrency) {
    logger.warn('[commerce] Payment currency mismatch — rejecting confirmation', {
      orderId: data.orderId,
      paymentId: data.paymentId,
      expectedCurrency,
      receivedCurrency,
    });
    return failure({
      code: 'CURRENCY_MISMATCH',
      message: `Order ${data.orderId} expects currency ${expectedCurrency}, received ${receivedCurrency}`,
    });
  }

  const receivedPriceCents = data.priceAmount * 100;
  const maxDiffCents = Math.max(1, order.amountCents * FIAT_PRICE_TOLERANCE_RATIO);
  if (Math.abs(receivedPriceCents - order.amountCents) > maxDiffCents) {
    logger.warn('[commerce] Fiat price mismatch — rejecting confirmation', {
      orderId: data.orderId,
      paymentId: data.paymentId,
      expectedCents: order.amountCents,
      receivedCents: receivedPriceCents,
    });
    return failure({
      code: 'AMOUNT_MISMATCH',
      message: `Order ${data.orderId} expects ${order.amountCents} cents, received ${Math.round(receivedPriceCents)} cents`,
    });
  }

  const effectiveActuallyPaid = data.actuallyPaid ?? data.paidAmount;
  const cryptoCheck = checkCryptoPaidAmount(
    effectiveActuallyPaid,
    data.payAmount,
    UNDERPAYMENT_THRESHOLD,
  );
  if (cryptoCheck.status !== 'sufficient') {
    logger.warn('[commerce] Crypto payment verification failed — rejecting confirmation', {
      orderId: data.orderId,
      paymentId: data.paymentId,
      status: cryptoCheck.status,
      payAmount: data.payAmount,
      actuallyPaid: effectiveActuallyPaid,
    });
    return failure({
      code: 'UNDERPAID',
      message: `Crypto paid amount insufficient or unverified (${cryptoCheck.status}) for order ${data.orderId}`,
    });
  }

  const paid = await markOrderPaid(data.orderId, data.paymentId);
  if (!paid.ok) {
    return failure({ code: 'WRITE_FAILED', message: paid.error.message });
  }

  try {
    await inngest.send({
      name: 'commerce/payment.confirmed',
      data: {
        orderId: data.orderId,
        productId: order.productId,
        workspaceId: order.workspaceId,
        paymentId: data.paymentId,
        amountCents: order.amountCents,
        currency: order.currency,
      },
    });
  } catch (err) {
    logger.error('[commerce] fulfillment enqueue failed', toError(err), { orderId: data.orderId });
    return failure({
      code: 'WRITE_FAILED',
      message: `Paid but enqueue failed: ${toError(err).message}`,
    });
  }

  logger.info('[commerce] Payment confirmed', {
    orderId: data.orderId,
    paymentId: data.paymentId,
    markedPaid: paid.value.transitioned,
  });
  return success({
    orderId: data.orderId,
    status: 'paid',
    markedPaid: paid.value.transitioned,
    enqueued: true,
  });
}
