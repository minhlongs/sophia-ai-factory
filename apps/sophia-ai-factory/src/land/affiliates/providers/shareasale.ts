/**
 * ShareASale Affiliate Adapter
 *
 * Uses ShareASale XML/REST API v2.8 for merchant listings.
 * Auth: HMAC-SHA256 signature generated from SHAREASALE_TOKEN + timestamp.
 * Falls back to mock fixtures when credentials are absent.
 *
 * @module affiliates/providers/shareasale
 */

import type { OfferProvider, AffiliateOffer, ListOffersOpts } from '../provider-interface'
import { asTrending } from '../provider-interface'
import {
  API_BASE,
  API_VERSION,
  ACTION_VERB,
  NETWORK_SLUG,
  buildSig,
  mapMerchant,
  mockOffers,
  type SasMerchant,
  type SasResponse,
} from './shareasale-mappers'

export interface ShareASaleProviderOptions {
  apiToken?: string
  affiliateId?: string
  allowMockFallback?: boolean
}

export class ShareASaleProvider implements OfferProvider {
  readonly networkSlug = NETWORK_SLUG
  private readonly customToken?: string
  private readonly customAffiliateId?: string
  private readonly allowMockFallback: boolean

  constructor(opts?: ShareASaleProviderOptions) {
    this.customToken = opts?.apiToken
    this.customAffiliateId = opts?.affiliateId
    this.allowMockFallback = opts?.allowMockFallback ?? (process.env.NODE_ENV === 'test')
  }

  private get token(): string | undefined {
    if (this.customToken !== undefined) return this.customToken || undefined
    return this.allowMockFallback ? process.env.SHAREASALE_TOKEN : undefined
  }
  private get affiliateId(): string | undefined {
    if (this.customAffiliateId !== undefined) return this.customAffiliateId || undefined
    return this.allowMockFallback ? process.env.SHAREASALE_AFFILIATE_ID : undefined
  }

  async listOffers(opts?: ListOffersOpts): Promise<AffiliateOffer[]> {
    if (!this.token || !this.affiliateId) {
      if (this.allowMockFallback) return mockOffers()
      throw new Error('SHAREASALE_CREDENTIALS_MISSING: ShareASale BYOK credentials are not configured for this workspace')
    }
    try {
      const ts = new Date().toUTCString()
      const sig = await buildSig(this.token, ts)
      const params = new URLSearchParams({
        action: ACTION_VERB,
        affiliateId: this.affiliateId,
        version: API_VERSION,
        pageSize: String(opts?.limit ?? 50),
        sortCol: 'EPC',
        sortDir: 'DESC',
        XMLFormat: '1',
      })
      if (opts?.niche) params.set('category', opts.niche)
      const res = await fetch(`${API_BASE}?${params}`, {
        headers: {
          'x-ShareASale-Date': ts,
          'x-ShareASale-Authentication': sig,
          'x-ShareASale-APIVersion': API_VERSION,
          Accept: 'application/json',
        },
      })
      if (!res.ok) {
        if (this.allowMockFallback) return mockOffers()
        throw new Error(`SHAREASALE_UPSTREAM_ERROR: HTTP ${res.status}`)
      }
      const body = (await res.json()) as SasResponse | SasMerchant[]
      const list: SasMerchant[] = Array.isArray(body) ? body : (body.merchants ?? [])
      if (list.length > 0) return list.map(mapMerchant)
      return this.allowMockFallback ? mockOffers() : []
    } catch (err) {
      if (this.allowMockFallback) return mockOffers()
      throw err instanceof Error ? err : new Error(String(err))
    }
  }

  async getOffer(externalId: string): Promise<AffiliateOffer | null> {
    const list = await this.listOffers()
    const found = list.find(o => o.externalId === externalId)
    return found ?? list[0] ?? null
  }

  async getTrending(niche: string): Promise<AffiliateOffer[]> {
    const offers = await this.listOffers({ niche, limit: 50 })
    return offers.map(asTrending)
  }
}
