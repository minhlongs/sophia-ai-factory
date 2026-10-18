/**
 * ShareASale Affiliate Adapter Mappers, Signature & Mock Fixtures
 *
 * @module affiliates/providers/shareasale-mappers
 */

import type { AffiliateOffer } from '../provider-interface'

export const API_BASE = 'https://api.shareasale.com/x.cfm'
export const API_VERSION = '2.8'
export const ACTION_VERB = 'getMerchantList'
export const NETWORK_SLUG = 'shareasale'

export interface SasMerchant {
  merchantID?: string | number
  merchantName?: string
  www?: string
  category?: string
  description?: string
  commission?: string | number
  EPC?: string | number
  networkEarnings?: string | number
}

export interface SasResponse {
  merchants?: SasMerchant[]
}

export async function buildSig(token: string, ts: string): Promise<string> {
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

export function mapMerchant(m: SasMerchant): AffiliateOffer {
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

export function mockOffers(): AffiliateOffer[] {
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
