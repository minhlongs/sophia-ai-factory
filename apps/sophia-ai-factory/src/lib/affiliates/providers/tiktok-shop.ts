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

const BASE_URL = 'https://open-api.tiktokglobalshop.com'
const NETWORK_SLUG = 'tiktok-shop'

/** TikTok Shop API product shape (subset we use) */
interface TikTokProduct {
  id: string
  title: string
  description?: string
  main_images?: { urls?: string[] }[]
  seller_skus?: { price?: { original_price?: string }; affiliate_commission_rate?: string }[]
}

/** Sign TikTok Shop API request with HMAC-SHA256 */
async function signRequest(
  path: string,
  params: Record<string, string>,
  appSecret: string
): Promise<string> {
  const sorted = Object.keys(params).sort().map(k => `${k}${params[k]}`).join('')
  const message = `${path}${sorted}${path}`
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(appSecret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )
  const buf = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(message))
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('')
}

function mapProduct(p: TikTokProduct): AffiliateOffer {
  const sku = p.seller_skus?.[0]
  const commissionRate = sku?.affiliate_commission_rate ? parseFloat(sku.affiliate_commission_rate) : null
  return {
    externalId: p.id,
    title: p.title ?? '',
    description: p.description ?? '',
    imageUrl: p.main_images?.[0]?.urls?.[0] ?? '',
    productUrl: `https://www.tiktok.com/shop/product/${p.id}`,
    commissionPct: commissionRate,
    commissionFixedUsd: null,
    niche: 'general',
    language: 'vi',
    region: 'VN',
    isTrending: false,
  }
}

function mockOffers(trending = false): AffiliateOffer[] {
  return [
    {
      externalId: 'ttshop-mock-001',
      title: 'TikTok Shop Beauty Serum (Mock)',
      description: 'Premium vitamin C serum – mock fixture',
      imageUrl: 'https://placehold.co/400x400?text=TikTok+Shop',
      productUrl: 'https://www.tiktok.com/shop/product/ttshop-mock-001',
      commissionPct: 12,
      commissionFixedUsd: null,
      niche: 'beauty',
      language: 'vi',
      region: 'VN',
      isTrending: trending,
    },
  ]
}

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
    return offers.map(o => ({ ...o, isTrending: true }))
  }
}
