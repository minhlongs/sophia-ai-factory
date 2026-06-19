/**
 * Offer Sync Cron — Inngest Scheduled Function
 *
 * Runs hourly. Parallel-fetches offers from all 5 network adapters via
 * Promise.allSettled. Upserts into affiliate_offers table (D1 SQLite).
 * Idempotent: UNIQUE(network_id, external_id, tenant_id) prevents duplicates.
 *
 * Moved from land/affiliates/offer-sync-cron to forest/jobs (orchestration layer).
 * Forest→Land imports are allowed per cross-layer-orchestration.md.
 *
 * @module forest/jobs/offer-sync-cron
 */

import { inngest } from '@/seed/inngest/client'
import { TikTokShopProvider } from '@/land/affiliates/providers/tiktok-shop'
import { AccessTradeProvider } from '@/land/affiliates/providers/accesstrade'
import { ClickBankProvider } from '@/land/affiliates/providers/clickbank'
import { AwinProvider } from '@/land/affiliates/providers/awin'
import { AmazonProvider } from '@/land/affiliates/providers/amazon'
import type { AffiliateOffer, OfferProvider } from '@/land/affiliates/provider-interface'
import { logger } from '@/seed/utils/logger-utility'

/** D1 binding accessor */
function getD1(): D1Database | null {
  const env = (globalThis as unknown as { __env?: Record<string, unknown> }).__env
  if (env?.DB) return env.DB as D1Database
  const g = (globalThis as Record<string, unknown>).__D1_DB as D1Database | undefined
  return g ?? null
}

/** All registered network adapters */
const PROVIDERS: OfferProvider[] = [
  new TikTokShopProvider(),
  new AccessTradeProvider(),
  new ClickBankProvider(),
  new AwinProvider(),
  new AmazonProvider(),
]

/** Default tenant used when syncing global (non-tenant-specific) offers */
const GLOBAL_TENANT_ID = process.env.SOPHIA_TENANT_ID ?? 'sophia-global'

interface UpsertResult {
  network: string
  synced: number
  error?: string
}

async function upsertOffers(
  db: D1Database,
  networkSlug: string,
  offers: AffiliateOffer[],
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

export const offerSyncCron = inngest.createFunction(
  { id: 'offers-sync-hourly', name: 'Affiliate Offers Sync (Hourly)' },
  { cron: '0 * * * *' },
  async ({ step }) => {
    const results: UpsertResult[] = await step.run('sync-all-networks', async () => {
      const db = getD1()
      const settled = await Promise.allSettled(
        PROVIDERS.map(async provider => {
          try {
            const offers = await provider.listOffers({ limit: 50 })
            const count = db
              ? await upsertOffers(db, provider.networkSlug, offers, GLOBAL_TENANT_ID)
              : offers.length
            return { network: provider.networkSlug, synced: count } as UpsertResult
          } catch (err) {
            const error = err instanceof Error ? err.message : String(err)
            logger.warn('[offer-sync] provider failed', { network: provider.networkSlug, error })
            return { network: provider.networkSlug, synced: 0, error } as UpsertResult
          }
        })
      )

      return settled.map(r =>
        r.status === 'fulfilled' ? r.value : { network: 'unknown', synced: 0, error: String(r.reason) }
      )
    })

    const totalSynced = results.reduce((s, r) => s + r.synced, 0)
    logger.info('[offer-sync] hourly sync complete', { totalSynced, results })
    return { totalSynced, results }
  }
)
