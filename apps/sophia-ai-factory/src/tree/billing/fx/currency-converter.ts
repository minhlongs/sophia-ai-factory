import {
  type SupportedCurrency,
  type FxRateMap,
  isSupportedCurrency,
  ALL_SUPPORTED_CURRENCIES,
} from '@/seed/types/enterprise-billing';
import { BEDROCK_FX_RATES } from './bedrock-rates';

/**
 * Convert an amount in cents from one supported currency to another.
 * Handles negative amounts, zero, same-currency conversions, and custom rate overrides.
 */
export function convertCurrency(
  amountCents: number,
  from: SupportedCurrency,
  to: SupportedCurrency,
  customRates?: FxRateMap,
): { convertedCents: number; rate: number } {
  if (!isSupportedCurrency(from)) {
    throw new Error(
      `Invalid source currency: "${String(from)}". Supported: ${ALL_SUPPORTED_CURRENCIES.join(', ')}`,
    );
  }
  if (!isSupportedCurrency(to)) {
    throw new Error(
      `Invalid target currency: "${String(to)}". Supported: ${ALL_SUPPORTED_CURRENCIES.join(', ')}`,
    );
  }

  if (from === to) {
    return {
      convertedCents: Math.round(amountCents),
      rate: 1.0,
    };
  }

  const rates = customRates?.rates ?? BEDROCK_FX_RATES.rates;
  const fromRate = rates[from];
  const toRate = rates[to];

  if (typeof fromRate !== 'number' || !Number.isFinite(fromRate) || fromRate <= 0) {
    throw new Error(`Invalid exchange rate for source currency: ${from}`);
  }
  if (typeof toRate !== 'number' || !Number.isFinite(toRate) || toRate <= 0) {
    throw new Error(`Invalid exchange rate for target currency: ${to}`);
  }

  const rate = toRate / fromRate;
  const convertedCents = Math.round(amountCents * rate);

  return {
    convertedCents,
    rate,
  };
}

const DEFAULT_CURRENCY_LOCALE: Record<SupportedCurrency, string> = {
  VND: 'vi-VN',
  JPY: 'ja-JP',
  IDR: 'id-ID',
  THB: 'th-TH',
  EUR: 'de-DE',
  GBP: 'en-GB',
  SGD: 'en-SG',
  AUD: 'en-AU',
  CAD: 'en-CA',
  USD: 'en-US',
};

/**
 * Format an amount in cents into localized currency display text.
 * Respects decimal requirements per currency (e.g. 0 decimals for VND, JPY).
 */
export function formatCurrency(
  amountCents: number,
  currency: SupportedCurrency,
  locale?: string,
): string {
  if (!isSupportedCurrency(currency)) {
    throw new Error(`Invalid currency for formatting: "${String(currency)}"`);
  }

  const isZeroDecimal = currency === 'VND' || currency === 'JPY' || currency === 'IDR';
  const effectiveLocale = locale ?? DEFAULT_CURRENCY_LOCALE[currency] ?? 'en-US';
  const majorAmount = amountCents / 100;

  return new Intl.NumberFormat(effectiveLocale, {
    style: 'currency',
    currency,
    minimumFractionDigits: isZeroDecimal ? 0 : 2,
    maximumFractionDigits: isZeroDecimal ? 0 : 2,
  }).format(majorAmount);
}
