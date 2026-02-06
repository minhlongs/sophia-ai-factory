import { Tier } from '@/types';

export interface PolarPrice {
  amountType: 'fixed';
  priceAmount: number;
  priceCurrency: string;
}

export interface PolarProductDefinition {
  name: string;
  description: string;
  tier: Tier;
  prices: PolarPrice[];
}

export const POLAR_PRODUCTS: PolarProductDefinition[] = [
  {
    name: 'Sophia AI Factory - Starter',
    description: 'Perfect for getting started with AI video automation.',
    tier: 'BASIC',
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
  const product = POLAR_PRODUCTS.find(p => p.name.toLowerCase() === normalizedName);

  if (product) {
    return product.tier;
  }

  // Fallback heuristic if exact match fails
  if (normalizedName.includes('premium') || normalizedName.includes('growth')) return 'PREMIUM';
  if (normalizedName.includes('enterprise')) return 'ENTERPRISE';

  return 'BASIC';
};
