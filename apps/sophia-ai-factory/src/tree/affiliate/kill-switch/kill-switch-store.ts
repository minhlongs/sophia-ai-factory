/**
 * Affiliate Emergency Kill Switch Store
 *
 * Provides high-availability, tenant-isolated state management for immediately freezing
 * automated video production, syndication, and campaign scaling.
 *
 * Hierarchy:
 * 1. In-memory hot cache (instant response)
 * 2. Cloudflare KV namespace (edge replication)
 * 3. Encrypted Cloudflare D1 via platform-config-repo (durable tenant-scoped persistence)
 *
 * Layer: tree/affiliate/kill-switch (Domain Logic)
 * @module tree/affiliate/kill-switch/kill-switch-store
 */

import type { KVNamespace } from '@cloudflare/workers-types';
import {
  getPlatformConfig,
  setPlatformConfig,
  type PlatformConfigKey,
} from '@/seed/db/platform-config-repo';
import { logger } from '@/seed/utils/logger-utility';

const inMemoryCache = new Map<string, { active: boolean; cachedAtMs: number }>();
const CACHE_TTL_MS = 10_000; // 10s local cache TTL

function getKv(): KVNamespace | null {
  const env = (globalThis as unknown as { __env?: Record<string, unknown> }).__env;
  if (env?.AFFILIATE_KV) return env.AFFILIATE_KV as KVNamespace;
  const g = (globalThis as Record<string, unknown>).__AFFILIATE_KV as KVNamespace | undefined;
  return g ?? null;
}

function resolveD1KillSwitchKey(tenantId: string): PlatformConfigKey {
  if (!tenantId || tenantId === 'default') {
    return 'affiliate_kill_switch_active';
  }
  return `affiliate_kill_switch_active:${tenantId}`;
}

async function isSingleKillSwitchActive(tenantId: string, strict = false): Promise<boolean> {
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

  // 2. Check tenant-scoped D1 platform config
  try {
    const d1Key = resolveD1KillSwitchKey(tenantId);
    const configVal = await getPlatformConfig(d1Key);
    const isActive = configVal === 'true';
    inMemoryCache.set(cacheKey, { active: isActive, cachedAtMs: now });
    return isActive;
  } catch (err) {
    logger.warn('[kill-switch-store] D1 read failed', {
      error: err instanceof Error ? err.message : String(err),
    });
    if (strict) throw err instanceof Error ? err : new Error(String(err));
    // Legacy boolean helper keeps its historical fail-open behaviour. New
    // gates MUST use getAffiliateKillSwitchState() instead.
    return false;
  }
}

export interface KillSwitchState {
  /** `true` also when the state could not be read — side effects fail closed. */
  active: boolean;
  /** `false` means the store/KV/D1 read failed; never present this as "off". */
  known: boolean;
  reason?: string;
}

/**
 * State-aware kill switch read for gates and UI. Unlike the boolean helper
 * below, a read error is surfaced as `{ active: true, known: false }` rather
 * than being silently converted into "not active".
 */
export async function getAffiliateKillSwitchState(tenantId = 'default'): Promise<KillSwitchState> {
  try {
    const active = await isAffiliateKillSwitchActive(tenantId, true);
    return { active, known: true };
  } catch (err) {
    return {
      active: true,
      known: false,
      reason: err instanceof Error ? err.message : String(err),
    };
  }
}

/**
 * Checks if the Affiliate Kill Switch is currently active for the given tenant.
 * Evaluates BOTH platform-wide ('default') AND tenant-specific switches.
 * If the platform-wide kill switch is engaged, all tenants are immediately frozen.
 */
export async function isAffiliateKillSwitchActive(tenantId = 'default', strict = false): Promise<boolean> {
  // 1. Always evaluate platform-wide switch first
  const platformGlobalActive = await isSingleKillSwitchActive('default', strict);
  if (platformGlobalActive) {
    return true;
  }

  // 2. If inspecting a specific tenant, evaluate their switch
  if (tenantId && tenantId !== 'default') {
    return isSingleKillSwitchActive(tenantId, strict);
  }

  return false;
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

  inMemoryCache.set(cacheKey, { active, cachedAtMs: now });

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

  try {
    const d1Key = resolveD1KillSwitchKey(tenantId);
    await setPlatformConfig(d1Key, active ? 'true' : 'false', updatedBy);
    inMemoryCache.set(cacheKey, { active, cachedAtMs: Date.now() });
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
