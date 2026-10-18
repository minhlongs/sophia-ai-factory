/**
 * Enterprise Billing, Multi-Currency FX, and Automated E-Invoicing Types
 *
 * Layer: seed/types (Foundational - zero external runtime dependencies, 0 upper layer imports)
 *
 * @module seed/types/enterprise-billing
 */

import type {
  BillingCycle,
  FxRateMap,
  InvoiceStatus,
  SupportedCurrency,
  TaxFormType,
} from './enterprise-billing-primitives';

export {
  ALL_BILLING_CYCLES,
  ALL_INVOICE_STATUSES,
  ALL_SUPPORTED_CURRENCIES,
  ALL_TAX_FORM_TYPES,
  isBillingCycle,
  isInvoiceStatus,
  isSupportedCurrency,
  isTaxFormType,
  isZeroDecimalCurrency,
} from './enterprise-billing-primitives';

export type {
  BillingCycle,
  FxRateMap,
  InvoiceStatus,
  SupportedCurrency,
  TaxFormType,
};

export {
  type AnnualCommitmentQuote,
  type ProrationAdjustment,
} from './enterprise-billing-quotes';

export type { TaxJurisdiction } from './tax-compliance';

export interface InvoiceLineItem {
  id: string;
  description: string;
  quantity: number;
  unitPriceCents: number;
  totalPriceCents: number;
}

export interface EInvoice {
  id: string;
  invoiceNumber: string;
  orgId: string;
  subaccountId?: string | null;
  tier: string;
  billingCycle: BillingCycle;
  amountCents: number;
  currency: SupportedCurrency;
  fxRate: number;
  taxId?: string | null;
  legalName: string;
  billingAddress: string;
  vatRate: number;
  vatAmountCents: number;
  totalAmountCents: number;
  taxFormType: TaxFormType;
  status: InvoiceStatus;
  pdfR2Key?: string | null;
  paidAt?: number | null;
  createdAt: number;
  updatedAt: number;
  lineItems?: InvoiceLineItem[];
  paymentRail?: 'NOWPAYMENTS' | 'PAYOS' | 'MANUAL' | null;
  paymentReference?: string | null;
}

export interface CreateInvoiceInput {
  orgId: string;
  subaccountId?: string | null;
  tier: string;
  billingCycle?: BillingCycle;
  amountCents: number;
  currency?: SupportedCurrency;
  fxRate?: number;
  taxId?: string | null;
  legalName: string;
  billingAddress: string;
  vatRate?: number;
  vatAmountCents?: number;
  totalAmountCents?: number;
  taxFormType?: TaxFormType;
  lineItems?: InvoiceLineItem[];
  paymentRail?: 'NOWPAYMENTS' | 'PAYOS' | 'MANUAL' | null;
  paymentReference?: string | null;
}

export interface UpdateInvoiceInput {
  status?: InvoiceStatus;
  paidAt?: number | null;
  pdfR2Key?: string | null;
  taxId?: string | null;
  legalName?: string;
  billingAddress?: string;
  vatRate?: number;
  taxFormType?: TaxFormType;
}
