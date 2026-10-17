/**
 * Localized Payment Rails Intent & Transaction Record Interfaces
 *
 * Layer: seed/types (Foundational — zero dependencies on upper layers)
 *
 * @module seed/types/localized-rails-records
 */

import type { SupportedCurrency, BillingCycle } from './enterprise-billing';
import type {
  LocalizedPaymentRail,
  LocalizedTransactionStatus,
} from './localized-rails';

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
