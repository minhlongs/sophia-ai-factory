/**
 * Server-side PostHog feature flag KV & bulk evaluation helpers
 */

import { logger } from '@/seed/utils/logger-utility';
import { shouldAllowRequest, recordSuccess, recordFailure } from '@/seed/security/circuit-breaker';
import { classifyError } from '@/seed/types/failure-kind';

export const POSTHOG_DECIDE_URL = 'https://us.i.posthog.com/decide/?v=3';
export const CACHE_TTL_SECONDS = 60;

/**
 * Get Cloudflare KV namespace — injected via runtime env binding
 */
export function getKv(): KVNamespace | null {
  const kv = (globalThis as Record<string, unknown>)['EXPERIMENT_KV'] as KVNamespace | undefined;
  return kv ?? null;
}

/**
 * Evaluate all feature flags for a distinct_id.
 * Returns full featureFlags map from PostHog /decide/.
 */
export async function getAllFlags(
  distinctId: string,
): Promise<Record<string, string | boolean>> {
  const cacheKey = `flags:all:${distinctId}`;
  const kv = getKv();

  if (kv) {
    try {
      const cached = await kv.get(cacheKey);
      if (cached) {
        return JSON.parse(cached) as Record<string, string | boolean>;
      }
    } catch {
      // ignore cache read failure
    }
  }

  const apiKey = process.env.POSTHOG_PROJECT_KEY;
  if (!apiKey) return {};

  if (!shouldAllowRequest('posthog')) {
    logger.warn('[signals] Circuit breaker open for posthog, returning empty flags');
    return {};
  }

  try {
    const res = await fetch(POSTHOG_DECIDE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ api_key: apiKey, distinct_id: distinctId }),
    });

    if (res.ok) {
      recordSuccess('posthog');
      const data = (await res.json()) as { featureFlags?: Record<string, string | boolean> };
      const flags = data.featureFlags ?? {};
      if (kv) {
        kv.put(cacheKey, JSON.stringify(flags), { expirationTtl: CACHE_TTL_SECONDS }).catch(() => {});
      }
      return flags;
    }
    recordFailure('posthog', classifyError(new Error(`HTTP ${res.status}`)));
  } catch (err) {
    recordFailure('posthog', classifyError(err));
  }

  return {};
}
