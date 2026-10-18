import { logger } from '@/seed/utils/logger-utility';
import type { FxRateMap } from '@/seed/types/enterprise-billing';
import { BEDROCK_FX_RATES } from './bedrock-rates';
import {
  KV_CACHE_KEY,
  resolveKv,
  buildLiveRates,
  readCachedFxRates,
} from './live-fetcher-cache';

const LIVE_FX_ENDPOINT = 'https://api.exchangerate-api.com/v4/latest/USD';
const FETCH_TIMEOUT_MS = 2500;

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
