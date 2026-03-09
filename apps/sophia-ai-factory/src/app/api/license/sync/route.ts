/**
 * License Sync API Endpoint
 *
 * Syncs license status from RaaS Gateway (raas.agencyos.network):
 * - Fetches current license state from gateway
 * - Updates local database cache
 * - Invalidates Cloudflare KV cache for edge workers
 * - Triggers JWT re-issuance with updated claims
 *
 * POST /api/license/sync
 * Body: { licenseNonce: string }
 *
 * @module api/license/sync
 */

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { logger } from '@/lib/utils/logger-utility';
import { RaasGatewayClient } from '@/lib/raas-gateway-client';
import { getKvClient } from '@/lib/redis';
import { logAuditEvent } from '@/lib/audit/audit-logger';

/**
 * Request body type
 */
interface SyncRequestBody {
  licenseNonce: string;
}

/**
 * Sync result response
 */
interface SyncResult {
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
  syncSource: 'gateway' | 'cache' | 'database';
  kvCacheInvalidated: boolean;
}

/**
 * RaaS Gateway configuration
 */
const RAAS_CONFIG = {
  baseURL: process.env.RAAS_GATEWAY_BASE_URL || 'https://raas.agencyos.network',
  apiKey: process.env.RAAS_API_KEY || '',
  timeout: 10000,
};

/**
 * POST - Sync license from RaaS Gateway
 *
 * Flow:
 * 1. Validate request body
 * 2. Fetch current license state from RaaS Gateway
 * 3. Update local database (raas_api_keys table)
 * 4. Invalidate Cloudflare KV cache
 * 5. Log audit event
 * 6. Return updated license status
 */
