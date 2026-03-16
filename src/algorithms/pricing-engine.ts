/**
 * Pricing Engine
 * Multi-model pricing calculations for SaaS products
 * Supports tiered pricing, discounts, bundles, and usage-based billing
 */

export interface PricingTier {
  name: string;
  basePrice: number;
  features: string[];
  limits: Record<string, number>;
}

export interface DiscountRule {
  type: 'percentage' | 'fixed' | 'volume';
  value: number;
  minQuantity?: number;
  minAmount?: number;
  code?: string;
  description?: string;
}

export interface BundleItem {
  productId: string;
  quantity: number;
  unitPrice: number;
}

export interface BundlePricing {
  bundleId: string;
  items: BundleItem[];
  bundleDiscount: number; // Percentage discount for bundle
}

export interface UsageTier {
  from: number;
  to: number | null; // null = unlimited
  pricePerUnit: number;
}

export interface UsageBasedPricing {
  metric: string;
  tiers: UsageTier[];
  includedUnits: number;
  overageRate: number;
}

export interface PricingConfig {
  tiers: PricingTier[];
  discounts: DiscountRule[];
  bundles: BundlePricing[];
  usageBased: UsageBasedPricing[];
  currency: string;
  taxRate: number;
}

export interface PriceQuote {
  productId: string;
  basePrice: number;
  discounts: AppliedDiscount[];
  subtotal: number;
  tax: number;
  total: number;
}

export interface AppliedDiscount {
  type: string;
  description: string;
  amount: number;
}

export interface UsageCharge {
  metric: string;
  unitsUsed: number;
  includedUnits: number;
  billableUnits: number;
  charge: number;
  breakdown: UsageBreakdown[];
}

export interface UsageBreakdown {
  tier: number;
  units: number;
  rate: number;
  subtotal: number;
}

export interface BundleQuote {
  bundleId: string;
  items: BundleItemQuote[];
  itemSubtotal: number;
  bundleDiscount: number;
  total: number;
}

export interface BundleItemQuote {
  productId: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
}

// ============= TIERED PRICING =============

export function getTierForUsage(
  usage: number,
  tiers: PricingTier[]
): PricingTier | null {
  if (tiers.length === 0) return null;

  // Find tier where usage fits within limits
  for (const tier of tiers) {
    const limit = tier.limits?.users || Infinity;
    if (usage <= limit) {
      return tier;
    }
  }

  // Return highest tier if usage exceeds all limits
  return tiers[tiers.length - 1];
}

export function calculateTieredPrice(
  tier: PricingTier,
  quantity: number = 1
): number {
  return tier.basePrice * quantity;
}

// ============= DISCOUNT CALCULATIONS =============

export function calculatePercentageDiscount(
  amount: number,
  percentage: number
): number {
  return amount * (percentage / 100);
}

export function calculateFixedDiscount(
  amount: number,
  fixedAmount: number
): number {
  return Math.min(fixedAmount, amount); // Can't discount more than total
}

export function calculateVolumeDiscount(
  unitPrice: number,
  quantity: number,
  discountRule: DiscountRule
): number {
  if (!discountRule.minQuantity || quantity < discountRule.minQuantity) {
    return 0;
  }

  const subtotal = unitPrice * quantity;

  if (discountRule.type === 'percentage') {
    return calculatePercentageDiscount(subtotal, discountRule.value);
  } else if (discountRule.type === 'fixed') {
    return calculateFixedDiscount(subtotal, discountRule.value);
  }

  return 0;
}

export function applyDiscounts(
  baseAmount: number,
  discounts: DiscountRule[],
  context: { quantity?: number; amount?: number } = {}
): AppliedDiscount[] {
  const applied: AppliedDiscount[] = [];

  for (const rule of discounts) {
    let discountAmount = 0;
    let description = '';

    // Check coupon code match
    if (rule.code && context.amount === undefined) {
      continue;
    }

    // Check minimum thresholds
    if (rule.minQuantity && (context.quantity || 0) < rule.minQuantity) {
      continue;
    }
    if (rule.minAmount && (context.amount || 0) < rule.minAmount) {
      continue;
    }

    switch (rule.type) {
      case 'percentage':
        discountAmount = calculatePercentageDiscount(baseAmount, rule.value);
        description = `${rule.value}% discount`;
        break;
      case 'fixed':
        discountAmount = calculateFixedDiscount(baseAmount, rule.value);
        description = `$${rule.value} fixed discount`;
        break;
      case 'volume':
        discountAmount = calculateVolumeDiscount(
          baseAmount / (context.quantity || 1),
          context.quantity || 0,
          rule
        );
        description = `Volume discount (${context.quantity} units)`;
        break;
    }

    if (discountAmount > 0) {
      applied.push({
        type: rule.type,
        description: rule.code ? `${description} (${rule.code})` : description,
        amount: discountAmount,
      });
    }
  }

  return applied;
}

