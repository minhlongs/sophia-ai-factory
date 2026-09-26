/**
 * Dynamic Multi-Currency Foreign Exchange (FX) Converter
 *
 * Implements multi-currency conversion across USD, VND, EUR, JPY, SGD with
 * multi-tier resilience:
 * 1. Cloudflare KV Cache
 * 2. Live Edge Provider (with strict timeout)
 * 3. Static Bedrock Fallback Rates
 *
 * Layer: tree/billing (Pure domain service — imports only from seed)
 *
 * @module tree/billing/fx-converter
 */

import { logger } from '@/seed/utils/logger-utility';
import {
  type SupportedCurrency,
  type FxRateMap,
  isSupportedCurrency,
  ALL_SUPPORTED_CURRENCIES,
} from '@/seed/types/enterprise-billing';

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
  THB: 36.50,
  IDR: 16250.0,
};

export const BEDROCK_FX_RATES: FxRateMap & { rates: Record<SupportedCurrency, number> } = {
  base: 'USD',
  rates: BEDROCK_RATES_TABLE,
  fetchedAt: 1717000000000,
  ttlSeconds: 86400,
};

const KV_CACHE_KEY = 'fx_rates:usd:v1';
const LIVE_FX_ENDPOINT = 'https://api.exchangerate-api.com/v4/latest/USD';
const FETCH_TIMEOUT_MS = 2500;

interface MinimalKV {
  get(key: string): Promise<string | null>;
  put(key: string, value: string, options?: { expirationTtl?: number }): Promise<void>;
}

function resolveKv(env?: Record<string, unknown>): MinimalKV | null {
  if (env && typeof env === 'object') {
    if (env.KV_KV && typeof (env.KV_KV as MinimalKV).get === 'function') {
      return env.KV_KV as MinimalKV;
    }
    if (env.EXPERIMENT_KV && typeof (env.EXPERIMENT_KV as MinimalKV).get === 'function') {
      return env.EXPERIMENT_KV as MinimalKV;
    }
  }

  const globalScope = globalThis as Record<string, unknown>;
  if (globalScope.KV_KV && typeof (globalScope.KV_KV as MinimalKV).get === 'function') {
    return globalScope.KV_KV as MinimalKV;
  }
  if (globalScope.EXPERIMENT_KV && typeof (globalScope.EXPERIMENT_KV as MinimalKV).get === 'function') {
    return globalScope.EXPERIMENT_KV as MinimalKV;
  }

  return null;
}

/**
 * Retrieve current exchange rates with multi-tier resilience:
 * KV Cache -> Live Edge API -> Static Bedrock Fallback.
 */
