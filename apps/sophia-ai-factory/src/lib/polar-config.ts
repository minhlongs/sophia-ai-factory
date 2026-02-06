import { Tier } from '@/types';

export type BillingType = 'one-time' | 'monthly';

export interface PolarPrice {
  amountType: 'fixed';
  priceAmount: number;
  priceCurrency: string;
}

export interface PolarProductDefinition {
  name: string;
  description: string;
  tier: Tier;
  billingType: BillingType;
  productId: string;
  prices: PolarPrice[];
}

// One-time products (Lifetime Deal)
export const POLAR_PRODUCTS_ONETIME: PolarProductDefinition[] = [
  {
    name: 'Sophia AI Factory - Starter',
    description: 'Perfect for getting started with AI video automation.',
    tier: 'BASIC',
    billingType: 'one-time',
    productId: process.env.POLAR_PRODUCT_ID_STARTER || '',
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
    billingType: 'one-time',
    productId: process.env.POLAR_PRODUCT_ID_GROWTH || '',
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
    billingType: 'one-time',
    productId: process.env.POLAR_PRODUCT_ID_PREMIUM || '',
    prices: [
      {
        amountType: 'fixed',
        priceAmount: 300000, // $3,000.00
        priceCurrency: 'usd',
      },
    ],
  },
];

// Monthly subscription products (Maintenance Packages)
export const POLAR_PRODUCTS_MONTHLY: PolarProductDefinition[] = [
  {
    name: 'Sophia AI Factory - Starter Monthly',
    description: 'Monthly maintenance for Starter tier.',
    tier: 'BASIC',
    billingType: 'monthly',
    productId: process.env.POLAR_PRODUCT_ID_STARTER_MONTHLY || '',
    prices: [
      {
        amountType: 'fixed',
        priceAmount: 9900, // $99.00/mo
        priceCurrency: 'usd',
      },
    ],
  },
  {
    name: 'Sophia AI Factory - Growth Monthly',
    description: 'Monthly maintenance for Growth tier.',
    tier: 'PREMIUM',
    billingType: 'monthly',
    productId: process.env.POLAR_PRODUCT_ID_GROWTH_MONTHLY || '',
    prices: [
      {
        amountType: 'fixed',
        priceAmount: 19900, // $199.00/mo
        priceCurrency: 'usd',
      },
    ],
  },
  {
    name: 'Sophia AI Factory - Premium Monthly',
    description: 'Monthly maintenance for Premium tier.',
    tier: 'ENTERPRISE',
    billingType: 'monthly',
    productId: process.env.POLAR_PRODUCT_ID_PREMIUM_MONTHLY || '',
    prices: [
      {
        amountType: 'fixed',
        priceAmount: 49900, // $499.00/mo
        priceCurrency: 'usd',
      },
    ],
  },
];

// Combined list of all products (for backwards compatibility)
export const POLAR_PRODUCTS: PolarProductDefinition[] = [
  ...POLAR_PRODUCTS_ONETIME,
  ...POLAR_PRODUCTS_MONTHLY,
];

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

// Get product ID by tier (defaults to one-time product)
export const getProductIdByTier = (tier: string, billingType: BillingType = 'one-time'): string | undefined => {
  const products = billingType === 'monthly' ? POLAR_PRODUCTS_MONTHLY : POLAR_PRODUCTS_ONETIME;
  const product = products.find(p => p.tier === tier);
  return product?.productId;
};

// Get all products for a specific billing type
export const getProductsByBillingType = (billingType: BillingType): PolarProductDefinition[] => {
  return billingType === 'monthly' ? POLAR_PRODUCTS_MONTHLY : POLAR_PRODUCTS_ONETIME;
};
