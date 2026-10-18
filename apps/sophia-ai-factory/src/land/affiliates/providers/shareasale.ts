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

export class ShareASaleProvider implements OfferProvider {
  readonly networkSlug = NETWORK_SLUG

  private get token(): string | undefined { return process.env.SHAREASALE_TOKEN }
  private get affiliateId(): string | undefined { return process.env.SHAREASALE_AFFILIATE_ID }

  async listOffers(opts?: ListOffersOpts): Promise<AffiliateOffer[]> {
    if (!this.token || !this.affiliateId) return mockOffers()
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
      if (!res.ok) return mockOffers()
      const body = (await res.json()) as SasResponse | SasMerchant[]
      const list: SasMerchant[] = Array.isArray(body) ? body : (body.merchants ?? [])
      return list.length > 0 ? list.map(mapMerchant) : mockOffers()
    } catch {
      return mockOffers()
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
