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
import { ShareASaleProvider } from '@/land/affiliates/providers/shareasale'
import type { OfferProvider } from '@/land/affiliates/provider-interface'
import { logger } from '@/seed/utils/logger-utility'
import {
  getOfferSyncD1,
  upsertOffers,
  type UpsertResult,
} from './offer-sync-upsert'

/** All registered network adapters */
const PROVIDERS: OfferProvider[] = [
  new TikTokShopProvider(),
  new AccessTradeProvider(),
  new ClickBankProvider(),
  new AwinProvider(),
  new AmazonProvider(),
  new ShareASaleProvider(),
]

/** Default tenant used when syncing global (non-tenant-specific) offers */
const GLOBAL_TENANT_ID = process.env.SOPHIA_TENANT_ID ?? 'sophia-global'

export const offerSyncCron = inngest.createFunction(
  { id: 'offers-sync-hourly', name: 'Affiliate Offers Sync (Hourly)' },
  { cron: '0 * * * *' },
  async ({ step }) => {
    const results: UpsertResult[] = await step.run('sync-all-networks', async () => {
      const db = await getOfferSyncD1()
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
