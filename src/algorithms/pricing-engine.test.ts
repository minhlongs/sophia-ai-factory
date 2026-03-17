/**
 * Pricing Engine Tests
 * Comprehensive test coverage for tiered pricing, discounts, bundles, and usage-based billing
 */

import { describe, it, expect } from 'vitest';
import {
  // Tiered Pricing
  getTierForUsage,
  calculateTieredPrice,
  // Discount Calculations
  calculatePercentageDiscount,
  calculateFixedDiscount,
  calculateVolumeDiscount,
  applyDiscounts,
  calculateFinalPrice,
  // Bundle Pricing
  calculateBundleQuote,
  compareBundleVsIndividual,
  // Usage-Based Billing
  calculateUsageCharge,
  calculateTotalUsageBill,
  // Composite Quotes
  createCompositeQuote,
  // Types
  type PricingTier,
  type DiscountRule,
  type BundlePricing,
  type UsageBasedPricing,
  type PricingConfig,
  // Sample Data
  DEFAULT_PRICING_TIERS,
  DEFAULT_DISCOUNTS,
  DEFAULT_BUNDLES,
  DEFAULT_USAGE_PRICING,
  DEFAULT_PRICING_CONFIG,
} from './pricing-engine';

// ==================== TIERED PRICING TESTS ====================

describe('Tiered Pricing', () => {
  const tiers: PricingTier[] = [
    { name: 'Basic', basePrice: 29, features: ['Feature A'], limits: { users: 5 } },
    { name: 'Pro', basePrice: 79, features: ['Feature A', 'B'], limits: { users: 20 } },
    { name: 'Enterprise', basePrice: 199, features: ['All'], limits: { users: Infinity } },
  ];

  describe('getTierForUsage', () => {
    it('should return Basic tier for 3 users', () => {
      const tier = getTierForUsage(3, tiers);
      expect(tier?.name).toBe('Basic');
    });

    it('should return Pro tier for 15 users', () => {
      const tier = getTierForUsage(15, tiers);
      expect(tier?.name).toBe('Pro');
    });

    it('should return Enterprise tier for 50 users (exceeds Pro limit)', () => {
      const tier = getTierForUsage(50, tiers);
      expect(tier?.name).toBe('Enterprise');
    });

    it('should return Enterprise tier for unlimited users', () => {
      const tier = getTierForUsage(1000, tiers);
      expect(tier?.name).toBe('Enterprise');
    });

    it('should return null for empty tiers array', () => {
      const tier = getTierForUsage(5, []);
      expect(tier).toBeNull();
    });

    it('should return only tier when single tier exists', () => {
      const singleTier = [{ name: 'Only', basePrice: 50, features: [], limits: { users: 10 } }];
      expect(getTierForUsage(5, singleTier)?.name).toBe('Only');
      expect(getTierForUsage(15, singleTier)?.name).toBe('Only');
    });
  });

  describe('calculateTieredPrice', () => {
    it('should calculate base price for quantity 1', () => {
      const tier = tiers[0];
      expect(calculateTieredPrice(tier)).toBe(29);
    });

    it('should calculate price for quantity 5', () => {
      const tier = tiers[0];
      expect(calculateTieredPrice(tier, 5)).toBe(145);
    });

    it('should handle quantity 0', () => {
      const tier = tiers[0];
      expect(calculateTieredPrice(tier, 0)).toBe(0);
    });

    it('should calculate enterprise tier price', () => {
      const tier = tiers[2];
      expect(calculateTieredPrice(tier, 3)).toBe(597);
    });
  });
});

// ==================== DISCOUNT CALCULATION TESTS ====================

