/**
 * KV License Cache Types and Configuration
 *
 * @module worker/kv-license-cache-types
 */

/**
 * License context cached in KV
 */
export interface LicenseCacheData {
  tier: 'BASIC' | 'PREMIUM' | 'ENTERPRISE' | 'MASTER';
  agencyId?: string;
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
export const CACHE_CONFIG = {
  licenseTtlSeconds: 300, // 5 minutes
  keyPrefix: 'license:',
};

/**
 * Generate KV cache key for license
 */
export function getLicenseKey(licenseNonce: string): string {
  return `${CACHE_CONFIG.keyPrefix}${licenseNonce}`;
}
