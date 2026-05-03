/**
 * KV License Cache for Cloudflare Worker
 *
 * Caches license context for fast JWT claims enrichment at the edge.
 * TTL: 5 minutes for license data to balance freshness and performance.
 *
 * @module worker/kv-license-cache
 */

import { logger } from '@/seed/utils/logger-utility';

/**
 * License context cached in KV
 */
export interface LicenseCacheData {
  tier: 'BASIC' | 'PREMIUM' | 'ENTERPRISE' | 'MASTER';
  agencyId?: string;
  polarCustomerId?: string;
  polarSubscriptionStatus?: string;
  expiresAt?: number;
  createdAt: number;
  featureEntitlements: string[];
  featureLimits: Record<string, FeatureLimit>;
  dunningState: 'ok' | 'grace_period' | 'suspended' | 'delinquent';
  cachedAt: number;
}

/**
 * Feature limit structure
 */
export interface FeatureLimit {
  daily_limit?: number;
  monthly_limit?: number;
  max_tokens?: number;
}

/**
 * Cache TTL configuration
 */
const CACHE_CONFIG = {
  licenseTtlSeconds: 300, // 5 minutes
  keyPrefix: 'license:',
};

/**
 * Generate KV cache key for license
 */
function getLicenseKey(licenseNonce: string): string {
  return `${CACHE_CONFIG.keyPrefix}${licenseNonce}`;
}

/**
 * Get license from KV cache
 *
 * @param licenseNonce - License identifier
 * @param kv - Cloudflare KV namespace
 * @returns Cached license data or null if not found/expired
 */
export async function getLicenseFromCache(
  licenseNonce: string,
  kv: KVNamespace
): Promise<LicenseCacheData | null> {
  try {
    const key = getLicenseKey(licenseNonce);
    const cached = await kv.get<LicenseCacheData>(key);

    if (!cached) {
      return null;
    }

    // Check if cache is expired (defensive check, KV TTL should handle this)
    const now = Date.now();
    const maxAge = now - cached.cachedAt;
    if (maxAge > CACHE_CONFIG.licenseTtlSeconds * 1000) {
      // Cache expired, delete it
      await kv.delete(key);
      return null;
    }

    return cached;
  } catch (error) {
    logger.error('[KV License Cache] Cache read error', error instanceof Error ? error : new Error(String(error)));
    return null;
  }
}

/**
 * Cache license data in KV
 *
 * @param licenseNonce - License identifier
 * @param data - License data to cache
 * @param kv - Cloudflare KV namespace
 * @returns true if cached successfully
 */
export async function cacheLicense(
  licenseNonce: string,
  data: LicenseCacheData,
  kv: KVNamespace
): Promise<boolean> {
  try {
    const key = getLicenseKey(licenseNonce);
    const cacheData: LicenseCacheData = {
      ...data,
      cachedAt: Date.now(),
    };

    await kv.put(key, JSON.stringify(cacheData), {
      expirationTtl: CACHE_CONFIG.licenseTtlSeconds,
    });

    return true;
  } catch (error) {
    logger.error('[KV License Cache] Cache write error', error instanceof Error ? error : new Error(String(error)));
    return false;
  }
}

/**
 * Invalidate license cache (e.g., after subscription change)
 *
 * @param licenseNonce - License identifier
 * @param kv - Cloudflare KV namespace
 * @returns true if deleted successfully
 */
export async function invalidateLicense(
  licenseNonce: string,
  kv: KVNamespace
): Promise<boolean> {
  try {
    const key = getLicenseKey(licenseNonce);
    await kv.delete(key);
    return true;
  } catch (error) {
    logger.error('[KV License Cache] Cache invalidation error', error instanceof Error ? error : new Error(String(error)));
    return false;
  }
}

/**
 * Batch invalidate multiple licenses (for bulk operations)
 *
 * @param licenseNonces - Array of license identifiers
 * @param kv - Cloudflare KV namespace
 */
export async function batchInvalidateLicenses(
  licenseNonces: string[],
  kv: KVNamespace
): Promise<void> {
  const keys = licenseNonces.map(nonce => getLicenseKey(nonce));
  await Promise.all(keys.map(key => kv.delete(key)));
}

/**
 * Get cache statistics for monitoring
 *
 * @param kv - Cloudflare KV namespace
 * @returns Cache statistics
 */
export async function getCacheStats(kv: KVNamespace): Promise<{
  totalKeys: number;
  keyPrefix: string;
}> {
  try {
    // Note: KV doesn't provide efficient count by prefix
    // This is a placeholder for future implementation
    return {
      totalKeys: 0,
      keyPrefix: CACHE_CONFIG.keyPrefix,
    };
  } catch (error) {
    logger.error('[KV License Cache] Stats error', error instanceof Error ? error : new Error(String(error)));
    return {
      totalKeys: 0,
      keyPrefix: CACHE_CONFIG.keyPrefix,
    };
  }
}
