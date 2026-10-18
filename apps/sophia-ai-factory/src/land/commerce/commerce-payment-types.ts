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
