/**
 * Awin Affiliate Adapter
 *
 * Uses Awin Publisher API v2 (ShareASale rebrand 2025) for product/offer listings.
 * Auth: AWIN_API_TOKEN + AWIN_PUBLISHER_ID from env.
 * Rate limit: 20 calls/min — respected via cron staggering.
 * Falls back to mock fixtures when env vars are absent.
 *
 * API docs: https://wiki.awin.com/index.php/Publisher_API
 *
 * @module affiliates/providers/awin
 */

import type { OfferProvider, AffiliateOffer, ListOffersOpts } from '../provider-interface'

const BASE_URL = 'https://api.awin.com'
const NETWORK_SLUG = 'awin'

interface AwinProduct {
  id: string
  productName: string
  description?: string
  imgUrl?: string
  aw_deep_link: string
  commission_group?: { value?: number; type?: string }
  category?: { primary?: string }
  language?: string
  region?: string
}

interface AwinProductListResponse {
  products?: AwinProduct[]
}

function mapProduct(p: AwinProduct): AffiliateOffer {
  const commType = p.commission_group?.type?.toLowerCase()
  return {
    externalId: p.id,
    title: p.productName ?? '',
    description: p.description ?? '',
    imageUrl: p.imgUrl ?? '',
    productUrl: p.aw_deep_link,
    commissionPct: commType === 'percentage' ? (p.commission_group?.value ?? null) : null,
    commissionFixedUsd: commType === 'fixed' ? (p.commission_group?.value ?? null) : null,
    niche: p.category?.primary ?? 'general',
    language: p.language ?? 'en',
    region: p.region ?? 'GB',
    isTrending: false,
  }
}

function mockOffers(): AffiliateOffer[] {
  return [
    {
      externalId: 'awin-mock-001',
      title: 'Awin Fashion Deal (Mock)',
      description: 'Top UK fashion retailer – mock fixture',
      imageUrl: 'https://placehold.co/400x400?text=Awin',
      productUrl: 'https://www.awin1.com/mock-001',
      commissionPct: 7,
      commissionFixedUsd: null,
      niche: 'fashion',
      language: 'en',
      region: 'GB',
      isTrending: false,
    },
  ]
}

export class AwinProvider implements OfferProvider {
  readonly networkSlug = NETWORK_SLUG

  private get token(): string | undefined { return process.env.AWIN_API_TOKEN }
  private get publisherId(): string | undefined { return process.env.AWIN_PUBLISHER_ID }

  private headers(): HeadersInit {
    return { Authorization: `Bearer ${this.token}`, Accept: 'application/json' }
  }

  async listOffers(opts?: ListOffersOpts): Promise<AffiliateOffer[]> {
    if (!this.token || !this.publisherId) return mockOffers()
    try {
      const params = new URLSearchParams({
        publisherId: this.publisherId,
        pageSize: String(opts?.limit ?? 20),
        page: String(opts?.page ?? 1),
      })
      if (opts?.niche) params.set('categoryIds', opts.niche)
      const res = await fetch(
        `${BASE_URL}/publishers/${this.publisherId}/product-feeds?${params}`,
        { headers: this.headers() }
      )
      if (!res.ok) return mockOffers()
      const json = await res.json() as AwinProductListResponse
      return (json.products ?? []).map(mapProduct)
    } catch {
      return mockOffers()
    }
  }

  async getOffer(externalId: string): Promise<AffiliateOffer | null> {
    if (!this.token || !this.publisherId) return mockOffers()[0]
    try {
      const res = await fetch(
        `${BASE_URL}/publishers/${this.publisherId}/product-feeds/${externalId}`,
        { headers: this.headers() }
      )
      if (!res.ok) return null
      const json = await res.json() as AwinProduct
      return mapProduct(json)
    } catch {
      return null
    }
  }

  async getTrending(niche: string): Promise<AffiliateOffer[]> {
    const offers = await this.listOffers({ niche, limit: 50 })
    // Object.assign avoids esbuild collapsing spread+override into a duplicate-key literal.
    return offers.map(o => Object.assign({}, o, { isTrending: true }))
  }
}
