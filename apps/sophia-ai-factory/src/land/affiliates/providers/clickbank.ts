/**
 * ClickBank Affiliate Adapter
 *
 * Uses ClickBank REST API v1 (JSR-311) to list and fetch digital products.
 * Auth: CLICKBANK_API_KEY from env.
 * Reuses existing clickbank-signature-verifier for any HMAC operations.
 * Falls back to mock fixtures when env var is absent.
 *
 * API docs: https://api.clickbank.com/rest/1.3
 * Rate limit: 25K req/day, 10 req/sec — we respect via staggered cron.
 *
 * @module affiliates/providers/clickbank
 */

import type { OfferProvider, AffiliateOffer, ListOffersOpts } from '../provider-interface'

const BASE_URL = 'https://api.clickbank.com/rest/1.3'
const NETWORK_SLUG = 'clickbank'

interface ClickBankProduct {
  site: string
  title: string
  description?: string
  imageUrl?: string
  hoplink: string
  commission?: number
  category?: string
  language?: string
}

interface ClickBankListResponse {
  products?: ClickBankProduct[]
}

function mapProduct(p: ClickBankProduct): AffiliateOffer {
  return {
    externalId: p.site,
    title: p.title ?? '',
    description: p.description ?? '',
    imageUrl: p.imageUrl ?? '',
    productUrl: p.hoplink,
    commissionPct: p.commission ?? null,
    commissionFixedUsd: null,
    niche: p.category ?? 'digital',
    language: p.language ?? 'en',
    region: 'US',
    isTrending: false,
  }
}

function mockOffers(): AffiliateOffer[] {
  return [
    {
      externalId: 'cb-mock-001',
      title: 'ClickBank SaaS Tool (Mock)',
      description: 'AI productivity tool with 40% commission – mock fixture',
      imageUrl: 'https://placehold.co/400x400?text=ClickBank',
      productUrl: 'https://cb-mock-001.hop.clickbank.net',
      commissionPct: 40,
      commissionFixedUsd: null,
      niche: 'saas',
      language: 'en',
      region: 'US',
      isTrending: false,
    },
    {
      externalId: 'cb-mock-002',
      title: 'ClickBank Marketing Course (Mock)',
      description: 'Email marketing masterclass – mock fixture',
      imageUrl: 'https://placehold.co/400x400?text=ClickBank+2',
      productUrl: 'https://cb-mock-002.hop.clickbank.net',
      commissionPct: 35,
      commissionFixedUsd: null,
      niche: 'marketing',
      language: 'en',
      region: 'US',
      isTrending: false,
    },
  ]
}

export class ClickBankProvider implements OfferProvider {
  readonly networkSlug = NETWORK_SLUG

  private get apiKey(): string | undefined { return process.env.CLICKBANK_API_KEY }

  private headers(): HeadersInit {
    return {
      Authorization: this.apiKey ?? '',
      Accept: 'application/json',
    }
  }

  async listOffers(opts?: ListOffersOpts): Promise<AffiliateOffer[]> {
    if (!this.apiKey) return mockOffers()
    try {
      const params = new URLSearchParams({
        startRow: String(((opts?.page ?? 1) - 1) * (opts?.limit ?? 100)),
        rowCount: String(Math.min(opts?.limit ?? 100, 100)),
      })
      if (opts?.niche) params.set('keyword', opts.niche)
      const res = await fetch(`${BASE_URL}/products/list?${params}`, { headers: this.headers() })
      if (!res.ok) return mockOffers()
      const json = await res.json() as ClickBankListResponse
      return (json.products ?? []).map(mapProduct)
    } catch {
      return mockOffers()
    }
  }

  async getOffer(externalId: string): Promise<AffiliateOffer | null> {
    if (!this.apiKey) return mockOffers()[0]
    try {
      const res = await fetch(`${BASE_URL}/products/${externalId}`, { headers: this.headers() })
      if (!res.ok) return null
      const json = await res.json() as ClickBankProduct
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
