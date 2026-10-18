/**
 * TikTok Shop Affiliate Adapter
 *
 * Uses TikTok Shop Partner API v2 to list, fetch, and discover trending products.
 * Auth: TIKTOK_SHOP_APP_KEY + TIKTOK_SHOP_APP_SECRET (HMAC-SHA256 signed requests).
 * Falls back to mock fixtures when env vars are absent.
 *
 * Docs: https://partner.tiktokshop.com/docv2/page/product-search
 *
 * @module affiliates/providers/tiktok-shop
 */

import type { OfferProvider, AffiliateOffer, ListOffersOpts } from '../provider-interface'
import { asTrending } from '../provider-interface'
import {
  signRequest,
  mapProduct,
  mockOffers,
  type TikTokProduct,
} from './tiktok-shop-helpers'

const BASE_URL = 'https://open-api.tiktokglobalshop.com'
const NETWORK_SLUG = 'tiktok-shop'

export class TikTokShopProvider implements OfferProvider {
  readonly networkSlug = NETWORK_SLUG

  private get appKey(): string | undefined { return process.env.TIKTOK_SHOP_APP_KEY }
  private get appSecret(): string | undefined { return process.env.TIKTOK_SHOP_APP_SECRET }

  async listOffers(opts?: ListOffersOpts): Promise<AffiliateOffer[]> {
    if (!this.appKey || !this.appSecret) return mockOffers()

    const path = '/product/202309/products/search'
    const params: Record<string, string> = {
      app_key: this.appKey,
      timestamp: String(Math.floor(Date.now() / 1000)),
      page_size: String(opts?.limit ?? 20),
      page_number: String(opts?.page ?? 1),
    }
    if (opts?.niche) params['keyword'] = opts.niche

    try {
      params['sign'] = await signRequest(path, params, this.appSecret)
      const url = `${BASE_URL}${path}?${new URLSearchParams(params)}`
      const res = await fetch(url, { headers: { 'Content-Type': 'application/json' } })
      if (!res.ok) return mockOffers()
      const json = await res.json() as { data?: { products?: TikTokProduct[] } }
      return (json.data?.products ?? []).map(mapProduct)
    } catch {
      return mockOffers()
    }
  }

  async getOffer(externalId: string): Promise<AffiliateOffer | null> {
    if (!this.appKey || !this.appSecret) return mockOffers()[0]

    const path = `/product/202309/products/${externalId}`
    const params: Record<string, string> = {
      app_key: this.appKey,
      timestamp: String(Math.floor(Date.now() / 1000)),
    }
    try {
      params['sign'] = await signRequest(path, params, this.appSecret)
      const url = `${BASE_URL}${path}?${new URLSearchParams(params)}`
      const res = await fetch(url)
      if (!res.ok) return null
      const json = await res.json() as { data?: TikTokProduct }
      return json.data ? mapProduct(json.data) : null
    } catch {
      return null
    }
  }

  async getTrending(niche: string): Promise<AffiliateOffer[]> {
    if (!this.appKey || !this.appSecret) return mockOffers(true)
    const offers = await this.listOffers({ niche, limit: 50 })
    return offers.map(asTrending)
  }
}