export async function POST(request: NextRequest): Promise<NextResponse<SyncResult>> {
  const requestId = `sync-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  try {
    // Parse request body
    const body = await request.json() as SyncRequestBody;

    if (!body.licenseNonce) {
      return NextResponse.json(
        {
          success: false,
          error: 'Missing licenseNonce in request body',
          syncSource: 'none',
          kvCacheInvalidated: false,
        },
        { status: 400 }
      );
    }

    const { licenseNonce } = body;

    logger.info('[License Sync] Starting sync', {
      requestId,
      licenseNonce: licenseNonce.slice(0, 8) + '...',
    });

    // Check if RaaS Gateway is configured
    if (!RAAS_CONFIG.apiKey) {
      logger.warn('[License Sync] RAAS_API_KEY not configured, falling back to database');

      // Fallback to database-only sync
      const result = await syncFromDatabase(licenseNonce);
      return NextResponse.json({
        ...result,
        syncSource: 'database',
      });
    }

    // Sync from RaaS Gateway
    const result = await syncFromGateway(licenseNonce, requestId);

    // Log audit event
    await logAuditEvent({
      action: 'license_sync',
      userId: 'system',
      metadata: {
        requestId,
        licenseNonce: licenseNonce.slice(0, 8) + '...',
        syncSource: result.syncSource,
        tier: result.license?.tier,
        kvCacheInvalidated: result.kvCacheInvalidated,
      },
    });

    return NextResponse.json(result);
  } catch (error) {
    logger.error('[License Sync] Sync failed', error as Error, { requestId });

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Sync failed',
        syncSource: 'none',
        kvCacheInvalidated: false,
      },
      { status: 500 }
    );
  }
}

/**
 * Sync license from RaaS Gateway
 */
async function syncFromGateway(
  licenseNonce: string,
  requestId: string
): Promise<SyncResult> {
  try {
    // Initialize RaaS Gateway client
    const client = new RaasGatewayClient(RAAS_CONFIG);

    // Authenticate with gateway
    await client.authenticate();

    // Fetch license utilization (contains license state)
    const licenses = await client.getLicenseUtilization();

    // Find matching license
    const license = licenses.find((l) => l.licenseNonce === licenseNonce);

    if (!license) {
      throw new Error(`License ${licenseNonce.slice(0, 8)}... not found in RaaS Gateway`);
    }

    // Update local database
    const dbResult = await updateLicenseInDatabase(licenseNonce, license);

    // Invalidate KV cache
    const kvInvalidated = await invalidateKvCache(licenseNonce);

    logger.info('[License Sync] Gateway sync successful', {
      requestId,
      licenseNonce: licenseNonce.slice(0, 8) + '...',
      tier: license.tier,
      kvInvalidated,
    });

    return {
      success: true,
      license: {
        nonce: license.licenseNonce,
        tier: license.tier,
        status: dbResult.status,
        expiresAt: license.expiresAt,
        polarCustomerId: dbResult.polarCustomerId,
        polarSubscriptionStatus: dbResult.polarSubscriptionStatus,
        featureEntitlements: dbResult.featureEntitlements,
        dunningState: dbResult.dunningState,
      },
      syncSource: 'gateway',
      kvCacheInvalidated: kvInvalidated,
    };
  } catch (error) {
    logger.error('[License Sync] Gateway sync failed', error as Error, { requestId });

    // Fallback to database
    logger.info('[License Sync] Falling back to database sync');
    const result = await syncFromDatabase(licenseNonce);
    return {
      ...result,
      syncSource: 'gateway-fallback-db',
    };
  }
}

/**
 * Sync from local database (fallback)
 */
async function syncFromDatabase(licenseNonce: string): Promise<SyncResult> {
  const supabase = createAdminClient();

  try {
    // Fetch license from raas_api_keys table
    const { data: license, error } = await supabase
      .from('raas_api_keys')
      .select(`
        nonce,
        tier,
        status,
        expires_at,
        polar_customer_id,
        polar_subscription_status,
        feature_entitlements,
        dunning_state,
        agency_id,
        created_at,
        updated_at
      `)
      .eq('nonce', licenseNonce)
      .single();

    if (error || !license) {
      throw new Error(`License ${licenseNonce.slice(0, 8)}... not found in database`);
    }

    // Format response
    const formattedLicense = {
      nonce: license.nonce,
      tier: license.tier,
      status: license.status || 'active',
      expiresAt: license.expires_at ? new Date(license.expires_at).getTime() : null,
      polarCustomerId: license.polar_customer_id,
      polarSubscriptionStatus: license.polar_subscription_status,
      featureEntitlements: license.feature_entitlements || [],
      dunningState: license.dunning_state || 'ok',
    };

    logger.info('[License Sync] Database sync successful', {
      licenseNonce: licenseNonce.slice(0, 8) + '...',
      tier: license.tier,
    });

    return {
      success: true,
      license: formattedLicense,
      syncSource: 'database',
      kvCacheInvalidated: false,
    };
  } catch (error) {
    logger.error('[License Sync] Database sync failed', error as Error);
    throw error;
  }
}

/**
 * Update license data in database
 */
async function updateLicenseInDatabase(
  licenseNonce: string,
  gatewayLicense: {
    licenseNonce: string;
    tier: string;
    expiresAt: number | null;
  }
): Promise<{
  status: string;
  polarCustomerId?: string | null;
  polarSubscriptionStatus?: string;
  featureEntitlements: string[];
  dunningState: string;
}> {
  const supabase = createAdminClient();

  // Determine status based on expiration
  const now = Date.now();
  let status = 'active';

  if (gatewayLicense.expiresAt) {
    if (gatewayLicense.expiresAt < now) {
      status = 'expired';
    } else if (gatewayLicense.expiresAt < now + 7 * 24 * 60 * 60 * 1000) {
      status = 'expiring_soon'; // Expires within 7 days
    }
  }

  // Upsert license data
  const { data: updated, error } = await supabase
    .from('raas_api_keys')
    .upsert(
      {
        nonce: licenseNonce,
        tier: gatewayLicense.tier,
        status,
        expires_at: gatewayLicense.expiresAt ? new Date(gatewayLicense.expiresAt).toISOString() : null,
        updated_at: new Date().toISOString(),
      },
      {
        onConflict: 'nonce',
      }
    )
    .select('polar_customer_id, polar_subscription_status, feature_entitlements, dunning_state')
    .single();

  if (error) {
    logger.error('[License Sync] Database update failed', error);
    throw new Error(`Failed to update license in database: ${error.message}`);
  }

  return {
    status,
    polarCustomerId: updated?.polar_customer_id,
    polarSubscriptionStatus: updated?.polar_subscription_status,
    featureEntitlements: updated?.feature_entitlements || [],
    dunningState: updated?.dunning_state || 'ok',
  };
}

/**
 * Invalidate Cloudflare KV cache
 *
 * Called after license sync to ensure edge workers
 * use fresh license data on next request
 */
async function invalidateKvCache(licenseNonce: string): Promise<boolean> {
  try {
    const kv = getKvClient();

    if (!kv) {
      logger.debug('[License Sync] KV client not available, skipping cache invalidation');
      return false;
    }

    // Invalidate license cache key (matches kv-license-cache.ts pattern)
    const cacheKey = `license:${licenseNonce}`;
    await kv.set(cacheKey, null); // Delete key

    logger.debug('[License Sync] KV cache invalidated', {
      licenseNonce: licenseNonce.slice(0, 8) + '...',
    });

    return true;
  } catch (error) {
    logger.error('[License Sync] KV cache invalidation failed', error as Error);
    return false;
  }
}