export function calculateFinalPrice(
  basePrice: number,
  appliedDiscounts: AppliedDiscount[],
  taxRate: number = 0
): { subtotal: number; totalDiscount: number; tax: number; total: number } {
  const totalDiscount = appliedDiscounts.reduce((sum, d) => sum + d.amount, 0);
  const subtotal = basePrice - totalDiscount;
  const tax = subtotal * taxRate;
  const total = subtotal + tax;

  return {
    subtotal,
    totalDiscount,
    tax,
    total,
  };
}

// ============= BUNDLE PRICING =============

export function calculateBundleQuote(
  bundle: BundlePricing,
  taxRate: number = 0
): BundleQuote {
  const itemQuotes: BundleItemQuote[] = bundle.items.map(item => ({
    productId: item.productId,
    quantity: item.quantity,
    unitPrice: item.unitPrice,
    subtotal: item.unitPrice * item.quantity,
  }));

  const itemSubtotal = itemQuotes.reduce((sum, item) => sum + item.subtotal, 0);
  const bundleDiscount = itemSubtotal * (bundle.bundleDiscount / 100);
  const afterDiscount = itemSubtotal - bundleDiscount;
  const tax = afterDiscount * taxRate;
  const total = afterDiscount + tax;

  return {
    bundleId: bundle.bundleId,
    items: itemQuotes,
    itemSubtotal,
    bundleDiscount,
    total,
  };
}

export function compareBundleVsIndividual(
  bundle: BundlePricing,
  individualPrices: Map<string, number>
): { individualTotal: number; bundleSavings: number; savingsPercentage: number } {
  const individualTotal = bundle.items.reduce((sum, item) => {
    const price = individualPrices.get(item.productId) || item.unitPrice;
    return sum + price * item.quantity;
  }, 0);

  const itemSubtotal = bundle.items.reduce((sum, item) => {
    return sum + item.unitPrice * item.quantity;
  }, 0);

  const bundleTotal = itemSubtotal * (1 - bundle.bundleDiscount / 100);
  const savings = individualTotal - bundleTotal;
  const savingsPercentage = individualTotal > 0 ? (savings / individualTotal) * 100 : 0;

  return {
    individualTotal,
    bundleSavings: savings,
    savingsPercentage,
  };
}

// ============= USAGE-BASED BILLING =============

export function calculateUsageCharge(
  unitsUsed: number,
  pricing: UsageBasedPricing
): UsageCharge {
  const includedUnits = pricing.includedUnits || 0;
  const billableUnits = Math.max(0, unitsUsed - includedUnits);

  if (billableUnits === 0) {
    return {
      metric: pricing.metric,
      unitsUsed,
      includedUnits,
      billableUnits: 0,
      charge: 0,
      breakdown: [],
    };
  }

  // Calculate tiered usage charges
  const breakdown: UsageBreakdown[] = [];
  let remainingUnits = billableUnits;
  let totalCharge = 0;

  for (let i = 0; i < pricing.tiers.length; i++) {
    const tier = pricing.tiers[i];
    const tierCapacity = tier.to === null
      ? Infinity
      : Math.max(0, tier.to - tier.from);

    const unitsInTier = Math.min(remainingUnits, tierCapacity);

    if (unitsInTier > 0) {
      const tierCharge = unitsInTier * tier.pricePerUnit;
      breakdown.push({
        tier: i + 1,
        units: unitsInTier,
        rate: tier.pricePerUnit,
        subtotal: tierCharge,
      });
      totalCharge += tierCharge;
      remainingUnits -= unitsInTier;
    }

    if (remainingUnits <= 0) break;
  }

  // Apply overage rate if still remaining (shouldn't happen with proper tiers)
  if (remainingUnits > 0) {
    const overageCharge = remainingUnits * pricing.overageRate;
    breakdown.push({
      tier: pricing.tiers.length + 1,
      units: remainingUnits,
      rate: pricing.overageRate,
      subtotal: overageCharge,
    });
    totalCharge += overageCharge;
  }

  return {
    metric: pricing.metric,
    unitsUsed,
    includedUnits,
    billableUnits,
    charge: totalCharge,
    breakdown,
  };
}

