/**
 * Commerce Payment Confirmation Schemas & Types
 *
 * @module land/commerce/commerce-payment-types
 */
import { z } from 'zod/v4';

export const CommercePaymentSchema = z.object({
  orderId: z.string().min(1),
  paymentId: z.string().min(1),
  paymentStatus: z.enum(['confirmed', 'finished']),
  /** Fiat invoice amount from NOWPayments (`ipn.price_amount`). */
  priceAmount: z.number().positive(),
  /** Fiat invoice currency from NOWPayments (`ipn.price_currency`). */
  priceCurrency: z.string().min(1),
  /** Expected crypto amount in `pay_currency` (`ipn.pay_amount`). */
  payAmount: z.number().positive().optional(),
  /** Actual crypto amount received (`ipn.actually_paid`). */
  actuallyPaid: z.number().nonnegative().optional(),
  /** Legacy alias for `actuallyPaid`. */
  paidAmount: z.number().nonnegative().optional(),
  paidCurrency: z.string().min(1).optional(),
});

export type CommercePaymentInput = z.infer<typeof CommercePaymentSchema>;

export type PaymentErrorCode =
  | 'INVALID_INPUT'
  | 'DB_UNAVAILABLE'
  | 'ORDER_NOT_FOUND'
  | 'AMOUNT_MISMATCH'
  | 'CURRENCY_MISMATCH'
  | 'UNDERPAID'
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
