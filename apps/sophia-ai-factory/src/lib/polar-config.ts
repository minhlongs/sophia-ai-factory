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

// Helper to get env var at RUNTIME (not build time) - TRIM to remove trailing newlines
const getEnv = (key: string): string => (process.env[key] || '').trim();

// One-time products (Lifetime Deal) - use getter functions for runtime access
export const getPolarProductsOnetime = (): PolarProductDefinition[] => [
  {
    name: 'Sophia AI Factory - Starter',
    description: 'Perfect for getting started with AI video automation.',
    tier: 'BASIC',
    billingType: 'one-time',
    productId: getEnv('POLAR_PRODUCT_ID_STARTER'),
    prices: [{ amountType: 'fixed', priceAmount: 120000, priceCurrency: 'usd' }],
  },
  {
    name: 'Sophia AI Factory - Growth',
    description: 'Scale your content production with advanced features.',
    tier: 'PREMIUM',
    billingType: 'one-time',
    productId: getEnv('POLAR_PRODUCT_ID_GROWTH'),
    prices: [{ amountType: 'fixed', priceAmount: 200000, priceCurrency: 'usd' }],
  },
  {
    name: 'Sophia AI Factory - Premium',
    description: 'Maximum power and support for enterprise needs.',
    tier: 'ENTERPRISE',
    billingType: 'one-time',
    productId: getEnv('POLAR_PRODUCT_ID_PREMIUM'),
    prices: [{ amountType: 'fixed', priceAmount: 300000, priceCurrency: 'usd' }],
  },
];

// Monthly subscription products (Maintenance Packages)
export const getPolarProductsMonthly = (): PolarProductDefinition[] => [
  {
    name: 'Sophia AI Factory - Starter Monthly',
    description: 'Monthly maintenance for Starter tier.',
    tier: 'BASIC',
    billingType: 'monthly',
    productId: getEnv('POLAR_PRODUCT_ID_STARTER_MONTHLY'),
    prices: [{ amountType: 'fixed', priceAmount: 9900, priceCurrency: 'usd' }],
  },
  {
    name: 'Sophia AI Factory - Growth Monthly',
    description: 'Monthly maintenance for Growth tier.',
    tier: 'PREMIUM',
    billingType: 'monthly',
    productId: getEnv('POLAR_PRODUCT_ID_GROWTH_MONTHLY'),
    prices: [{ amountType: 'fixed', priceAmount: 19900, priceCurrency: 'usd' }],
  },
  {
    name: 'Sophia AI Factory - Premium Monthly',
    description: 'Monthly maintenance for Premium tier.',
    tier: 'ENTERPRISE',
    billingType: 'monthly',
    productId: getEnv('POLAR_PRODUCT_ID_PREMIUM_MONTHLY'),
    prices: [{ amountType: 'fixed', priceAmount: 49900, priceCurrency: 'usd' }],
  },
];

// Combined getter for all products
export const getPolarProducts = (): PolarProductDefinition[] => [
  ...getPolarProductsOnetime(),
  ...getPolarProductsMonthly(),
];

// Backwards compatibility exports (used by pricing-section.tsx)
export const POLAR_PRODUCTS = getPolarProductsOnetime();
export const POLAR_PRODUCTS_ONETIME = getPolarProductsOnetime();
export const POLAR_PRODUCTS_MONTHLY = getPolarProductsMonthly();

export const getTierFromProductName = (name: string): Tier => {
  const normalizedName = name.toLowerCase();
  const products = getPolarProducts();
  const product = products.find(p => p.name.toLowerCase() === normalizedName);

  if (product) {
    return product.tier;
  }

  // Fallback heuristic
  if (normalizedName.includes('premium') || normalizedName.includes('growth')) return 'PREMIUM';
  if (normalizedName.includes('enterprise')) return 'ENTERPRISE';

  return 'BASIC';
};

// Get product ID by tier - reads env at RUNTIME
export const getProductIdByTier = (tier: string, billingType: BillingType = 'one-time'): string | undefined => {
  const products = billingType === 'monthly' ? getPolarProductsMonthly() : getPolarProductsOnetime();
  const product = products.find(p => p.tier === tier);
  return product?.productId || undefined;
};

// Get all products for a specific billing type
export const getProductsByBillingType = (billingType: BillingType): PolarProductDefinition[] => {
  return billingType === 'monthly' ? getPolarProductsMonthly() : getPolarProductsOnetime();
};
