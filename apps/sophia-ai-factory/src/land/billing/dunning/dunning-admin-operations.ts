/**
 * Dunning Admin Operations
 *
 * Admin and query operations: license suspension/restoration,
 * history retrieval, settings initialization.
 *
 * @module billing/dunning/dunning-admin-operations
 */

import { logger } from '@/seed/utils/logger-utility';
import { toError } from '@/seed/utils/to-error';
import {
  getDunningState,
  type DunningState,
} from './dunning-state-machine';
import {
  getDunningKvClient,
  invalidateDunningCache,
  DUNNING_CACHE_TTL_SECONDS,
} from './dunning-kv-cache';
import { suspendLicense, restoreLicense } from './dunning-license-lifecycle';
import { getDunningHistory, initializeDunningSettings } from './dunning-settings-history';

export { invalidateDunningCache, suspendLicense, restoreLicense, getDunningHistory, initializeDunningSettings };

/**
 * Quick API access check without full state lookup.
 */
export async function canAccessApi(licenseNonce: string): Promise<{
  allowed: boolean;
  state: DunningState;
  reason?: string;
}> {
  const kv = getDunningKvClient();
  const cacheKey = `dunning:${licenseNonce}`;

  if (kv) {
    try {
      const cached = (await kv.get(cacheKey)) as unknown as {
        allowed: boolean;
        state: DunningState;
        reason?: string;
      } | null;
      if (cached && typeof cached === 'object' && 'allowed' in cached) {
        return cached;
      }
    } catch (err) {
      logger.error('[Dunning] KV cache read error', toError(err));
    }
  }

  const stateResult = await getDunningState(licenseNonce);
  const result = { allowed: stateResult.allowed, state: stateResult.state, reason: stateResult.blockReason };

  if (kv) {
    try {
      await kv.set(
        cacheKey as unknown as Parameters<typeof kv.set>[0],
        result as unknown as Parameters<typeof kv.set>[1],
        { expirationTtl: DUNNING_CACHE_TTL_SECONDS },
      );
    } catch (err) {
      logger.error('[Dunning] KV cache write error', toError(err));
    }
  }

  return result;
}