export function calculateTotalUsageBill(
  usageData: Record<string, number>,
  pricingConfig: UsageBasedPricing[],
  taxRate: number = 0
): { usageCharges: UsageCharge[]; subtotal: number; tax: number; total: number } {
  const usageCharges: UsageCharge[] = [];

  for (const pricing of pricingConfig) {
    const unitsUsed = usageData[pricing.metric] || 0;
    const charge = calculateUsageCharge(unitsUsed, pricing);
    if (charge.charge > 0 || unitsUsed > 0) {
      usageCharges.push(charge);
    }
  }

  const subtotal = usageCharges.reduce((sum, c) => sum + c.charge, 0);
  const tax = subtotal * taxRate;
  const total = subtotal + tax;

  return { usageCharges, subtotal, tax, total };
}

// ============= COMPOSITE QUOTE =============

export interface CompositeQuote {
  subscriptionCharges: PriceQuote[];
  usageCharges: UsageCharge[];
  oneTimeCharges: OneTimeCharge[];
  subtotal: number;
  totalDiscount: number;
  tax: number;
  total: number;
}

export interface OneTimeCharge {
  description: string;
  amount: number;
}

export function createCompositeQuote(
  config: PricingConfig,
  selectedTier: PricingTier,
  usageData: Record<string, number>,
  oneTimeCharges: OneTimeCharge[] = [],
  quantity: number = 1
): CompositeQuote {
  // Subscription charges
  const subscriptionBase = calculateTieredPrice(selectedTier, quantity);
  const subscriptionDiscounts = applyDiscounts(subscriptionBase, config.discounts, {
    quantity,
    amount: subscriptionBase,
  });
  const subscriptionQuote: PriceQuote = {
    productId: selectedTier.name,
    basePrice: subscriptionBase,
    discounts: subscriptionDiscounts,
    subtotal: subscriptionBase - subscriptionDiscounts.reduce((s, d) => s + d.amount, 0),
    tax: 0,
    total: 0,
  };

  // Usage charges
  const { usageCharges, subtotal: usageSubtotal } = calculateTotalUsageBill(
    usageData,
    config.usageBased,
    config.taxRate
  );

  // Calculate totals
  const subscriptionSubtotal = subscriptionQuote.subtotal;
  const oneTimeSubtotal = oneTimeCharges.reduce((sum, c) => sum + c.amount, 0);
  const subtotal = subscriptionSubtotal + usageSubtotal + oneTimeSubtotal;
  const totalDiscount = subscriptionQuote.discounts.reduce((s, d) => s + d.amount, 0);
  const tax = subtotal * config.taxRate;
  const total = subtotal + tax;

  return {
    subscriptionCharges: [subscriptionQuote],
    usageCharges,
    oneTimeCharges,
    subtotal,
    totalDiscount,
    tax,
    total,
  };
}

// ============= JSON SCHEMA =============

export const PRICING_CONFIG_SCHEMA = {
  $schema: 'http://json-schema.org/draft-07/schema#',
  type: 'object',
  required: ['tiers', 'currency'],
  properties: {
    tiers: {
      type: 'array',
      items: {
        type: 'object',
        required: ['name', 'basePrice', 'features', 'limits'],
        properties: {
          name: { type: 'string' },
          basePrice: { type: 'number', minimum: 0 },
          features: { type: 'array', items: { type: 'string' } },
          limits: { type: 'object', additionalProperties: { type: 'number' } },
        },
      },
    },
    discounts: {
      type: 'array',
      items: {
        type: 'object',
        required: ['type', 'value'],
        properties: {
          type: { type: 'string', enum: ['percentage', 'fixed', 'volume'] },
          value: { type: 'number', minimum: 0 },
          minQuantity: { type: 'number', minimum: 1 },
          minAmount: { type: 'number', minimum: 0 },
          code: { type: 'string' },
        },
      },
    },
    bundles: {
      type: 'array',
      items: {
        type: 'object',
        required: ['bundleId', 'items', 'bundleDiscount'],
        properties: {
          bundleId: { type: 'string' },
          items: {
            type: 'array',
            items: {
              type: 'object',
              required: ['productId', 'quantity', 'unitPrice'],
              properties: {
                productId: { type: 'string' },
                quantity: { type: 'number', minimum: 1 },
                unitPrice: { type: 'number', minimum: 0 },
              },
            },
          },
          bundleDiscount: { type: 'number', minimum: 0, maximum: 100 },
        },
      },
    },
    usageBased: {
      type: 'array',
      items: {
        type: 'object',
        required: ['metric', 'tiers', 'includedUnits', 'overageRate'],
        properties: {
          metric: { type: 'string' },
          tiers: {
            type: 'array',
            items: {
              type: 'object',
              required: ['from', 'pricePerUnit'],
              properties: {
                from: { type: 'number', minimum: 0 },
                to: { type: ['number', 'null'], minimum: 0 },
                pricePerUnit: { type: 'number', minimum: 0 },
              },
            },
          },
          includedUnits: { type: 'number', minimum: 0 },
          overageRate: { type: 'number', minimum: 0 },
        },
      },
    },
    currency: { type: 'string' },
    taxRate: { type: 'number', minimum: 0, maximum: 1 },
  },
};

