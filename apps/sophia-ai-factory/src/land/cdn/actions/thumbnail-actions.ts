'use server';

import { getD1 } from '@/seed/db/client';
import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { success, failure, type Result } from '@/seed/types/result';
import { logger } from '@/seed/utils/logger-utility';
import type { GenerateVariantsInput, AssetThumbnailVariant } from '@/tree/cdn/types';
import {
  generateThumbnailVariantSpecs,
  saveThumbnailVariants,
} from '@/tree/cdn/thumbnail-generator';
import { registerCacheTag } from '@/tree/cdn/cache-mesh-service';
import type { ActionError } from './types';

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
