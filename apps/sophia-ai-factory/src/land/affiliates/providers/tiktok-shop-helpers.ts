/**
 * TikTok Shop signing, mapping, and mock fixture helpers.
 * @module affiliates/providers/tiktok-shop-helpers
 */

import type { AffiliateOffer } from '../provider-interface'

/** TikTok Shop API product shape (subset we use) */
export interface TikTokProduct {
  id: string
  title: string
  description?: string
  main_images?: { urls?: string[] }[]
  seller_skus?: { price?: { original_price?: string }; affiliate_commission_rate?: string }[]
}

/** Sign TikTok Shop API request with HMAC-SHA256 */
export async function signRequest(
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

export function mapProduct(p: TikTokProduct): AffiliateOffer {
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

export function mockOffers(trending = false): AffiliateOffer[] {
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
