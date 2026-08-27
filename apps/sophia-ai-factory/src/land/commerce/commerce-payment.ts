/**
 * Commerce payment confirmation — the bridge between the protected
 * NOWPayments IPN chain and the commerce order lifecycle.
 *
 * The IPN webhook route (app/api/webhooks/nowpayments) routes commerce
 * order_ids here BEFORE the tier-activation chain, so the protected
 * payment flow (IPN → tier activation) stays untouched.
 *
 * Contract with the webhook route: a non-commerce order_id MUST return
 * failure code ORDER_NOT_FOUND so the route falls through to the standard
 * tier-activation chain. Any other failure code returns HTTP 500.
 *
 * Flow: payment confirmed → order pending→paid (markOrderPaid, idempotent)
 * → enqueue `commerce/payment.confirmed` → forest commerce-fulfillment
 * grants the digital product and emits `revenue/event.recorded`
 * (source='commerce', externalId=`commerce_{productId}_{orderId}`).
 *
 * Idempotent: double IPN is safe — markOrderPaid no-ops on already-paid
 * orders, and the revenue event id is deduped downstream by the ingestion
 * lock. Financial code: Result<T,E> everywhere, zero throw.
 *
 * @module land/commerce/commerce-payment
 */
import { z } from 'zod/v4';
import { inngest } from '@/seed/inngest/client';
import { success, failure, type Result } from '@/seed/types/result';
import { logger } from '@/seed/utils/logger-utility';
import { toError } from '@/seed/utils/to-error';
import { getOrder, markOrderPaid } from './commerce-order';

export const CommercePaymentSchema = z.object({
  orderId: z.string().min(1),
  paymentId: z.string().min(1),
  paymentStatus: z.enum(['confirmed', 'finished']),
  /** Amount actually paid, in the payment currency (float from NOWPayments). */
  paidAmount: z.number().positive().optional(),
  paidCurrency: z.string().min(1).optional(),
});

export type CommercePaymentInput = z.infer<typeof CommercePaymentSchema>;

export type PaymentErrorCode =
  | 'INVALID_INPUT'
  | 'DB_UNAVAILABLE'
  | 'ORDER_NOT_FOUND'
  | 'WRITE_FAILED';

export interface PaymentError {
  code: PaymentErrorCode;
  message: string;
}

export interface PaymentOk {
  orderId: string;
  status: string;
  /** True when this call moved the order to paid; false when already paid/fulfilled. */
  markedPaid: boolean;
  /** True when the fulfillment event was enqueued. */
  enqueued: boolean;
}

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
    // getOrder only fails with NOT_FOUND (handled above), DB_UNAVAILABLE,
    // or WRITE_FAILED — map to the payment error surface.
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

  const paid = await markOrderPaid(data.orderId, data.paymentId);
  if (!paid.ok) {
    return failure({ code: 'WRITE_FAILED', message: paid.error.message });
  }

  // Enqueue fulfillment. Inngest delivery + downstream locks make the whole
  // chain safe on redelivery; a send failure is surfaced for caller retry.
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
