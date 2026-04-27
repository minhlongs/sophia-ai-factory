/**
 * Conversion Attributor
 *
 * Resolves a ClickBank `cvendthru` (= truncated click_id tid) back to
 * campaign + user + offer context stored in affiliate_clicks.
 *
 * M3 short-link redirect appends `tid = clickId.replace(/-/g,'').slice(0,24)`
 * so affiliate_clicks stores the FULL UUID click_id but ClickBank returns
 * only the first 24 hex chars (no dashes).
 *
 * Match strategy (SQLite): WHERE substr(replace(click_id,'-',''),1,24) = ?
 * This avoids schema changes and uses parameterized bindings (safe from injection).
 *
 * @module affiliates/conversion-attributor
 */

import { logger } from '@/lib/utils/logger-utility'

export interface AttributionResult {
  clickId: string
  campaignId: string
  userId: string
  offerId: string
}

interface ClickRow {
  click_id: string
  campaign_id: string
  user_id: string
  offer_id: string
}

/** Get raw D1Database binding from CF worker environment. */
function getD1Binding(): D1Database | null {
  const env = (globalThis as unknown as { __env?: Record<string, unknown> }).__env
  if (env?.DB) return env.DB as D1Database

  const globalDb = (globalThis as Record<string, unknown>).__D1_DB as D1Database | undefined
  return globalDb ?? null
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

  const db = getD1Binding()
  if (!db) {
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
