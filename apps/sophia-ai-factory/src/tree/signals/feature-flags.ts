/**
 * Server-side PostHog feature flag evaluation with EXPERIMENT_KV cache
 * RED-TEAM #9: 60s TTL caps PostHog /decide/ calls to 1/user/minute
 */

import { logger } from '@/seed/utils/logger-utility'
import { getErrorMessage } from '@/seed/utils/to-error'
import { shouldAllowRequest, recordSuccess, recordFailure } from '@/seed/security/circuit-breaker'
import { classifyError } from '@/seed/types/failure-kind'

const POSTHOG_DECIDE_URL = 'https://us.i.posthog.com/decide/?v=3'
const CACHE_TTL_SECONDS = 60

/**
 * Get Cloudflare KV namespace — injected via runtime env binding
 */
function getKv(): KVNamespace | null {
  // CF Workers runtime injects EXPERIMENT_KV as a global binding
  const kv = (globalThis as Record<string, unknown>)['EXPERIMENT_KV'] as KVNamespace | undefined
  return kv ?? null
}

/**
 * Evaluate a single feature flag for a distinct_id.
 * Caches PostHog /decide/ response in EXPERIMENT_KV for 60s.
 * Returns the flag value (string/boolean) or null if not found.
 */
export async function flag(
  flagName: string,
  distinctId: string,
): Promise<string | boolean | null> {
  const cacheKey = `flag:${flagName}:${distinctId}`
  const kv = getKv()

  // Cache hit
  if (kv) {
    try {
      const cached = await kv.get(cacheKey)
      if (cached !== null) {
        try {
          return JSON.parse(cached) as string | boolean
        } catch {
          return cached
        }
      }
    } catch (err) {
      logger.warn('[signals] KV get failed', {
        error: getErrorMessage(err),
      })
    }
  }

  const apiKey = process.env.POSTHOG_PROJECT_KEY
  if (!apiKey) {
    logger.warn('[signals] POSTHOG_PROJECT_KEY not set — flag returns null')
    return null
  }

  // Cache miss: call PostHog /decide/
  let flagValue: string | boolean | null = null
  try {
    const res = await fetch(POSTHOG_DECIDE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ api_key: apiKey, distinct_id: distinctId }),
    })

    if (res.ok) {
      const data = (await res.json()) as { featureFlags?: Record<string, string | boolean> }
      flagValue = data.featureFlags?.[flagName] ?? null
    } else {
      logger.warn('[signals] PostHog /decide/ non-OK', { status: res.status })
    }
  } catch (err) {
    logger.warn('[signals] PostHog /decide/ failed', {
      error: getErrorMessage(err),
    })
  }

  // Write to cache (fire-and-forget)
  if (kv && flagValue !== null) {
    kv.put(cacheKey, JSON.stringify(flagValue), { expirationTtl: CACHE_TTL_SECONDS }).catch(
      () => {},
    )
  }

  return flagValue
}

/**
 * Evaluate all feature flags for a distinct_id.
 * Returns full featureFlags map from PostHog /decide/.
 */
export async function getAllFlags(
  distinctId: string,
): Promise<Record<string, string | boolean>> {
  const cacheKey = `flags:all:${distinctId}`
  const kv = getKv()

  if (kv) {
    try {
      const cached = await kv.get(cacheKey)
      if (cached) {
        return JSON.parse(cached) as Record<string, string | boolean>
      }
    } catch {}
  }

  const apiKey = process.env.POSTHOG_PROJECT_KEY
  if (!apiKey) return {}

  try {
    const res = await fetch(POSTHOG_DECIDE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ api_key: apiKey, distinct_id: distinctId }),
    })

    if (res.ok) {
      const data = (await res.json()) as { featureFlags?: Record<string, string | boolean> }
      const flags = data.featureFlags ?? {}
      if (kv) {
        kv.put(cacheKey, JSON.stringify(flags), { expirationTtl: CACHE_TTL_SECONDS }).catch(() => {})
      }
      return flags
    }
  } catch {}

  return {}
}
