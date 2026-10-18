/**
 * Multi-network attribution lookup via sub_id.
 * @module land/affiliates/conversion-attributor-network
 */

import { logger } from '@/seed/utils/logger-utility';
import { getD1 } from '@/seed/db/client';
import type {
  NetworkAttributionResult,
  LinkRow,
} from './conversion-attributor-types';

/**
 * Multi-network attribution via sub_id.
 * Backward-compatible — returns null for both "not found" and DB errors.
 */
export async function attributeByNetwork(
  network: string,
  subId: string,
): Promise<NetworkAttributionResult | null> {
  const result = await safeAttributeByNetwork(network, subId);
  return result.data;
}

/**
 * Safe variant of attributeByNetwork — distinguishes "not found" from DB errors.
 */
export async function safeAttributeByNetwork(
  network: string,
  subId: string,
): Promise<{ data: NetworkAttributionResult | null; error: Error | null }> {
  if (!subId) {
    logger.warn('[conversion-attributor] empty subId', { network });
    return { data: null, error: null };
  }

  const db = await getD1();
  if (!db) {
    logger.warn('[conversion-attributor] D1 binding not available', { network });
    return { data: null, error: null };
  }

  try {
    const row = await db
      .prepare(
        `SELECT id, tenant_id, offer_id, user_id
         FROM affiliate_links
         WHERE sub_id = ?
         LIMIT 1`,
      )
      .bind(subId)
      .first<LinkRow>();

    if (!row) {
      logger.info('[conversion-attributor] no link found', { network, subIdPrefix: subId.slice(0, 12) });
      return { data: null, error: null };
    }

    return {
      data: {
        linkId: row.id,
        tenantId: row.tenant_id,
        offerId: row.offer_id,
        userId: row.user_id,
      },
      error: null,
    };
  } catch (err) {
    const error = err instanceof Error ? err : new Error(String(err));
    logger.warn('[conversion-attributor] network lookup error', { network, error: error.message });
    return { data: null, error };
  }
}