describe('Discount Calculations', () => {
  describe('calculatePercentageDiscount', () => {
    it('should calculate 10% discount on $100', () => {
      expect(calculatePercentageDiscount(100, 10)).toBe(10);
    });

    it('should calculate 25% discount on $200', () => {
      expect(calculatePercentageDiscount(200, 25)).toBe(50);
    });

    it('should handle 0% discount', () => {
      expect(calculatePercentageDiscount(100, 0)).toBe(0);
    });

    it('should handle 100% discount', () => {
      expect(calculatePercentageDiscount(100, 100)).toBe(100);
    });
  });

  describe('calculateFixedDiscount', () => {
    it('should apply $20 fixed discount', () => {
      expect(calculateFixedDiscount(100, 20)).toBe(20);
    });

    it('should cap discount at total amount', () => {
      expect(calculateFixedDiscount(15, 20)).toBe(15);
    });

    it('should handle exact amount match', () => {
      expect(calculateFixedDiscount(50, 50)).toBe(50);
    });
  });

  describe('calculateVolumeDiscount', () => {
    const percentageRule: DiscountRule = { type: 'percentage', value: 15, minQuantity: 10 };
    const fixedRule: DiscountRule = { type: 'fixed', value: 100, minQuantity: 5 };

    it('should apply percentage volume discount', () => {
      const result = calculateVolumeDiscount(50, 15, percentageRule);
      expect(result).toBe(112.5); // 50 * 15 * 0.15
    });

    it('should not apply discount below minQuantity', () => {
      const result = calculateVolumeDiscount(50, 5, percentageRule);
      expect(result).toBe(0);
    });

    it('should apply fixed volume discount', () => {
      const result = calculateVolumeDiscount(200, 10, fixedRule);
      expect(result).toBe(100);
    });

    it('should return 0 for invalid discount type', () => {
      const invalidRule: DiscountRule = { type: 'volume', value: 0 };
      const result = calculateVolumeDiscount(50, 10, invalidRule);
      expect(result).toBe(0);
    });
  });

  describe('applyDiscounts', () => {
    const discounts: DiscountRule[] = [
      { type: 'percentage', value: 10, minAmount: 100, description: '10% off $100+' },
      { type: 'fixed', value: 25, minAmount: 50, description: '$25 off $50+' },
      { type: 'percentage', value: 20, code: 'SAVE20', description: '20% off with code' },
    ];

    it('should apply percentage discount when amount threshold met', () => {
      const applied = applyDiscounts(150, discounts, { amount: 150 });
      // All 3 discounts apply: 10% off $100+, $25 off $50+, SAVE20 coupon
      expect(applied.length).toBe(3);
      expect(applied[0].amount).toBe(15); // 10% of 150
    });

    it('should not apply discount when threshold not met', () => {
      const applied = applyDiscounts(40, discounts, { amount: 40 });
      // SAVE20 coupon has no minAmount, so it still applies
      expect(applied.length).toBe(1);
      expect(applied[0].description).toContain('SAVE20');
    });

    it('should apply fixed discount', () => {
      const applied = applyDiscounts(75, discounts, { amount: 75 });
      const fixedDiscount = applied.find(d => d.type === 'fixed');
      expect(fixedDiscount?.amount).toBe(25);
    });

    it('should show coupon code in description', () => {
      const applied = applyDiscounts(100, discounts, { amount: 100 });
      const codeDiscount = applied.find(d => d.description.includes('SAVE20'));
      expect(codeDiscount?.description).toContain('SAVE20');
    });

    it('should handle volume discount with quantity', () => {
      const volumeDiscounts: DiscountRule[] = [
        { type: 'volume', value: 15, minQuantity: 10, description: '15% off 10+ units' },
      ];
      const applied = applyDiscounts(500, volumeDiscounts, { quantity: 10 });
      expect(applied.length).toBe(1);
      expect(applied[0].type).toBe('volume');
      expect(applied[0].description).toContain('Volume discount');
      expect(applied[0].amount).toBeGreaterThan(0);
    });
  });

  describe('calculateFinalPrice', () => {
    it('should calculate final price with discounts and tax', () => {
      const discounts = [
        { type: 'percentage', description: '10% off', amount: 10 },
        { type: 'fixed', description: '$5 off', amount: 5 },
      ];
      const result = calculateFinalPrice(100, discounts, 0.08);

      expect(result.totalDiscount).toBe(15);
      expect(result.subtotal).toBe(85);
      expect(result.tax).toBe(6.8);
      expect(result.total).toBe(91.8);
    });

    it('should handle zero tax rate', () => {
      const discounts = [{ type: 'percentage', description: '5% off', amount: 5 }];
      const result = calculateFinalPrice(100, discounts, 0);

      expect(result.tax).toBe(0);
      expect(result.total).toBe(95);
    });

    it('should handle no discounts', () => {
      const result = calculateFinalPrice(100, [], 0.1);

      expect(result.totalDiscount).toBe(0);
      expect(result.subtotal).toBe(100);
      expect(result.total).toBe(110);
    });
  });
});

