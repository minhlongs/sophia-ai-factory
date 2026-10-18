/**
 * AccessTrade Vietnam Affiliate Mappers & Fixtures
 *
 * @module affiliates/providers/accesstrade-mappers
 */

import type { AffiliateOffer } from '../provider-interface'

export interface AccessTradeProduct {
  product_id: string
  product_name: string
  description?: string
  image_url?: string
  url_product: string
  commission_pct?: number
  category?: string
}

export interface AccessTradeCampaign {
  campaign_id: string
  campaign_name: string
  description?: string
  campaign_url: string
  commission_type?: string
  commission?: number
  category?: string
  logo?: string
}

export function mapProduct(p: AccessTradeProduct): AffiliateOffer {
  return {
    externalId: p.product_id,
    title: p.product_name ?? '',
    description: p.description ?? '',
    imageUrl: p.image_url ?? '',
    productUrl: p.url_product,
    commissionPct: p.commission_pct ?? null,
    commissionFixedUsd: null,
    niche: p.category ?? 'general',
    language: 'vi',
    region: 'VN',
    isTrending: false,
  }
}

export function mapCampaign(c: AccessTradeCampaign): AffiliateOffer {
  return {
    externalId: c.campaign_id,
    title: c.campaign_name ?? '',
    description: c.description ?? '',
    imageUrl: c.logo ?? '',
    productUrl: c.campaign_url,
    commissionPct: c.commission_type === 'cps' ? (c.commission ?? null) : null,
    commissionFixedUsd: c.commission_type === 'cpa' ? (c.commission ?? null) : null,
    niche: c.category ?? 'general',
    language: 'vi',
    region: 'VN',
    isTrending: false,
  }
}

export function mockOffers(): AffiliateOffer[] {
  return [
    {
      externalId: 'at-mock-001',
      title: 'AccessTrade Shopee Voucher (Mock)',
      description: 'Shopee VN top campaign – mock fixture',
      imageUrl: 'https://placehold.co/400x400?text=AccessTrade',
      productUrl: 'https://pub2.accesstrade.vn/link/at-mock-001',
      commissionPct: 8,
      commissionFixedUsd: null,
      niche: 'ecommerce',
      language: 'vi',
      region: 'VN',
      isTrending: false,
    },
  ]
}
