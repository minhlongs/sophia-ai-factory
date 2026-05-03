/**
 * Trending Offer Discovery
 *
 * Aggregates trending offers across all or specified networks.
 * Used by GET /api/offers/trending.
 * Results capped at 50 per network to stay within edge memory limits.
 *
 * @module affiliates/trending-discovery
 */

import { TikTokShopProvider } from './providers/tiktok-shop'
import { AccessTradeProvider } from './providers/accesstrade'
import { ClickBankProvider } from './providers/clickbank'
import { AwinProvider } from './providers/awin'
import { AmazonProvider } from './providers/amazon'
import type { AffiliateOffer, OfferProvider } from './provider-interface'

const ALL_PROVIDERS: Record<string, OfferProvider> = {
  'tiktok-shop': new TikTokShopProvider(),
  accesstrade: new AccessTradeProvider(),
  clickbank: new ClickBankProvider(),
  awin: new AwinProvider(),
  amazon: new AmazonProvider(),
}

export interface TrendingQuery {
  network?: string
  niche?: string
  limit?: number
}

/**
 * Fetch trending offers across networks.
 * If network is specified, only that network is queried.
 * Results are merged and capped at limit (default 50).
 */
export async function getTrendingOffers(query: TrendingQuery): Promise<AffiliateOffer[]> {
  const { network, niche = 'general', limit = 50 } = query

  const providers = network
    ? ALL_PROVIDERS[network] ? [ALL_PROVIDERS[network]] : []
    : Object.values(ALL_PROVIDERS)

  if (providers.length === 0) return []

  const settled = await Promise.allSettled(
    providers.map(p => p.getTrending(niche))
  )

  const offers: AffiliateOffer[] = []
  for (const result of settled) {
    if (result.status === 'fulfilled') {
      offers.push(...result.value)
    }
  }

  return offers.slice(0, limit)
}