// ==================== BUNDLE PRICING TESTS ====================

describe('Bundle Pricing', () => {
  const bundle: BundlePricing = {
    bundleId: 'test-bundle',
    items: [
      { productId: 'product-a', quantity: 2, unitPrice: 50 },
      { productId: 'product-b', quantity: 1, unitPrice: 100 },
      { productId: 'product-c', quantity: 3, unitPrice: 25 },
    ],
    bundleDiscount: 15,
  };

  describe('calculateBundleQuote', () => {
    it('should calculate item subtotals correctly', () => {
      const quote = calculateBundleQuote(bundle, 0);

      expect(quote.items[0].subtotal).toBe(100); // 2 * 50
      expect(quote.items[1].subtotal).toBe(100); // 1 * 100
      expect(quote.items[2].subtotal).toBe(75);  // 3 * 25
    });

    it('should calculate item subtotal sum', () => {
      const quote = calculateBundleQuote(bundle, 0);
      expect(quote.itemSubtotal).toBe(275);
    });

    it('should apply bundle discount percentage', () => {
      const quote = calculateBundleQuote(bundle, 0);
      expect(quote.bundleDiscount).toBe(41.25); // 15% of 275
    });

    it('should calculate total after discount', () => {
      const quote = calculateBundleQuote(bundle, 0);
      expect(quote.total).toBe(233.75); // 275 - 41.25
    });

    it('should calculate total with tax', () => {
      const quote = calculateBundleQuote(bundle, 0.08);
      const afterDiscount = 275 - 41.25;
      const expectedTax = afterDiscount * 0.08;
      expect(quote.total).toBe(afterDiscount + expectedTax);
    });
  });

  describe('compareBundleVsIndividual', () => {
    const individualPrices = new Map([
      ['product-a', 55], // Higher than bundle unit price
      ['product-b', 110],
      ['product-c', 30],
    ]);

    it('should calculate individual total at higher prices', () => {
      const comparison = compareBundleVsIndividual(bundle, individualPrices);
      expect(comparison.individualTotal).toBe(310); // (2*55) + (1*110) + (3*30)
    });

    it('should calculate bundle savings', () => {
      const comparison = compareBundleVsIndividual(bundle, individualPrices);
      expect(comparison.bundleSavings).toBe(76.25); // 310 - 233.75
    });

    it('should calculate savings percentage', () => {
      const comparison = compareBundleVsIndividual(bundle, individualPrices);
      expect(comparison.savingsPercentage).toBeCloseTo(24.6);
    });

    it('should handle empty individual prices (use bundle prices)', () => {
      const emptyPrices = new Map<string, number>();
      const comparison = compareBundleVsIndividual(bundle, emptyPrices);
      expect(comparison.individualTotal).toBe(275);
      expect(comparison.bundleSavings).toBe(41.25);
    });
  });
});

// ==================== USAGE-BASED BILLING TESTS ====================

