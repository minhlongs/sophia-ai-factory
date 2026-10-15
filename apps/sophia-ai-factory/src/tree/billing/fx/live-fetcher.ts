import { logger } from '@/seed/utils/logger-utility';
import type { SupportedCurrency, FxRateMap } from '@/seed/types/enterprise-billing';
import { BEDROCK_FX_RATES } from './bedrock-rates';

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

function isValidFreshFxRateMap(parsed: FxRateMap | null | undefined): parsed is FxRateMap {
  if (
    !parsed ||
    parsed.base !== 'USD' ||
    !parsed.rates ||
    typeof parsed.rates.VND !== 'number' ||
    typeof parsed.rates.EUR !== 'number' ||
    typeof parsed.rates.JPY !== 'number' ||
    typeof parsed.rates.SGD !== 'number'
  ) {
    return false;
  }
  return Date.now() - parsed.fetchedAt < parsed.ttlSeconds * 1000;
}

function pickPositiveNumber(val: unknown, fallback: number): number {
  return typeof val === 'number' && val > 0 ? val : fallback;
}

function buildLiveRates(rawRates: Record<string, unknown>): Record<SupportedCurrency, number> {
  const b = BEDROCK_FX_RATES.rates;
  return {
    USD: 1.0,
    EUR: pickPositiveNumber(rawRates.EUR, b.EUR),
    GBP: pickPositiveNumber(rawRates.GBP, b.GBP),
    JPY: pickPositiveNumber(rawRates.JPY, b.JPY),
    SGD: pickPositiveNumber(rawRates.SGD, b.SGD),
    AUD: pickPositiveNumber(rawRates.AUD, b.AUD),
    CAD: pickPositiveNumber(rawRates.CAD, b.CAD),
    VND: pickPositiveNumber(rawRates.VND, b.VND),
    THB: pickPositiveNumber(rawRates.THB, b.THB),
    IDR: pickPositiveNumber(rawRates.IDR, b.IDR),
  };
}

async function readCachedFxRates(kv: MinimalKV | null): Promise<FxRateMap | null> {
  if (!kv) return null;
  try {
    const cached = await kv.get(KV_CACHE_KEY);
    if (!cached) return null;
    const parsed = JSON.parse(cached) as FxRateMap;
    return isValidFreshFxRateMap(parsed) ? parsed : null;
  } catch (kvErr) {
    logger.warn('[FxConverter] KV cache read failed, attempting live fetch', {
      error: String(kvErr),
    });
    return null;
  }
}

/**
 * Retrieve current exchange rates with multi-tier resilience:
 * KV Cache -> Live Edge API -> Static Bedrock Fallback.
 */
export async function getLiveOrCachedFxRates(env?: Record<string, unknown>): Promise<FxRateMap> {
  const kv = resolveKv(env);
  const cached = await readCachedFxRates(kv);
  if (cached) return cached;

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
        const freshRates: FxRateMap = {
          base: 'USD',
          rates: buildLiveRates(payload.rates),
          fetchedAt: Date.now(),
          ttlSeconds: 3600,
        };

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
