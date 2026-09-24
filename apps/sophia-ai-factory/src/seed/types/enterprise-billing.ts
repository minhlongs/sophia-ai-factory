/**
 * Enterprise Billing, Multi-Currency FX, and Automated E-Invoicing Types
 *
 * Layer: seed/types (Foundational - zero external runtime dependencies, 0 upper layer imports)
 *
 * @module seed/types/enterprise-billing
 */

export type SupportedCurrency = 'USD' | 'VND' | 'EUR' | 'JPY' | 'SGD';

export const ALL_SUPPORTED_CURRENCIES: readonly SupportedCurrency[] = [
  'USD',
  'VND',
  'EUR',
  'JPY',
  'SGD',
] as const;

export function isSupportedCurrency(value: unknown): value is SupportedCurrency {
  return typeof value === 'string' && ALL_SUPPORTED_CURRENCIES.includes(value as SupportedCurrency);
}

export interface FxRateMap {
  base: 'USD';
  rates: Record<SupportedCurrency, number>;
  fetchedAt: number;
  ttlSeconds: number;
}

export type InvoiceStatus = 'draft' | 'issued' | 'paid' | 'void';

export const ALL_INVOICE_STATUSES: readonly InvoiceStatus[] = [
  'draft',
  'issued',
  'paid',
  'void',
] as const;

export function isInvoiceStatus(value: unknown): value is InvoiceStatus {
  return typeof value === 'string' && ALL_INVOICE_STATUSES.includes(value as InvoiceStatus);
}

export type TaxFormType = 'W8_BEN' | 'W9' | 'NONE';

export const ALL_TAX_FORM_TYPES: readonly TaxFormType[] = ['W8_BEN', 'W9', 'NONE'] as const;

export function isTaxFormType(value: unknown): value is TaxFormType {
  return typeof value === 'string' && ALL_TAX_FORM_TYPES.includes(value as TaxFormType);
}

export type BillingCycle = 'monthly' | 'annual' | 'one_time';

export const ALL_BILLING_CYCLES: readonly BillingCycle[] = ['monthly', 'annual', 'one_time'] as const;

export function isBillingCycle(value: unknown): value is BillingCycle {
  return typeof value === 'string' && ALL_BILLING_CYCLES.includes(value as BillingCycle);
}

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

export interface AnnualCommitmentQuote {
  tier: string;
  billingCycle: 'annual';
  currency: SupportedCurrency;
  monthlyPriceCents: number;
  annualPriceCents: number;
  discountPercentage: number;
  monthsFree: number;
  savingsCents: number;
  fxRate: number;
  convertedMonthlyPrice: string;
  convertedAnnualPrice: string;
  convertedSavings: string;
}

export interface ProrationAdjustment {
  currentTier: string;
  newTier: string;
  daysRemainingInCycle: number;
  totalDaysInCycle: number;
  unusedAmountCents: number;
  proratedNewTierCents: number;
  netAmountDueCents: number;
  creditCents: number;
  isUpgrade: boolean;
  currency: SupportedCurrency;
  fxRate: number;
}
