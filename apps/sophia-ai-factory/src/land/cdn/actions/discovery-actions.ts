'use server';

import { getD1 } from '@/seed/db/client';
import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { success, failure, type Result } from '@/seed/types/result';
import { logger } from '@/seed/utils/logger-utility';
import type {
  AssetThumbnailVariant,
  AssetDeliveryMetrics,
  EdgeDiscoverQuery,
  EdgeDiscoverResult,
} from '@/tree/cdn/types';
import { getThumbnailVariantsByAsset } from '@/tree/cdn/thumbnail-generator';
import {
  discoverEdgeEndpoint,
  getAssetDeliveryMetrics,
} from '@/tree/cdn/cache-mesh-service';
import type { ActionError } from './types';

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
