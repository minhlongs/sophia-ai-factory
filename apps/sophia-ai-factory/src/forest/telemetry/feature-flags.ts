/**
 * Server-side PostHog feature flag evaluation with EXPERIMENT_KV cache
 * RED-TEAM #9: 60s TTL caps PostHog /decide/ calls to 1/user/minute
 */

import { logger } from '@/seed/utils/logger-utility';
import { getErrorMessage } from '@/seed/utils/to-error';
import {
  POSTHOG_DECIDE_URL,
  CACHE_TTL_SECONDS,
  getKv,
  getAllFlags,
} from './feature-flags-helpers';

export { getAllFlags };

/**
 * Evaluate a single feature flag for a distinct_id.
 * Caches PostHog /decide/ response in EXPERIMENT_KV for 60s.
 * Returns the flag value (string/boolean) or null if not found.
 */
export async function flag(
  flagName: string,
  distinctId: string,
): Promise<string | boolean | null> {
  const cacheKey = `flag:${flagName}:${distinctId}`;
  const kv = getKv();

  // Cache hit
  if (kv) {
    try {
      const cached = await kv.get(cacheKey);
      if (cached !== null) {
        try {
          return JSON.parse(cached) as string | boolean;
        } catch {
          return cached;
        }
      }
    } catch (err) {
      logger.warn('[signals] KV get failed', {
        error: getErrorMessage(err),
      });
    }
  }

  const apiKey = process.env.POSTHOG_PROJECT_KEY;
  if (!apiKey) {
    logger.warn('[signals] POSTHOG_PROJECT_KEY not set — flag returns null');
    return null;
  }

  // Cache miss: call PostHog /decide/
  let flagValue: string | boolean | null = null;
  try {
    const res = await fetch(POSTHOG_DECIDE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ api_key: apiKey, distinct_id: distinctId }),
    });

    if (res.ok) {
      const data = (await res.json()) as { featureFlags?: Record<string, string | boolean> };
      flagValue = data.featureFlags?.[flagName] ?? null;
    } else {
      logger.warn('[signals] PostHog /decide/ non-OK', { status: res.status });
    }
  } catch (err) {
    logger.warn('[signals] PostHog /decide/ failed', {
      error: getErrorMessage(err),
    });
  }

  // Write to cache (fire-and-forget)
  if (kv && flagValue !== null) {
    kv.put(cacheKey, JSON.stringify(flagValue), { expirationTtl: CACHE_TTL_SECONDS }).catch(
      () => {},
    );
  }

  return flagValue;
}