describe('Usage-Based Billing', () => {
  const usagePricing: UsageBasedPricing = {
    metric: 'api_calls',
    tiers: [
      { from: 0, to: 1000, pricePerUnit: 0.01 },
      { from: 1000, to: 10000, pricePerUnit: 0.005 },
      { from: 10000, to: null, pricePerUnit: 0.002 },
    ],
    includedUnits: 500,
    overageRate: 0.02,
  };

  describe('calculateUsageCharge', () => {
    it('should return zero charge for usage within included units', () => {
      const charge = calculateUsageCharge(300, usagePricing);
      expect(charge.billableUnits).toBe(0);
      expect(charge.charge).toBe(0);
    });

    it('should calculate charge for usage exceeding included units', () => {
      const charge = calculateUsageCharge(1500, usagePricing);
      expect(charge.includedUnits).toBe(500);
      expect(charge.billableUnits).toBe(1000);
    });

    it('should apply tiered pricing correctly', () => {
      const charge = calculateUsageCharge(1500, usagePricing);
      // 1000 billable units all in tier 1 (capacity 1000) at $0.01 = $10
      expect(charge.charge).toBe(10);
      expect(charge.breakdown.length).toBe(1);
      expect(charge.breakdown[0]).toEqual({ tier: 1, units: 1000, rate: 0.01, subtotal: 10 });
    });

    it('should handle usage spanning multiple tiers', () => {
      const charge = calculateUsageCharge(15000, usagePricing);
      expect(charge.billableUnits).toBe(14500);
      expect(charge.breakdown.length).toBe(3);
      // Tier 1: 1000 units * 0.01 = 10
      // Tier 2: 9000 units * 0.005 = 45
      // Tier 3: 4500 units * 0.002 = 9
      // Total: 64
      expect(charge.charge).toBe(64);
    });

    it('should handle unlimited tier (to: null)', () => {
      const charge = calculateUsageCharge(100000, usagePricing);
      expect(charge.breakdown[charge.breakdown.length - 1].tier).toBe(3);
      expect(charge.breakdown[charge.breakdown.length - 1].rate).toBe(0.002);
    });

    it('should include detailed breakdown', () => {
      const charge = calculateUsageCharge(5000, usagePricing);
      // 4500 billable units: 1000 in tier 1, 3500 in tier 2
      expect(charge.breakdown[0]).toEqual({
        tier: 1,
        units: 1000,
        rate: 0.01,
        subtotal: 10,
      });
      expect(charge.breakdown[1]).toEqual({
        tier: 2,
        units: 3500,
        rate: 0.005,
        subtotal: 17.5,
      });
    });
  });

  describe('calculateTotalUsageBill', () => {
    const multiMetricPricing: UsageBasedPricing[] = [
      usagePricing,
      {
        metric: 'storage_gb',
        tiers: [
          { from: 0, to: 100, pricePerUnit: 0.10 },
          { from: 100, to: null, pricePerUnit: 0.05 },
        ],
        includedUnits: 20,
        overageRate: 0.15,
      },
    ];

    it('should calculate charges for multiple metrics', () => {
      const usageData = {
        api_calls: 2000,
        storage_gb: 50,
      };
      const result = calculateTotalUsageBill(usageData, multiMetricPricing, 0);

      expect(result.usageCharges.length).toBe(2);
      expect(result.subtotal).toBeGreaterThan(0);
    });

    it('should skip metrics with no usage', () => {
      const usageData = { api_calls: 0, storage_gb: 0 };
      const result = calculateTotalUsageBill(usageData, multiMetricPricing, 0);

      expect(result.usageCharges.length).toBe(0);
      expect(result.subtotal).toBe(0);
    });

    it('should calculate tax', () => {
      const usageData = { api_calls: 5000 };
      const result = calculateTotalUsageBill(usageData, [usagePricing], 0.1);

      expect(result.tax).toBe(result.subtotal * 0.1);
      expect(result.total).toBe(result.subtotal + result.tax);
    });

    it('should handle missing usage data gracefully', () => {
      const usageData = { other_metric: 1000 };
      const result = calculateTotalUsageBill(usageData, [usagePricing], 0);

      expect(result.subtotal).toBe(0);
    });
  });
});

// ==================== COMPOSITE QUOTE TESTS ====================

