/**
 * AccessTrade Vietnam Affiliate Adapter
 *
 * Connects to AccessTrade VN REST API for campaign/product listings.
 * Auth: Bearer ACCESSTRADE_API_TOKEN from env.
 * Falls back to mock fixtures when env var is absent.
 *
 * API base: https://pub2.accesstrade.vn/api
 *
 * @module affiliates/providers/accesstrade
 */

import type { OfferProvider, AffiliateOffer, ListOffersOpts } from '../provider-interface'
import { asTrending } from '../provider-interface'
import {
  mapProduct,
  mapCampaign,
  mockOffers,
  type AccessTradeProduct,
  type AccessTradeCampaign,
} from './accesstrade-mappers'

const BASE_URL = 'https://pub2.accesstrade.vn/api'
const NETWORK_SLUG = 'accesstrade'

export class AccessTradeProvider implements OfferProvider {
  readonly networkSlug = NETWORK_SLUG

  private get token(): string | undefined { return process.env.ACCESSTRADE_API_TOKEN }

  private headers(): HeadersInit {
    return { Authorization: `Bearer ${this.token}`, 'Content-Type': 'application/json' }
  }

  async listOffers(opts?: ListOffersOpts): Promise<AffiliateOffer[]> {
    if (!this.token) return mockOffers()
    try {
      const params = new URLSearchParams({
        limit: String(opts?.limit ?? 20),
        offset: String(((opts?.page ?? 1) - 1) * (opts?.limit ?? 20)),
      })
      if (opts?.niche) params.set('category', opts.niche)
      const res = await fetch(`${BASE_URL}/products?${params}`, { headers: this.headers() })
      if (!res.ok) return mockOffers()
      const json = await res.json() as { data?: AccessTradeProduct[] }
      return (json.data ?? []).map(mapProduct)
    } catch {
      return mockOffers()
    }
  }

  async getOffer(externalId: string): Promise<AffiliateOffer | null> {
    if (!this.token) return mockOffers()[0]
    try {
      const res = await fetch(`${BASE_URL}/products/${externalId}`, { headers: this.headers() })
      if (!res.ok) return null
      const json = await res.json() as { data?: AccessTradeProduct }
      return json.data ? mapProduct(json.data) : null
    } catch {
      return null
    }
  }

  async getTrending(niche: string): Promise<AffiliateOffer[]> {
    if (!this.token) return mockOffers().map(asTrending)
    try {
      const params = new URLSearchParams({ category: niche, sort: 'trending', limit: '50' })
      const [productsRes, campaignsRes] = await Promise.allSettled([
        fetch(`${BASE_URL}/products?${params}`, { headers: this.headers() }),
        fetch(`${BASE_URL}/campaigns?${params}`, { headers: this.headers() }),
      ])
      const offers: AffiliateOffer[] = []
      if (productsRes.status === 'fulfilled' && productsRes.value.ok) {
        const json = await productsRes.value.json() as { data?: AccessTradeProduct[] }
        offers.push(...(json.data ?? []).map(p => asTrending(mapProduct(p))))
      }
      if (campaignsRes.status === 'fulfilled' && campaignsRes.value.ok) {
        const json = await campaignsRes.value.json() as { data?: AccessTradeCampaign[] }
        offers.push(...(json.data ?? []).map(c => asTrending(mapCampaign(c))))
      }
      return offers.length ? offers : mockOffers().map(asTrending)
    } catch {
      return mockOffers().map(asTrending)
    }
  }
}
