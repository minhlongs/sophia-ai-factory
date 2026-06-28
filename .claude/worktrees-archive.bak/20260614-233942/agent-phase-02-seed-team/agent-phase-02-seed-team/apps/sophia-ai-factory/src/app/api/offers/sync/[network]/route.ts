/**
 * Offer Sync API Route
 *
 * POST /api/offers/sync/[network] — triggers on-demand sync for a specific network.
 * Protected by CRON_SECRET header (same pattern as other cron routes).
 *
 * @module app/api/offers/sync/[network]/route
 */

import { NextRequest, NextResponse } from 'next/server'
import { TikTokShopProvider } from '@/land/affiliates/providers/tiktok-shop'
import { AccessTradeProvider } from '@/land/affiliates/providers/accesstrade'
import { ClickBankProvider } from '@/land/affiliates/providers/clickbank'
import { AwinProvider } from '@/land/affiliates/providers/awin'
import { AmazonProvider } from '@/land/affiliates/providers/amazon'
import type { OfferProvider } from '@/land/affiliates/provider-interface'
import { logger } from '@/seed/utils/logger-utility'

const PROVIDERS: Record<string, OfferProvider> = {
  'tiktok-shop': new TikTokShopProvider(),
  accesstrade: new AccessTradeProvider(),
  clickbank: new ClickBankProvider(),
  awin: new AwinProvider(),
  amazon: new AmazonProvider(),
}

const GLOBAL_TENANT_ID = process.env.SOPHIA_TENANT_ID ?? 'sophia-global'

function getD1(): D1Database | null {
  const env = (globalThis as unknown as { __env?: Record<string, unknown> }).__env
  if (env?.DB) return env.DB as D1Database
  const g = (globalThis as Record<string, unknown>).__D1_DB as D1Database | undefined
  return g ?? null
}

export async function POST(
  request: NextRequest,
  { params }: { params: { network: string } }
): Promise<NextResponse> {
  const cronSecret = request.headers.get('x-cron-secret')
  if (cronSecret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const { network } = params
  const provider = PROVIDERS[network]
  if (!provider) {
    return NextResponse.json({ error: `unknown network: ${network}` }, { status: 404 })
  }

  try {
    const offers = await provider.listOffers({ limit: 50 })
    const db = getD1()
    const now = Math.floor(Date.now() / 1000)
    let synced = 0

    if (db) {
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
               is_trending=excluded.is_trending,
               last_synced_at=excluded.last_synced_at,
               updated_at=excluded.updated_at`
          ).bind(
            crypto.randomUUID(), GLOBAL_TENANT_ID, network, offer.externalId,
            offer.title, offer.description, offer.imageUrl, offer.productUrl,
            offer.commissionPct, offer.commissionFixedUsd,
            offer.niche, offer.language, offer.region,
            offer.isTrending ? 1 : 0, now, now, now
          ).run()
          synced++
        } catch (e) {
          logger.warn('[sync-route] upsert error', { network, error: e instanceof Error ? e.message : String(e) })
        }
      }
    } else {
      synced = offers.length
    }

    return NextResponse.json({ network, synced })
  } catch (err) {
    logger.warn('[sync-route] sync failed', { network, error: err instanceof Error ? err.message : String(err) })
    return NextResponse.json({ error: 'sync failed' }, { status: 500 })
  }
}
