/**
 * Bridge Page Types
 *
 * Types for high-converting edge bridge pages, dynamic bio-links,
 * and regional affiliate offer routing.
 *
 * Layer: tree/affiliate/bridge (Domain Logic)
 * @module tree/affiliate/bridge/bridge-page-types
 */

export type BridgeNiche = 'saas' | 'crypto';

export interface VanityCoupon {
  code: string;
  discountText: string;
  expiresInSeconds: number;
}

export interface BridgePageData {
  productId: string;
  niche: BridgeNiche;
  title: string;
  headline: string;
  subheadline: string;
  teaserVideoUrl?: string;
  thumbnailUrl?: string;
  bulletPoints: string[];
  vanityCoupon: VanityCoupon;
  destinationUrl: string;
  ctaLabel: string;
  locale: 'vi' | 'en';
  country: string;
}

export interface BuildBridgePageInput {
  productId: string;
  locale?: string;
  country?: string | null;
  destinationUrl: string;
}