export async function getLiveOrCachedFxRates(env?: Record<string, unknown>): Promise<FxRateMap> {
  const kv = resolveKv(env);

  // Tier 1: Check KV Cache
  if (kv) {
    try {
      const cached = await kv.get(KV_CACHE_KEY);
      if (cached) {
        const parsed = JSON.parse(cached) as FxRateMap;
        if (
          parsed &&
          parsed.base === 'USD' &&
          parsed.rates &&
          typeof parsed.rates.VND === 'number' &&
          typeof parsed.rates.EUR === 'number' &&
          typeof parsed.rates.JPY === 'number' &&
          typeof parsed.rates.SGD === 'number'
        ) {
          const ageMs = Date.now() - parsed.fetchedAt;
          if (ageMs < parsed.ttlSeconds * 1000) {
            return parsed;
          }
        }
      }
    } catch (kvErr) {
      logger.warn('[FxConverter] KV cache read failed, attempting live fetch', {
        error: String(kvErr),
      });
    }
  }

  // Tier 2: Live Edge Provider
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

    const response = await fetch(LIVE_FX_ENDPOINT, {
      signal: controller.signal,
    });
    clearTimeout(timer);

    if (response.ok) {
      const payload = (await response.json()) as {
        rates?: Record<string, unknown>;
      };

      if (payload?.rates && typeof payload.rates === 'object') {
        const rawRates = payload.rates;
        const liveRates: Record<SupportedCurrency, number> = {
          USD: 1.0,
          EUR: typeof rawRates.EUR === 'number' && rawRates.EUR > 0 ? rawRates.EUR : BEDROCK_FX_RATES.rates.EUR,
          GBP: typeof rawRates.GBP === 'number' && rawRates.GBP > 0 ? rawRates.GBP : BEDROCK_FX_RATES.rates.GBP,
          JPY: typeof rawRates.JPY === 'number' && rawRates.JPY > 0 ? rawRates.JPY : BEDROCK_FX_RATES.rates.JPY,
          SGD: typeof rawRates.SGD === 'number' && rawRates.SGD > 0 ? rawRates.SGD : BEDROCK_FX_RATES.rates.SGD,
          AUD: typeof rawRates.AUD === 'number' && rawRates.AUD > 0 ? rawRates.AUD : BEDROCK_FX_RATES.rates.AUD,
          CAD: typeof rawRates.CAD === 'number' && rawRates.CAD > 0 ? rawRates.CAD : BEDROCK_FX_RATES.rates.CAD,
          VND: typeof rawRates.VND === 'number' && rawRates.VND > 0 ? rawRates.VND : BEDROCK_FX_RATES.rates.VND,
          THB: typeof rawRates.THB === 'number' && rawRates.THB > 0 ? rawRates.THB : BEDROCK_FX_RATES.rates.THB,
          IDR: typeof rawRates.IDR === 'number' && rawRates.IDR > 0 ? rawRates.IDR : BEDROCK_FX_RATES.rates.IDR,
        };

        const freshRates: FxRateMap = {
          base: 'USD',
          rates: liveRates,
          fetchedAt: Date.now(),
          ttlSeconds: 3600,
        };

        // Asynchronously populate KV cache if available
        if (kv) {
          kv.put(KV_CACHE_KEY, JSON.stringify(freshRates), { expirationTtl: 3600 }).catch(
            (putErr) => {
              logger.warn('[FxConverter] KV cache put failed (non-fatal)', {
                error: String(putErr),
              });
            },
          );
        }

        return freshRates;
      }
    }
  } catch (fetchErr) {
    logger.warn('[FxConverter] Live FX fetch failed or timed out, resorting to bedrock rates', {
      error: String(fetchErr),
    });
  }

  // Tier 3: Static Bedrock Fallback Rates
  return {
    ...BEDROCK_FX_RATES,
    fetchedAt: Date.now(),
  };
}

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
    throw new Error(`Invalid source currency: "${String(from)}". Supported: ${ALL_SUPPORTED_CURRENCIES.join(', ')}`);
  }
  if (!isSupportedCurrency(to)) {
    throw new Error(`Invalid target currency: "${String(to)}". Supported: ${ALL_SUPPORTED_CURRENCIES.join(', ')}`);
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
  const defaultLocale =
    currency === 'VND'
      ? 'vi-VN'
      : currency === 'JPY'
        ? 'ja-JP'
        : currency === 'IDR'
          ? 'id-ID'
          : currency === 'THB'
            ? 'th-TH'
            : currency === 'EUR'
              ? 'de-DE'
              : currency === 'GBP'
                ? 'en-GB'
                : currency === 'SGD'
                  ? 'en-SG'
                  : currency === 'AUD'
                    ? 'en-AU'
                    : currency === 'CAD'
                      ? 'en-CA'
                      : 'en-US';

  const effectiveLocale = locale ?? defaultLocale;
  const majorAmount = amountCents / 100;

  return new Intl.NumberFormat(effectiveLocale, {
    style: 'currency',
    currency,
    minimumFractionDigits: isZeroDecimal ? 0 : 2,
    maximumFractionDigits: isZeroDecimal ? 0 : 2,
  }).format(majorAmount);
}
