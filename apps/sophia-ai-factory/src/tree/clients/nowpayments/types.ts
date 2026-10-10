/**
 * Types and interfaces for NOWPayments integration.
 *
 * @module tree/clients/nowpayments/types
 */

import type { Tier, OneTimeSku } from '@/seed/types';

export interface CreateCheckoutInput {
  tierId: string;
  userId: string;
  customerEmail?: string;
  period?: 'monthly' | 'yearly';
  orderId?: string;
  priceAmountOverride?: number;
}

export interface CreateOneTimeCheckoutInput {
  skuId: string;
  userId: string;
  customerEmail?: string;
  orderId?: string;
}

/** Internal adapter output — structurally compatible with NowPaymentsIpnPayload. */
export interface IpnPayloadResult {
  payment_id: string;
  payment_status: string;
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
  customer_email?: string;
}

export interface NowPaymentsTierConfig {
  tier: Tier;
  invoiceId: string;
  yearlyInvoiceId?: string;
  price: number;
  yearlyPrice: number;
  currency: string;
  name: string;
}

export type InvoiceLookup =
  | { kind: 'subscription'; tier: Tier; config: NowPaymentsTierConfig }
  | { kind: 'one_time'; sku: OneTimeSku }
  | null;
