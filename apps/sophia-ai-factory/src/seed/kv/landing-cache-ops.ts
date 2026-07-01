/**
 * Landing Page KV Cache Operations.
 *
 * Caches LLM-generated landing page content in Cloudflare KV with 7-day TTL.
 * Uses the shared KV_KV namespace (same as quota cache), keyed with prefix
 * `landing:niche:{slug}`.
 *
 * @module seed/kv/landing-cache-ops
 */

import { logger } from '@/seed/utils/logger-utility';
import { toError } from '@/seed/utils/to-error';
import type {
  GeneratedLandingContent,
  CachedLandingContent,
} from '@/seed/types/landing-page-types';

const CACHE_KEY_PREFIX = 'landing:niche:';
const DEFAULT_TTL_SECONDS = 7 * 24 * 60 * 60; // 7 days

/** Get the Cloudflare KV binding from global scope. */
function getKvBinding(): KVNamespace | null {
  if (typeof globalThis !== 'undefined' && (globalThis as Record<string, unknown>).KV_KV) {
    return (globalThis as Record<string, unknown>).KV_KV as KVNamespace;
  }
  return null;
}

/** Build the cache key for a given niche slug. */
function cacheKey(slug: string): string {
  return `${CACHE_KEY_PREFIX}${slug}`;
}

/**
 * Retrieve cached landing page content from KV.
 * Returns null on miss, error, or if KV binding is unavailable.
 */
export async function getCachedLandingPage(
  slug: string,
): Promise<GeneratedLandingContent | null> {
  const kv = getKvBinding();
  if (!kv) return null;

  try {
    const raw = await kv.get<CachedLandingContent>(cacheKey(slug), 'json');
    if (!raw) {
      logger.debug('[LandingCache] KV miss', { slug });
      return null;
    }

    // Check if content is still fresh (within TTL)
    const age = Date.now() - raw.generatedAt;
    if (age > raw.ttl * 1000) {
      logger.debug('[LandingCache] Cached content expired', { slug, ageMs: age });
      return null;
    }

    logger.info('[LandingCache] KV hit', { slug, ageMinutes: Math.round(age / 60000) });
    return raw.content;
  } catch (err) {
    logger.warn('[LandingCache] KV get failed', { slug, error: toError(err).message });
    return null;
  }
}

/**
 * Store landing page content in KV with TTL.
 * No-op if KV binding is unavailable.
 */
export async function setCachedLandingPage(
  slug: string,
  nicheLabel: string,
  content: GeneratedLandingContent,
): Promise<void> {
  const kv = getKvBinding();
  if (!kv) return;

  try {
    const entry: CachedLandingContent = {
      content,
      nicheLabel,
      generatedAt: Date.now(),
      ttl: DEFAULT_TTL_SECONDS,
    };

    await kv.put(cacheKey(slug), JSON.stringify(entry), {
      expirationTtl: DEFAULT_TTL_SECONDS,
    });

    logger.info('[LandingCache] KV stored', { slug, ttlDays: 7 });
  } catch (err) {
    logger.warn('[LandingCache] KV put failed', { slug, error: toError(err).message });
  }
}
