/**
 * Multi-source FX rate aggregator, stale check, and spread markup.
 *
 * Implements multi-tier resilience:
 * 1. Live Exchange Rates API
 * 2. Cloudflare KV Cache
 * 3. Immutable Bedrock Fallback
 *
 * Layer: tree/fx/hedging
 * Allowed imports: @/seed/*, @/tree/*
 */

import { logger } from '@/seed/utils/logger-utility';
import type { SupportedCurrency } from '@/seed/types/enterprise-billing';
import { BEDROCK_RATES_TABLE } from '@/tree/billing/fx-converter';
import {
  KV_FX_CACHE_KEY,
  LIVE_TIMEOUT_MS,
  type MinimalKV,
  type FxRateFetchResult,
} from './types';

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

async function tryReadCachedKvRates(kv: MinimalKV): Promise<FxRateFetchResult | null> {
  try {
    const cached = await kv.get(KV_FX_CACHE_KEY);
    if (!cached) return null;
    const parsed = JSON.parse(cached) as {
      rates: Record<SupportedCurrency, number>;
      sourceProvider: FxRateFetchResult['sourceProvider'];
      fetchedAt: number;
      ttlMs: number;
    };
    if (parsed?.rates && Date.now() - parsed.fetchedAt < (parsed.ttlMs ?? 3600000)) {
      return {
        rates: parsed.rates,
        sourceProvider: 'KV_CACHE',
        fetchedAt: parsed.fetchedAt,
      };
    }
  } catch (kvErr) {
    logger.warn('[FxHedgingEngine] KV cache read failed', { error: String(kvErr) });
  }
  return null;
}

function parseLiveRates(data: { rates?: Record<string, number> }): Record<SupportedCurrency, number> {
  return {
    USD: 1.0,
    EUR: Number(data.rates?.EUR) || BEDROCK_RATES_TABLE.EUR,
    GBP: Number(data.rates?.GBP) || BEDROCK_RATES_TABLE.GBP,
    JPY: Number(data.rates?.JPY) || BEDROCK_RATES_TABLE.JPY,
    SGD: Number(data.rates?.SGD) || BEDROCK_RATES_TABLE.SGD,
    AUD: Number(data.rates?.AUD) || BEDROCK_RATES_TABLE.AUD,
    CAD: Number(data.rates?.CAD) || BEDROCK_RATES_TABLE.CAD,
    VND: Number(data.rates?.VND) || BEDROCK_RATES_TABLE.VND,
    THB: Number(data.rates?.THB) || BEDROCK_RATES_TABLE.THB,
    IDR: Number(data.rates?.IDR) || BEDROCK_RATES_TABLE.IDR,
  };
}

async function tryFetchLiveRates(kv: MinimalKV | null): Promise<FxRateFetchResult | null> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), LIVE_TIMEOUT_MS);
    const response = await fetch('https://api.exchangerate-api.com/v4/latest/USD', {
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (response.ok) {
      const data = (await response.json()) as { rates?: Record<string, number> };
      if (data?.rates && typeof data.rates === 'object') {
        const result: FxRateFetchResult = {
          rates: parseLiveRates(data),
          sourceProvider: 'OPEN_EXCHANGE',
          fetchedAt: Date.now(),
        };

        if (kv) {
          kv.put(
            KV_FX_CACHE_KEY,
            JSON.stringify({ ...result, ttlMs: 3600000 }),
            { expirationTtl: 3600 },
          ).catch((e: unknown) => logger.warn('[FxHedgingEngine] KV put error', { error: String(e) }));
        }

        return result;
      }
    }
  } catch (liveErr) {
    logger.warn('[FxHedgingEngine] Live rate fetch failed, falling back', { error: String(liveErr) });
  }
  return null;
}

/**
 * Fetches market rates across all 10 currencies with multi-tier fallback:
 * Tier 1: Live Edge / ECB API
 * Tier 2: Open Exchange Rates
 * Tier 3: KV Cache
 * Tier 4: Bedrock Fallback
 */
export async function fetchMultiTierRates(env?: Record<string, unknown>): Promise<FxRateFetchResult> {
  const kv = resolveKv(env);
  if (kv) {
    const cachedResult = await tryReadCachedKvRates(kv);
    if (cachedResult) return cachedResult;
  }

  const liveResult = await tryFetchLiveRates(kv);
  if (liveResult) return liveResult;

  // Tier 4: Immutable Bedrock Fallback
  return {
    rates: { ...BEDROCK_RATES_TABLE },
    sourceProvider: 'BEDROCK_FALLBACK',
    fetchedAt: Date.now(),
  };
}
