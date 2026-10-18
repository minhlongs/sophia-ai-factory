/**
 * D1 Upsert helper for Affiliate Offer Sync Cron.
 * @module forest/jobs/offer-sync-upsert
 */

import { logger } from '@/seed/utils/logger-utility'

export interface SyncableOfferRow {
  externalId: string
  title: string
  description: string | null
  imageUrl: string | null
  productUrl: string
  commissionPct: number | null
  commissionFixedUsd: number | null
  niche: string
  language: string
  region: string
  isTrending: boolean
}

export interface UpsertResult {
  network: string
  synced: number
  error?: string
}

/** D1 binding accessor */
export function getOfferSyncD1(): D1Database | null {
  const env = (globalThis as unknown as { __env?: Record<string, unknown> }).__env
  if (env?.DB) return env.DB as D1Database
  const g = (globalThis as Record<string, unknown>).__D1_DB as D1Database | undefined
  return g ?? null
}

export async function upsertOffers(
  db: D1Database,
  networkSlug: string,
  offers: SyncableOfferRow[],
  tenantId: string
): Promise<number> {
  const now = Math.floor(Date.now() / 1000)
  let count = 0
  for (const offer of offers) {
    try {
      await db.prepare(
        `INSERT INTO affiliate_offers
          (id, tenant_id, network_id, external_id, title, description, image_url,
           product_url, commission_pct, commission_fixed_usd, niche, language, region,
           is_trending, last_synced_at, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(network_id, external_id, tenant_id) DO UPDATE SET
           title=excluded.title, description=excluded.description,
           image_url=excluded.image_url, product_url=excluded.product_url,
           commission_pct=excluded.commission_pct,
           commission_fixed_usd=excluded.commission_fixed_usd,
           niche=excluded.niche, language=excluded.language, region=excluded.region,
           is_trending=excluded.is_trending, last_synced_at=excluded.last_synced_at,
           updated_at=excluded.updated_at`
      ).bind(
        crypto.randomUUID(),
        tenantId,
        networkSlug,
        offer.externalId,
        offer.title,
        offer.description,
        offer.imageUrl,
        offer.productUrl,
        offer.commissionPct,
        offer.commissionFixedUsd,
        offer.niche,
        offer.language,
        offer.region,
        offer.isTrending ? 1 : 0,
        now,
        now,
        now
      ).run()
      count++
    } catch (err) {
      logger.warn('[offer-sync] upsert failed', {
        network: networkSlug,
        externalId: offer.externalId,
        error: err instanceof Error ? err.message : String(err),
      })
    }
  }
  return count
}