// ============= SAMPLE DATA =============

export const DEFAULT_PRICING_TIERS: PricingTier[] = [
  {
    name: 'Starter',
    basePrice: 49,
    features: ['Basic Analytics', '5 Projects', 'Email Support'],
    limits: { users: 5, storage: 10, projects: 5 },
  },
  {
    name: 'Growth',
    basePrice: 149,
    features: ['Advanced Analytics', 'Unlimited Projects', 'Priority Support', 'API Access'],
    limits: { users: 20, storage: 100, projects: Infinity },
  },
  {
    name: 'Premium',
    basePrice: 299,
    features: ['Custom Analytics', 'Unlimited Everything', '24/7 Support', 'SLA', 'White Label'],
    limits: { users: 100, storage: 1000, projects: Infinity },
  },
  {
    name: 'Master',
    basePrice: 499,
    features: ['Enterprise Features', 'Custom Integrations', 'Dedicated Support', 'On-premise Option'],
    limits: { users: Infinity, storage: Infinity, projects: Infinity },
  },
];

export const DEFAULT_DISCOUNTS: DiscountRule[] = [
  { type: 'percentage', value: 10, minAmount: 1000, description: '10% off orders over $1000' },
  { type: 'percentage', value: 20, code: 'ANNUAL', description: '20% off annual plans' },
  { type: 'fixed', value: 50, minAmount: 200, description: '$50 off orders over $200' },
  { type: 'volume', value: 15, minQuantity: 10, description: '15% off 10+ licenses' },
];

export const DEFAULT_BUNDLES: BundlePricing[] = [
  {
    bundleId: 'startup-bundle',
    items: [
      { productId: 'growth-tier', quantity: 1, unitPrice: 149 },
      { productId: 'api-addon', quantity: 1, unitPrice: 99 },
      { productId: 'priority-support', quantity: 1, unitPrice: 49 },
    ],
    bundleDiscount: 15,
  },
  {
    bundleId: 'enterprise-bundle',
    items: [
      { productId: 'master-tier', quantity: 1, unitPrice: 499 },
      { productId: 'custom-integration', quantity: 1, unitPrice: 999 },
      { productId: 'dedicated-support', quantity: 1, unitPrice: 299 },
    ],
    bundleDiscount: 20,
  },
];

export const DEFAULT_USAGE_PRICING: UsageBasedPricing[] = [
  {
    metric: 'api_calls',
    tiers: [
      { from: 0, to: 10000, pricePerUnit: 0.001 },
      { from: 10000, to: 100000, pricePerUnit: 0.0005 },
      { from: 100000, to: null, pricePerUnit: 0.0002 },
    ],
    includedUnits: 1000,
    overageRate: 0.002,
  },
  {
    metric: 'storage_gb',
    tiers: [
      { from: 0, to: 100, pricePerUnit: 0.10 },
      { from: 100, to: 1000, pricePerUnit: 0.05 },
      { from: 1000, to: null, pricePerUnit: 0.02 },
    ],
    includedUnits: 10,
    overageRate: 0.15,
  },
];

export const DEFAULT_PRICING_CONFIG: PricingConfig = {
  tiers: DEFAULT_PRICING_TIERS,
  discounts: DEFAULT_DISCOUNTS,
  bundles: DEFAULT_BUNDLES,
  usageBased: DEFAULT_USAGE_PRICING,
  currency: 'USD',
  taxRate: 0.08,
};

// ============= DEFAULT EXPORT =============

export default {
  getTierForUsage,
  calculateTieredPrice,
  calculatePercentageDiscount,
  calculateFixedDiscount,
  calculateVolumeDiscount,
  applyDiscounts,
  calculateFinalPrice,
  calculateBundleQuote,
  compareBundleVsIndividual,
  calculateUsageCharge,
  calculateTotalUsageBill,
  createCompositeQuote,
  PRICING_CONFIG_SCHEMA,
  DEFAULT_PRICING_TIERS,
  DEFAULT_DISCOUNTS,
  DEFAULT_BUNDLES,
  DEFAULT_USAGE_PRICING,
  DEFAULT_PRICING_CONFIG,
};
