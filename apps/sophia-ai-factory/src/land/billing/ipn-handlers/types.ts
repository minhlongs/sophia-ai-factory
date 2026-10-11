/**
 * NOWPayments IPN Types and Constants
 * @module land/billing/ipn-handlers/types
 */

export interface NowPaymentsIpnPayload {
  payment_id: string;
  payment_status: 'waiting' | 'confirming' | 'confirmed' | 'sending' | 'partially_paid' | 'finished' | 'failed' | 'refunded' | 'expired';
  pay_address?: string;
  price_amount: number;
  price_currency: string;
  pay_amount?: number;
  pay_currency?: string;
  order_id?: string;
  order_description?: string;
  invoice_id?: string;
  actually_paid?: number;
  outcome_amount?: number;
  outcome_currency?: string;
  /** Customer email passed at invoice creation time — used for auto-handover. */
  customer_email?: string;
}

export const MAX_DLQ_RETRIES = 3;
export const DLQ_SIZE_CAP = 1000;
