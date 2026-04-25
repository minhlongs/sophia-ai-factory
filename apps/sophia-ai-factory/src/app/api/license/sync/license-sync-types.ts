/**
 * Types and config for License Sync API
 * @module api/license/sync/license-sync-types
 */

export interface SyncRequestBody {
  licenseNonce: string;
}

export interface SyncResult {
  success: boolean;
  license?: {
    nonce: string;
    tier: string;
    status: string;
    expiresAt?: number | null;
    polarCustomerId?: string | null;
    polarSubscriptionStatus?: string;
    featureEntitlements: string[];
    dunningState: string;
  };
  error?: string;
  syncSource: 'gateway' | 'cache' | 'database' | 'none' | 'gateway-fallback-db';
  kvCacheInvalidated: boolean;
}

export const RAAS_CONFIG = {
  baseURL: process.env.RAAS_GATEWAY_BASE_URL || 'https://raas.agencyos.network',
  apiKey: process.env.RAAS_API_KEY || '',
  timeout: 10000,
}
