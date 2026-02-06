import { Tier } from '@/types';

export interface LemonSqueezyPrice {
  amountType: 'fixed';
  priceAmount: number;
  priceCurrency: string;
}

export interface LemonSqueezyProductDefinition {
  name: string;
  description: string;
  tier: Tier;
  variantId: string;
  prices: LemonSqueezyPrice[];
}

export const LEMONSQUEEZY_PRODUCTS: LemonSqueezyProductDefinition[] = [
  {
    name: 'Sophia AI Factory - Starter',
    description: 'Perfect for getting started with AI video automation.',
    tier: 'BASIC',
    variantId: process.env.LEMONSQUEEZY_VARIANT_ID_BASIC || '',
    prices: [
      {
        amountType: 'fixed',
        priceAmount: 120000, // $1,200.00
        priceCurrency: 'usd',
      },
    ],
  },
  {
    name: 'Sophia AI Factory - Growth',
    description: 'Scale your content production with advanced features.',
    tier: 'PREMIUM',
    variantId: process.env.LEMONSQUEEZY_VARIANT_ID_PREMIUM || '',
    prices: [
      {
        amountType: 'fixed',
        priceAmount: 200000, // $2,000.00
        priceCurrency: 'usd',
      },
    ],
  },
  {
    name: 'Sophia AI Factory - Premium',
    description: 'Maximum power and support for enterprise needs.',
    tier: 'ENTERPRISE',
    variantId: process.env.LEMONSQUEEZY_VARIANT_ID_ENTERPRISE || '',
    prices: [
      {
        amountType: 'fixed',
        priceAmount: 300000, // $3,000.00
        priceCurrency: 'usd',
      },
    ],
  },
] as const;

export const getTierFromProductName = (name: string): Tier => {
  const normalizedName = name.toLowerCase();
  const product = LEMONSQUEEZY_PRODUCTS.find(p => p.name.toLowerCase() === normalizedName);

  if (product) {
    return product.tier;
  }

  // Fallback heuristic if exact match fails
  if (normalizedName.includes('premium') || normalizedName.includes('growth')) return 'PREMIUM';
  if (normalizedName.includes('enterprise')) return 'ENTERPRISE';

  return 'BASIC';
};

export const getVariantIdByTier = (tier: string): string | undefined => {
  const product = LEMONSQUEEZY_PRODUCTS.find(p => p.tier === tier);
  return product?.variantId;
};
