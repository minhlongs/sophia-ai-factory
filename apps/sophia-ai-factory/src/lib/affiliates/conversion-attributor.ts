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
 * @module affiliates/conversion-attributor
 */

import { logger } from '@/lib/utils/logger-utility'
import { getD1Raw } from '@/lib/db/client'

export interface AttributionResult {
  clickId: string
  campaignId: string
  userId: string
  offerId: string
}

/** Phase 09 extended result includes tenant context */
export interface NetworkAttributionResult {
  linkId: string
  tenantId: string
  offerId: string
  userId: string
}

interface ClickRow {
  click_id: string
  campaign_id: string
  user_id: string
  offer_id: string
}

interface LinkRow {
  id: string
  tenant_id: string
  offer_id: string
  user_id: string
}


/**
 * Look up the click that generated this conversion via ClickBank cvendthru field.
 *
 * @param tid - The `cvendthru` value from ClickBank INS (24-char hex, no dashes)
 * @returns Attribution data or null if not found / invalid
 */
export async function attributeClick(tid: string): Promise<AttributionResult | null> {
  if (!tid || tid.length !== 24 || !/^[0-9a-f]+$/i.test(tid)) {
    logger.warn('[conversion-attributor] invalid tid format', { tidLen: tid?.length })
    return null
  }

  let db: D1Database
  try {
    db = await getD1Raw()
  } catch {
    logger.warn('[conversion-attributor] D1 binding not available')
    return null
  }

  try {
    const row = await db
      .prepare(
        `SELECT click_id, campaign_id, user_id, offer_id
         FROM affiliate_clicks
         WHERE substr(replace(click_id,'-',''),1,24) = ?
         LIMIT 1`
      )
      .bind(tid)
      .first<ClickRow>()

    if (!row) {
      logger.info('[conversion-attributor] no click found', { tidPrefix: tid.slice(0, 8) })
      return null
    }

    return {
      clickId: row.click_id,
      campaignId: row.campaign_id,
      userId: row.user_id,
      offerId: row.offer_id,
    }
  } catch (err) {
    logger.warn('[conversion-attributor] lookup error', {
      error: err instanceof Error ? err.message : String(err),
    })
    return null
  }
}

/**
 * Multi-network attribution via sub_id.
 *
 * Dispatches based on network slug to look up the correct affiliate_links row.
 * sub_id format: `{tenantSlug}-{linkIdHex}` (set at redirect time in Phase 09 cloak).
 *
 * @param network - Network slug (e.g. "tiktok-shop", "accesstrade", "awin", "amazon")
 * @param subId - The sub_id / click_ref / tag value echoed back in postback
 * @returns Attribution data or null
 */
export async function attributeByNetwork(
  network: string,
  subId: string
): Promise<NetworkAttributionResult | null> {
  if (!subId) {
    logger.warn('[conversion-attributor] empty subId', { network })
    return null
  }

  let db: D1Database
  try {
    db = await getD1Raw()
  } catch {
    logger.warn('[conversion-attributor] D1 binding not available', { network })
    return null
  }

  try {
    // All networks use the affiliate_links.sub_id column for lookup
    const row = await db
      .prepare(
        `SELECT id, tenant_id, offer_id, user_id
         FROM affiliate_links
         WHERE sub_id = ?
         LIMIT 1`
      )
      .bind(subId)
      .first<LinkRow>()

    if (!row) {
      logger.info('[conversion-attributor] no link found', { network, subIdPrefix: subId.slice(0, 12) })
      return null
    }

    return {
      linkId: row.id,
      tenantId: row.tenant_id,
      offerId: row.offer_id,
      userId: row.user_id,
    }
  } catch (err) {
    logger.warn('[conversion-attributor] network lookup error', {
      network,
      error: err instanceof Error ? err.message : String(err),
    })
    return null
  }
}
