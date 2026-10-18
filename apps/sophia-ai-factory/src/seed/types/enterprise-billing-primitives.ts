/**
 * Enterprise Billing Primitive Enums, Constants, and Type Guards
 *
 * Layer: seed/types (Foundational - zero external runtime dependencies)
 * @module seed/types/enterprise-billing-primitives
 */

export type SupportedCurrency =
  | 'USD'
  | 'EUR'
  | 'GBP'
  | 'JPY'
  | 'SGD'
  | 'AUD'
  | 'CAD'
  | 'VND'
  | 'THB'
  | 'IDR';

export const ALL_SUPPORTED_CURRENCIES: readonly SupportedCurrency[] = [
  'USD',
  'EUR',
  'GBP',
  'JPY',
  'SGD',
  'AUD',
  'CAD',
  'VND',
  'THB',
  'IDR',
] as const;

export function isSupportedCurrency(value: unknown): value is SupportedCurrency {
  return typeof value === 'string' && (ALL_SUPPORTED_CURRENCIES as readonly string[]).includes(value);
}

export function isZeroDecimalCurrency(currency: SupportedCurrency): boolean {
  return currency === 'JPY' || currency === 'VND' || currency === 'IDR';
}

export interface FxRateMap {
  base: 'USD';
  rates: Partial<Record<SupportedCurrency, number>>;
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
