import type { SupportedCurrency, FxRateMap } from '@/seed/types/enterprise-billing';

/**
 * Static bedrock fallback rates (Base: USD).
 * Guaranteed to exist even during complete network/KV outage.
 */
export const BEDROCK_RATES_TABLE: Record<SupportedCurrency, number> = {
  USD: 1.0,
  EUR: 0.92,
  GBP: 0.78,
  JPY: 155.0,
  SGD: 1.35,
  AUD: 1.52,
  CAD: 1.36,
  VND: 25450.0,
  THB: 36.5,
  IDR: 16250.0,
};

export const BEDROCK_FX_RATES: FxRateMap & { rates: Record<SupportedCurrency, number> } = {
  base: 'USD',
  rates: BEDROCK_RATES_TABLE,
  fetchedAt: 1717000000000,
  ttlSeconds: 86400,
};
