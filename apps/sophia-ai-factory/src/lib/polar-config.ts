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

// Helper to get env var at RUNTIME (not build time)
// Strip literal \n (backslash+n) that some CLIs append, then trim whitespace
const getEnv = (key: string): string => (process.env[key] || '').replace(/\\n$/, '').trim();

// Monthly subscription products
export const getPolarProductsSubscription = (): PolarProductDefinition[] => [
  {
    name: 'Sophia AI Factory - Starter',
    description: 'Complete AI video automation. Monthly subscription.',
    tier: 'BASIC',
    billingType: 'subscription',
    productId: getEnv('POLAR_PRODUCT_ID_STARTER') || getEnv('POLAR_PRODUCT_ID_STARTER_MONTHLY'),
    prices: [{ amountType: 'fixed', priceAmount: 19900, priceCurrency: 'usd' }],
  },
  {
    name: 'Sophia AI Factory - Growth',
    description: 'Scale your content production. Monthly subscription.',
    tier: 'PREMIUM',
    billingType: 'subscription',
    productId: getEnv('POLAR_PRODUCT_ID_GROWTH') || getEnv('POLAR_PRODUCT_ID_GROWTH_MONTHLY'),
    prices: [{ amountType: 'fixed', priceAmount: 39900, priceCurrency: 'usd' }],
  },
  {
    name: 'Sophia AI Factory - Premium',
    description: 'Enterprise power and support. Monthly subscription.',
    tier: 'ENTERPRISE',
    billingType: 'subscription',
    productId: getEnv('POLAR_PRODUCT_ID_PREMIUM') || getEnv('POLAR_PRODUCT_ID_PREMIUM_MONTHLY'),
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
