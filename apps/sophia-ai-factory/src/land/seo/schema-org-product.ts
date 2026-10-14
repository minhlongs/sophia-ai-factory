/**
 * Schema.org Product JSON-LD builders (one per pricing tier).
 */

import { TIER_CONFIGS, TIER_CONFIG } from '@/seed/config/tiers';
import type { Tier } from '@/seed/types';
import { SITE_URL } from './schema-org-site';

export interface ProductSchema {
  '@context': string;
  '@type': 'Product';
  name: string;
  description: string;
  brand: {
    '@type': 'Brand';
    name: string;
  };
  offers: {
    '@type': 'Offer';
    price: string;
    priceCurrency: string;
    availability: string;
    url: string;
  };
}

export function buildProductSchema(tier: Tier): ProductSchema {
  const config = TIER_CONFIGS[tier];
  const label = TIER_CONFIG[tier].label;
  const features = TIER_CONFIG[tier].features.join(', ');
  const isLifetime = config.price === 4999;
  const priceDisplay = isLifetime
    ? `${config.price} one-time`
    : `${config.price}/month`;

  return {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: `Sophia AI Factory — ${label}`,
    description: `${label} tier: ${features}. ${priceDisplay} USDT.`,
    brand: {
      '@type': 'Brand',
      name: 'Sophia AI Factory',
    },
    offers: {
      '@type': 'Offer',
      price: String(config.price),
      priceCurrency: 'USD',
      availability: 'https://schema.org/InStock',
      url: `${SITE_URL}/pricing#tier-${label.toLowerCase()}`,
    },
  };
}

/** Build all 4 tier Product schemas in a single array. */
export function buildAllProductSchemas(): ProductSchema[] {
  const tiers: Tier[] = ['BASIC', 'PREMIUM', 'ENTERPRISE', 'MASTER'];
  return tiers.map(buildProductSchema);
}
