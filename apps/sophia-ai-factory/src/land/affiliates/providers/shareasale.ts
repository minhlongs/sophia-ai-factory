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

const API_BASE = 'https://api.shareasale.com/x.cfm'
const API_VERSION = '2.8'
const ACTION_VERB = 'getMerchantList'
const NETWORK_SLUG = 'shareasale'

interface SasMerchant {
  merchantID?: string | number
  merchantName?: string
  www?: string
  category?: string
  description?: string
  commission?: string | number
  EPC?: string | number
  networkEarnings?: string | number
}

interface SasResponse {
  merchants?: SasMerchant[]
}

async function buildSig(token: string, ts: string): Promise<string> {
  const msg = `${token}:${ts}:${API_VERSION}:${ACTION_VERB}`
  const enc = new TextEncoder()
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(token),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const buf = await crypto.subtle.sign('HMAC', key, enc.encode(msg))
  return Array.from(new Uint8Array(buf))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
}

function mapMerchant(m: SasMerchant): AffiliateOffer {
  const commRaw = m.commission ?? m.networkEarnings
  const commVal = commRaw !== undefined && String(commRaw) !== '' ? parseFloat(String(commRaw)) : null
  const isPercent = commRaw ? !String(commRaw).includes('$') : true
  return {
    externalId: String(m.merchantID ?? ''),
    title: String(m.merchantName ?? ''),
    description: String(m.description ?? '').slice(0, 500),
    imageUrl: 'https://placehold.co/400x400?text=ShareASale',
    productUrl: m.www ? String(m.www) : `https://shareasale.com/r.cfm?m=${m.merchantID}`,
    commissionPct: isPercent && commVal !== null && !isNaN(commVal) ? commVal : null,
    commissionFixedUsd: !isPercent && commVal !== null && !isNaN(commVal) ? commVal : null,
    niche: m.category ? String(m.category).toLowerCase() : 'software',
    language: 'en',
    region: 'US',
    isTrending: false,
  }
}

function mockOffers(): AffiliateOffer[] {
  return [
    {
      externalId: 'sas-mock-001',
      title: 'ShareASale Cloud Platform (Mock)',
      description: 'Enterprise cloud management platform with high EPC – mock fixture',
      imageUrl: 'https://placehold.co/400x400?text=ShareASale',
      productUrl: 'https://shareasale.com/r.cfm?b=123&u=AFFILIATE&m=SAS1001',
      commissionPct: 30,
      commissionFixedUsd: null,
      niche: 'software',
      language: 'en',
      region: 'US',
      isTrending: false,
    },
    {
      externalId: 'sas-mock-002',
      title: 'ShareASale E-Commerce SaaS (Mock)',
      description: 'Automated conversion optimizer for digital merchants – mock fixture',
      imageUrl: 'https://placehold.co/400x400?text=ShareASale+2',
      productUrl: 'https://shareasale.com/r.cfm?b=456&u=AFFILIATE&m=SAS1002',
      commissionPct: 25,
      commissionFixedUsd: 50,
      niche: 'saas',
      language: 'en',
      region: 'US',
      isTrending: false,
    },
  ]
}

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
