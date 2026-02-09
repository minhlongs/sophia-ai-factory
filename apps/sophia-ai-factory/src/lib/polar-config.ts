import { Tier } from '@/types';

export type BillingType = 'subscription' | 'one-time';

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

// Helper to get env var at RUNTIME (not build time) - TRIM to remove trailing newlines
const getEnv = (key: string): string => (process.env[key] || '').trim();

// Subscription products (All-in monthly with 12-month commitment)
export const getPolarProductsSubscription = (): PolarProductDefinition[] => [
  {
    name: 'Sophia AI Factory - Starter Sub',
    description: 'Complete AI video automation. 12-month commitment.',
    tier: 'BASIC',
    billingType: 'subscription',
    productId: getEnv('POLAR_PRODUCT_ID_STARTER_SUB') || getEnv('POLAR_PRODUCT_ID_STARTER'),
    prices: [{ amountType: 'fixed', priceAmount: 19900, priceCurrency: 'usd' }],
  },
  {
    name: 'Sophia AI Factory - Growth Sub',
    description: 'Scale your content production. 12-month commitment.',
    tier: 'PREMIUM',
    billingType: 'subscription',
    productId: getEnv('POLAR_PRODUCT_ID_GROWTH_SUB') || getEnv('POLAR_PRODUCT_ID_GROWTH'),
    prices: [{ amountType: 'fixed', priceAmount: 39900, priceCurrency: 'usd' }],
  },
  {
    name: 'Sophia AI Factory - Premium Sub',
    description: 'Enterprise power and support. 12-month commitment.',
    tier: 'ENTERPRISE',
    billingType: 'subscription',
    productId: getEnv('POLAR_PRODUCT_ID_PREMIUM_SUB') || getEnv('POLAR_PRODUCT_ID_PREMIUM'),
    prices: [{ amountType: 'fixed', priceAmount: 79900, priceCurrency: 'usd' }],
  },
];

// One-time Master package (Binh Pháp upsell)
export const getPolarProductsMaster = (): PolarProductDefinition[] => [
  {
    name: 'Sophia AI Factory - Master',
    description: 'Lifetime access. One-time payment. Best value.',
    tier: 'MASTER',
    billingType: 'one-time',
    productId: getEnv('POLAR_PRODUCT_ID_MASTER'),
    prices: [{ amountType: 'fixed', priceAmount: 499900, priceCurrency: 'usd' }],
  },
];

// Combined getter for all products
export const getPolarProducts = (): PolarProductDefinition[] => [
  ...getPolarProductsSubscription(),
  ...getPolarProductsMaster(),
];

// Backwards compatibility exports
export const POLAR_PRODUCTS = getPolarProducts();

export const getTierFromProductName = (name: string): Tier => {
  const normalizedName = name.toLowerCase();
  const products = getPolarProducts();
  const product = products.find(p => p.name.toLowerCase() === normalizedName);

  if (product) {
    return product.tier;
  }

  // Fallback heuristic
  if (normalizedName.includes('premium')) return 'ENTERPRISE';
  if (normalizedName.includes('growth')) return 'PREMIUM';

  return 'BASIC';
};

// Get product ID by tier - searches all products (subscription + one-time)
export const getProductIdByTier = (tier: string): string | undefined => {
  const products = getPolarProducts();
  const product = products.find(p => p.tier === tier);
  return product?.productId || undefined;
};
