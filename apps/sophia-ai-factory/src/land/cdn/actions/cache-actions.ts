'use server';

import { getD1 } from '@/seed/db/client';
import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { success, failure, type Result } from '@/seed/types/result';
import { logger } from '@/seed/utils/logger-utility';
import type { PurgeTagResult } from '@/tree/cdn/types';
import { purgeCacheTag, purgeCacheByTenant } from '@/tree/cdn/cache-mesh-service';
import type { ActionError } from './types';

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
