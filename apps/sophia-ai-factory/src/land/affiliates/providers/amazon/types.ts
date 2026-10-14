/**
 * Types, response mapping, and mock fixtures for Amazon PA-API v5.
 * @module land/affiliates/providers/amazon/types
 */

import type { AffiliateOffer } from '../../provider-interface';

export interface AmazonItem {
  ASIN: string;
  ItemInfo?: { Title?: { DisplayValue?: string }; Features?: { DisplayValues?: string[] } };
  Images?: { Primary?: { Medium?: { URL?: string } } };
  Offers?: { Listings?: { Price?: { Amount?: number } }[] };
  DetailPageURL?: string;
  BrowseNodeInfo?: { BrowseNodes?: { DisplayName?: string }[] };
}

export interface PaApiResponse {
  SearchResult?: { Items?: AmazonItem[] };
}

export function mapItem(item: AmazonItem, partnerTag: string): AffiliateOffer {
  const title = item.ItemInfo?.Title?.DisplayValue ?? item.ASIN;
  const features = item.ItemInfo?.Features?.DisplayValues ?? [];
  return {
    externalId: item.ASIN,
    title,
    description: features.slice(0, 2).join('. '),
    imageUrl: item.Images?.Primary?.Medium?.URL ?? '',
    productUrl: `https://www.amazon.com/dp/${item.ASIN}?tag=${partnerTag}`,
    commissionPct: 4,
    commissionFixedUsd: null,
    niche: item.BrowseNodeInfo?.BrowseNodes?.[0]?.DisplayName ?? 'general',
    language: 'en',
    region: 'US',
    isTrending: false,
  };
}

export function mockOffers(): AffiliateOffer[] {
  return [
    {
      externalId: 'B0AMZOCK01',
      title: 'Amazon Best Seller Electronics (Mock)',
      description: 'Mock product fixture for PA-API v5 adapter',
      imageUrl: 'https://placehold.co/400x400?text=Amazon',
      productUrl: 'https://www.amazon.com/dp/B0AMZOCK01?tag=mock-20',
      commissionPct: 4,
      commissionFixedUsd: null,
      niche: 'electronics',
      language: 'en',
      region: 'US',
      isTrending: false,
    },
  ];
}