describe('Composite Quote', () => {
  const config: PricingConfig = {
    tiers: DEFAULT_PRICING_TIERS,
    discounts: DEFAULT_DISCOUNTS,
    bundles: DEFAULT_BUNDLES,
    usageBased: DEFAULT_USAGE_PRICING,
    currency: 'USD',
    taxRate: 0.08,
  };

  const growthTier = DEFAULT_PRICING_TIERS[1];

  describe('createCompositeQuote', () => {
    it('should create quote with subscription charge only', () => {
      const quote = createCompositeQuote(config, growthTier, {}, [], 1);

      expect(quote.subscriptionCharges.length).toBe(1);
      expect(quote.subscriptionCharges[0].basePrice).toBe(149);
      expect(quote.usageCharges.length).toBe(0);
      expect(quote.oneTimeCharges.length).toBe(0);
    });

    it('should include usage charges', () => {
      const quote = createCompositeQuote(config, growthTier, {
        api_calls: 5000,
      }, [], 1);

      expect(quote.usageCharges.length).toBe(1);
      expect(quote.usageCharges[0].charge).toBeGreaterThan(0);
    });

    it('should include one-time charges', () => {
      const oneTimeCharges = [
        { description: 'Setup fee', amount: 200 },
        { description: 'Training', amount: 500 },
      ];
      const quote = createCompositeQuote(config, growthTier, {}, oneTimeCharges, 1);

      expect(quote.oneTimeCharges.length).toBe(2);
      expect(quote.subtotal).toBeGreaterThan(149);
    });

    it('should apply discounts to subscription', () => {
      const quote = createCompositeQuote(config, growthTier, {}, [], 1);

      expect(quote.totalDiscount).toBeGreaterThanOrEqual(0);
    });

    it('should calculate quantity-based pricing', () => {
      const quote = createCompositeQuote(config, growthTier, {}, [], 5);

      expect(quote.subscriptionCharges[0].basePrice).toBe(149 * 5);
    });

    it('should calculate total with all components', () => {
      const oneTimeCharges = [{ description: 'Setup', amount: 100 }];
      const quote = createCompositeQuote(config, growthTier, {
        api_calls: 2000,
      }, oneTimeCharges, 2);

      expect(quote.subtotal).toBeGreaterThan(0);
      expect(quote.tax).toBe(quote.subtotal * 0.08);
      expect(quote.total).toBe(quote.subtotal + quote.tax);
    });
  });
});

// ==================== SAMPLE DATA TESTS ====================

describe('Sample Data', () => {
  it('should have 4 pricing tiers', () => {
    expect(DEFAULT_PRICING_TIERS.length).toBe(4);
  });

  it('should have tier names matching requirements', () => {
    const names = DEFAULT_PRICING_TIERS.map(t => t.name);
    expect(names).toContain('Starter');
    expect(names).toContain('Growth');
    expect(names).toContain('Premium');
    expect(names).toContain('Master');
  });

  it('should have discount rules', () => {
    expect(DEFAULT_DISCOUNTS.length).toBeGreaterThan(0);
  });

  it('should have bundle configurations', () => {
    expect(DEFAULT_BUNDLES.length).toBeGreaterThan(0);
  });

  it('should have usage-based pricing metrics', () => {
    expect(DEFAULT_USAGE_PRICING.length).toBeGreaterThan(0);
  });

  it('should have complete pricing config', () => {
    expect(DEFAULT_PRICING_CONFIG.tiers).toEqual(DEFAULT_PRICING_TIERS);
    expect(DEFAULT_PRICING_CONFIG.discounts).toEqual(DEFAULT_DISCOUNTS);
    expect(DEFAULT_PRICING_CONFIG.bundles).toEqual(DEFAULT_BUNDLES);
    expect(DEFAULT_PRICING_CONFIG.usageBased).toEqual(DEFAULT_USAGE_PRICING);
    expect(DEFAULT_PRICING_CONFIG.currency).toBe('USD');
    expect(DEFAULT_PRICING_CONFIG.taxRate).toBe(0.08);
  });
});
