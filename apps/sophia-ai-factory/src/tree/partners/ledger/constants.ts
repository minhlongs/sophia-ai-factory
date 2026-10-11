import type { LedgerPayoutCurrency } from '@/seed/types/cross-border-ledger';

/**
 * Bedrock fallback exchange rates per 1.00 USD.
 * Used when real-time KV or live market feed is unavailable.
 */
export const BEDROCK_LEDGER_FX_RATES: Readonly<Record<LedgerPayoutCurrency, number>> = {
  USD: 1.0,
  VND: 25_450.0,
  EUR: 0.92,
  GBP: 0.78,
  JPY: 155.0,
  SGD: 1.34,
  AUD: 1.52,
  CAD: 1.36,
  THB: 36.5,
  IDR: 16_200.0,
};
