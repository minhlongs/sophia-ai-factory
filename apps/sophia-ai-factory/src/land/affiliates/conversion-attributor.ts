/**
 * Conversion Attributor
 *
 * Resolves conversion signals back to campaign/user/offer context.
 *
 * Supports two attribution paths:
 * 1. ClickBank (legacy): cvendthru tid → affiliate_clicks table
 * 2. Multi-network (Phase 09): sub_id pattern `{tenantSlug}-{linkIdHex}` → affiliate_links table
 *
 * Match strategies use parameterized SQLite bindings (safe from injection).
 *
 * @module land/affiliates/conversion-attributor
 */

import { logger } from '@/seed/utils/logger-utility';
import { getD1 } from '@/seed/db/client';
import type {
  AttributionResult,
  NetworkAttributionResult,
  ClickRow,
  AttributionLookupResult,
} from './conversion-attributor-types';
import {
  attributeByNetwork,
  safeAttributeByNetwork,
} from './conversion-attributor-network';

export type {
  AttributionResult,
  NetworkAttributionResult,
  AttributionLookupResult,
};

export {
  attributeByNetwork,
  safeAttributeByNetwork,
};

/**
 * Look up the click that generated this conversion via ClickBank cvendthru field.
 * Backward-compatible — returns null for both "not found" and DB errors.
 */
export async function attributeClick(tid: string): Promise<AttributionResult | null> {
  const result = await safeAttributeClick(tid);
  return result.data;
}

/**
 * Safe variant of attributeClick — distinguishes "not found" from DB errors.
 */
export async function safeAttributeClick(tid: string): Promise<AttributionLookupResult> {
  if (!tid || tid.length !== 24 || !/^[0-9a-f]+$/i.test(tid)) {
    logger.warn('[conversion-attributor] invalid tid format', { tidLen: tid?.length });
    return { data: null, error: null };
  }

  const db = await getD1();
  if (!db) {
    logger.warn('[conversion-attributor] D1 binding not available');
    return { data: null, error: null };
  }

  try {
    const row = await db
      .prepare(
        `SELECT click_id, campaign_id, user_id, offer_id
         FROM affiliate_clicks
         WHERE substr(replace(click_id,'-',''),1,24) = ?
         LIMIT 1`,
      )
      .bind(tid)
      .first<ClickRow>();

    if (!row) {
      logger.info('[conversion-attributor] no click found', { tidPrefix: tid.slice(0, 8) });
      return { data: null, error: null };
    }

    return {
      data: {
        clickId: row.click_id,
        campaignId: row.campaign_id,
        userId: row.user_id,
        offerId: row.offer_id,
      },
      error: null,
    };
  } catch (err) {
    const error = err instanceof Error ? err : new Error(String(err));
    logger.warn('[conversion-attributor] lookup error', { error: error.message });
    return { data: null, error };
  }
}
