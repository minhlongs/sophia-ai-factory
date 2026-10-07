/**
 * Affiliate Emergency Kill Switch Store
 *
 * Provides high-availability state management for immediately freezing
 * automated video production, syndication, and campaign scaling.
 *
 * Hierarchy:
 * 1. In-memory hot cache (instant response)
 * 2. Cloudflare KV namespace (edge replication)
 * 3. Encrypted Cloudflare D1 via platform-config-repo (durable persistence)
 *
 * Layer: tree/affiliate/kill-switch (Domain Logic)
 * @module tree/affiliate/kill-switch/kill-switch-store
 */

import type { KVNamespace } from '@cloudflare/workers-types';
import { getPlatformConfig, setPlatformConfig } from '@/seed/db/platform-config-repo';
import { logger } from '@/seed/utils/logger-utility';

// In-memory hot cache per isolate
const inMemoryCache = new Map<string, { active: boolean; cachedAtMs: number }>();
const CACHE_TTL_MS = 10_000; // 10s local cache TTL

function getKv(): KVNamespace | null {
  const env = (globalThis as unknown as { __env?: Record<string, unknown> }).__env;
  if (env?.AFFILIATE_KV) return env.AFFILIATE_KV as KVNamespace;
  const g = (globalThis as Record<string, unknown>).__AFFILIATE_KV as KVNamespace | undefined;
  return g ?? null;
}

/**
 * Checks if the Affiliate Kill Switch is currently active.
 */
export async function isAffiliateKillSwitchActive(tenantId = 'default'): Promise<boolean> {
  const cacheKey = `kill_switch:${tenantId}`;
  const now = Date.now();

  const cached = inMemoryCache.get(cacheKey);
  if (cached && now - cached.cachedAtMs < CACHE_TTL_MS) {
    return cached.active;
  }

  // 1. Check Cloudflare KV
  const kv = getKv();
  if (kv) {
    try {
      const kvVal = await kv.get(`affiliate:kill_switch:${tenantId}`);
      if (kvVal !== null) {
        const isActive = kvVal === 'true';
        inMemoryCache.set(cacheKey, { active: isActive, cachedAtMs: now });
        return isActive;
      }
    } catch (err) {
      logger.warn('[kill-switch-store] KV read failed, falling back to D1', {
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  // 2. Check D1 platform configs
  try {
    const configVal = await getPlatformConfig('affiliate_kill_switch_active');
    const isActive = configVal === 'true';
    inMemoryCache.set(cacheKey, { active: isActive, cachedAtMs: now });
    return isActive;
  } catch (err) {
    logger.warn('[kill-switch-store] D1 read failed, defaulting to false', {
      error: err instanceof Error ? err.message : String(err),
    });
    return false;
  }
}

/**
 * Sets the Affiliate Kill Switch status across in-memory cache, KV, and encrypted D1.
 */
export async function setAffiliateKillSwitch(
  active: boolean,
  tenantId = 'default',
  updatedBy?: string,
): Promise<boolean> {
  const cacheKey = `kill_switch:${tenantId}`;
  const now = Date.now();

  // 1. Update in-memory hot cache
  inMemoryCache.set(cacheKey, { active, cachedAtMs: now });

  // 2. Replicate to Cloudflare KV (30-day retention)
  const kv = getKv();
  if (kv) {
    try {
      await kv.put(`affiliate:kill_switch:${tenantId}`, active ? 'true' : 'false', {
        expirationTtl: 30 * 86400,
      });
    } catch (err) {
      logger.warn('[kill-switch-store] KV put failed', {
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  // 3. Persist to encrypted D1 platform config
  try {
    await setPlatformConfig(
      'affiliate_kill_switch_active',
      active ? 'true' : 'false',
      updatedBy,
    );
  } catch (err) {
    logger.error('[kill-switch-store] D1 persist failed', {
      error: err instanceof Error ? err.message : String(err),
    });
  }

  return active;
}

/**
 * Clears in-memory cache for deterministic testing.
 */
export function resetKillSwitchInMemoryCache(): void {
  inMemoryCache.clear();
}
