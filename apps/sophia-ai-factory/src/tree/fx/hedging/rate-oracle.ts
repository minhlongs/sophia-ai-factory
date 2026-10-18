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
import { BEDROCK_RATES_TABLE } from '@/tree/billing/fx-converter';
import {
  KV_FX_CACHE_KEY,
  LIVE_TIMEOUT_MS,
  type MinimalKV,
  type FxRateFetchResult,
} from './types';
import {
  resolveKv,
  tryReadCachedKvRates,
  parseLiveRates,
} from './rate-oracle-cache';

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
