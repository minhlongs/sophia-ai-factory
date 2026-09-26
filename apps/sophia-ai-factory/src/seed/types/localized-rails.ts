/**
 * Localized Payment Rails Types & Interfaces
 *
 * Defines contracts for SEPA Direct Debit (EU), PromptPay (TH),
 * PayNow / GrabPay (SG/SEA), VietQR (VN), and Crypto rails.
 *
 * Layer: seed/types (Foundational — zero dependencies on upper layers)
 *
 * @module seed/types/localized-rails
 */

import type { SupportedCurrency, BillingCycle } from './enterprise-billing';

export type LocalizedPaymentRail =
  | 'SEPA_DIRECT_DEBIT'
  | 'PROMPTPAY'
  | 'PAYNOW'
  | 'GRABPAY'
  | 'PAYOS_VIETQR'
  | 'NOWPAYMENTS_CRYPTO';

export const ALL_LOCALIZED_PAYMENT_RAILS: readonly LocalizedPaymentRail[] = [
  'SEPA_DIRECT_DEBIT',
  'PROMPTPAY',
  'PAYNOW',
  'GRABPAY',
  'PAYOS_VIETQR',
  'NOWPAYMENTS_CRYPTO',
] as const;

export function isLocalizedPaymentRail(value: unknown): value is LocalizedPaymentRail {
  return typeof value === 'string' && (ALL_LOCALIZED_PAYMENT_RAILS as readonly string[]).includes(value);
}

export type LocalizedTransactionStatus =
  | 'pending'
  | 'processing'
  | 'authorized'
  | 'completed'
  | 'failed'
  | 'refunded'
  | 'charged_back'
  | 'expired';

export const ALL_LOCALIZED_TRANSACTION_STATUSES: readonly LocalizedTransactionStatus[] = [
  'pending',
  'processing',
  'authorized',
  'completed',
  'failed',
  'refunded',
  'charged_back',
  'expired',
] as const;

export interface SepaMandateInput {
  creditorId: string;
  creditorName: string;
  debtorName: string;
  debtorIban: string;
  debtorBic?: string;
  mandateReference?: string;
  signatureDate?: string;
  isRecurring?: boolean;
}

export interface SepaMandate {
  mandateReference: string;
  creditorId: string;
  creditorName: string;
  debtorName: string;
  maskedIban: string;
  bic?: string;
  signatureDate: string;
  status: 'active' | 'revoked';
  umr: string; // Unique Mandate Reference
}

export interface PromptPayQrInput {
  recipientId: string; // Mobile (08XXXXXXXX / 668XXXXXXXX) or Tax ID/National ID (13 digits)
  amount: number;      // THB major amount (e.g. 1500.50)
  oneTime?: boolean;
  transactionReference?: string;
}

export interface PromptPayQrPayload {
  qrString: string;
  transactionReference: string;
  amount: number;
  currency: 'THB';
  expiresAt: number;
}

export interface PayNowPayload {
  qrString: string;
  proxyType: 'uen' | 'mobile' | 'nric';
  proxyValue: string;
  amount: number;
  currency: 'SGD';
  reference: string;
  expiresAt: number;
}

export interface GrabPaySession {
  sessionId: string;
  checkoutUrl: string;
  paymentStatus: 'created' | 'completed' | 'failed';
  amount: number;
  currency: SupportedCurrency;
  expiresAt: number;
}

export interface LocalizedPaymentIntentInput {
  orgId: string;
  userId: string;
  tier: string;
  billingCycle: BillingCycle;
  rail: LocalizedPaymentRail;
  currency: SupportedCurrency;
  customerEmail: string;
  customerName: string;
  billingCountry: string;
  taxId?: string;
  customerType: 'B2B' | 'B2C';
  iban?: string;
  bic?: string;
  mobileNumber?: string;
  idempotencyKey?: string;
}

export interface LocalizedPaymentIntentResult {
  transactionId: string;
  status: LocalizedTransactionStatus;
  rail: LocalizedPaymentRail;
  currency: SupportedCurrency;
  baseAmountCents: number;
  subtotalAmount: number;
  taxAmount: number;
  totalAmount: number;
  totalAmountSubunits: number;
  qrPayload?: string;
  qrImageUrl?: string;
  mandateReference?: string;
  checkoutUrl?: string;
  expiresAt: number;
}

export interface LocalizedTransactionRecord {
  id: string;
  orgId: string;
  userId: string;
  tier: string;
  billingCycle: BillingCycle;
  paymentRail: LocalizedPaymentRail;
  baseCurrency: 'USD';
  baseAmountCents: number;
  settlementCurrency: SupportedCurrency | 'USDT' | 'USDC';
  settlementAmount: number;
  fxRateApplied: number;
  fxRateId?: string | null;
  taxJurisdiction: string;
  taxRate: number;
  taxAmountCents: number;
  taxIdentifier?: string | null;
  subtotalAmount: number;
  totalAmount: number;
  railTransactionReference?: string | null;
  qrPayload?: string | null;
  mandateReference?: string | null;
  status: LocalizedTransactionStatus;
  idempotencyKey: string;
  errorCode?: string | null;
  errorMessage?: string | null;
  settledAt?: number | null;
  expiresAt?: number | null;
  createdAt: number;
  updatedAt: number;
}
