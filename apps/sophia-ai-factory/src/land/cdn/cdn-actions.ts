/**
 * CDN Mesh & Edge Acceleration Server Actions
 *
 * Layer: land/cdn (Public Server Actions for UI and client mutations)
 * Dependencies: @/seed and @/tree only (strictly NO @/forest)
 */

'use server';

import { getD1 } from '@/seed/db/client';
import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { success, failure, type Result } from '@/seed/types/result';
import { logger } from '@/seed/utils/logger-utility';
import type {
  GenerateVariantsInput,
  AssetThumbnailVariant,
  PurgeTagResult,
  AssetDeliveryMetrics,
  EdgeDiscoverQuery,
  EdgeDiscoverResult,
} from '@/tree/cdn/types';
import {
  generateThumbnailVariantSpecs,
  saveThumbnailVariants,
  getThumbnailVariantsByAsset,
} from '@/tree/cdn/thumbnail-generator';
import {
  registerCacheTag,
  purgeCacheTag,
  purgeCacheByTenant,
  discoverEdgeEndpoint,
  getAssetDeliveryMetrics,
} from '@/tree/cdn/cache-mesh-service';

export interface ActionError {
  code: 'UNAUTHORIZED' | 'FORBIDDEN' | 'NOT_FOUND' | 'VALIDATION_ERROR' | 'DB_ERROR';
  message: string;
}

/**
 * Server action to generate and register thumbnail variants in D1.
 */
export async function registerThumbnailVariantsAction(
  input: GenerateVariantsInput
): Promise<Result<{ count: number; variants: AssetThumbnailVariant[] }, ActionError>> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return failure({ code: 'UNAUTHORIZED', message: 'Authentication required' });
    }

    if (!input.assetId || !input.tenantId) {
      return failure({
        code: 'VALIDATION_ERROR',
        message: 'Both assetId and tenantId are required',
      });
    }

    const db = await getD1();
    if (!db) {
      return failure({ code: 'DB_ERROR', message: 'D1 database binding not available' });
    }

    const variants = generateThumbnailVariantSpecs(input);
    const count = await saveThumbnailVariants(db, variants);

    // Register cache tag tracking
    if (variants.length > 0) {
      await registerCacheTag(db, {
        tagName: `asset_${input.assetId}`,
        resourceUrl: variants[0]?.cdnUrl ?? '',
        assetType: 'thumbnail',
        tenantId: input.tenantId,
        contentHash: `hash_${input.assetId}_${Date.now()}`,
      });
    }

    logger.info('Registered thumbnail variants for asset', {
      assetId: input.assetId,
      tenantId: input.tenantId,
      count,
    });

    return success({ count, variants });
  } catch (err) {
    logger.error('Failed to register thumbnail variants action', {
      error: String(err),
      assetId: input.assetId,
    });
    return failure({ code: 'DB_ERROR', message: String(err) });
  }
}

/**
 * Server action to invalidate a cache tag across the edge mesh.
 */
export async function invalidateCacheTagAction(
  tagName: string
): Promise<Result<PurgeTagResult, ActionError>> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return failure({ code: 'UNAUTHORIZED', message: 'Authentication required' });
    }

    if (!tagName || tagName.trim().length === 0) {
      return failure({ code: 'VALIDATION_ERROR', message: 'tagName is required' });
    }

    const db = await getD1();
    if (!db) {
      return failure({ code: 'DB_ERROR', message: 'D1 database binding not available' });
    }
    const result = await purgeCacheTag(db, tagName.trim());

    return success(result);
  } catch (err) {
    logger.error('Failed to invalidate cache tag action', {
      tagName,
      error: String(err),
    });
    return failure({ code: 'DB_ERROR', message: String(err) });
  }
}

/**
 * Server action to purge all cache tags for a tenant.
 */
export async function invalidateTenantCacheAction(
  tenantId: string
): Promise<Result<PurgeTagResult, ActionError>> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return failure({ code: 'UNAUTHORIZED', message: 'Authentication required' });
    }

    if (!tenantId || tenantId.trim().length === 0) {
      return failure({ code: 'VALIDATION_ERROR', message: 'tenantId is required' });
    }

    const db = await getD1();
    if (!db) {
      return failure({ code: 'DB_ERROR', message: 'D1 database binding not available' });
    }
    const result = await purgeCacheByTenant(db, tenantId.trim());

    return success(result);
  } catch (err) {
    logger.error('Failed to invalidate tenant cache action', {
      tenantId,
      error: String(err),
    });
    return failure({ code: 'DB_ERROR', message: String(err) });
  }
}

/**
 * Server action to fetch asset delivery metrics for a tenant.
 */
export async function getAssetDeliveryMetricsAction(
  tenantId: string
): Promise<Result<AssetDeliveryMetrics, ActionError>> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return failure({ code: 'UNAUTHORIZED', message: 'Authentication required' });
    }

    if (!tenantId || tenantId.trim().length === 0) {
      return failure({ code: 'VALIDATION_ERROR', message: 'tenantId is required' });
    }

    const db = await getD1();
    if (!db) {
      return failure({ code: 'DB_ERROR', message: 'D1 database binding not available' });
    }
    const metrics = await getAssetDeliveryMetrics(db, tenantId.trim());

    return success(metrics);
  } catch (err) {
    logger.error('Failed to fetch asset delivery metrics action', {
      tenantId,
      error: String(err),
    });
    return failure({ code: 'DB_ERROR', message: String(err) });
  }
}

/**
 * Server action to discover edge endpoint with nearest POP for an asset.
 */
export async function discoverEdgeEndpointAction(
  query: EdgeDiscoverQuery
): Promise<Result<EdgeDiscoverResult, ActionError>> {
  try {
    if (!query.assetId || query.assetId.trim().length === 0) {
      return failure({ code: 'VALIDATION_ERROR', message: 'assetId is required' });
    }

    let variants: AssetThumbnailVariant[] = [];
    try {
      const db = await getD1();
      if (db) {
        variants = await getThumbnailVariantsByAsset(db, query.assetId.trim());
      }
    } catch (err) {
      logger.warn('Failed to query D1 for variants during discover action, using synthetic discovery', {
        error: String(err),
      });
    }

    const discovery = discoverEdgeEndpoint(query, variants);
    return success(discovery);
  } catch (err) {
    logger.error('Failed to discover edge endpoint action', {
      error: String(err),
      assetId: query.assetId,
    });
    return failure({ code: 'DB_ERROR', message: String(err) });
  }
}
