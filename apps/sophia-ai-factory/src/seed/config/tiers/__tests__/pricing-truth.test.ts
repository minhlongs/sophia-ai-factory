/**
 * Invariant tests for pricing truth across Sophia AI Factory.
 * Verifies that UNIFIED_TIERS is the single source of truth and all consumers
 * (TIER_CONFIGS, NOWPayments, PayOS, Admin MRR, etc.) derive from it identically.
 */

import { describe, it, expect } from 'vitest';
import { UNIFIED_TIERS } from '@/seed/config/tiers/unified-limits';
import { TIER_CONFIGS } from '@/seed/config/tiers/tier-configs';
import { TIER_PRICE_CONFIG } from '@/tree/clients/nowpayments-client';
import { getPayOsTierConfig } from '@/land/payments/payos';
import { calculateMRR } from '@/app/api/admin/billing/summary/billing-summary-query';
import type { Tier } from '@/seed/types';

describe('Pricing Truth & Single Source of Truth', () => {
  const TIERS: Tier[] = ['BASIC', 'PREMIUM', 'ENTERPRISE', 'MASTER'];

  it('verifies UNIFIED_TIERS defines canonical prices for all 4 tiers', () => {
    expect(UNIFIED_TIERS.BASIC.price).toBe(199);
    expect(UNIFIED_TIERS.BASIC.priceInCents).toBe(19900);

    expect(UNIFIED_TIERS.PREMIUM.price).toBe(399);
    expect(UNIFIED_TIERS.PREMIUM.priceInCents).toBe(39900);

    expect(UNIFIED_TIERS.ENTERPRISE.price).toBe(799);
    expect(UNIFIED_TIERS.ENTERPRISE.priceInCents).toBe(79900);

    expect(UNIFIED_TIERS.MASTER.price).toBe(4999);
    expect(UNIFIED_TIERS.MASTER.priceInCents).toBe(499900);
  });

  it('verifies priceInCents is strictly price * 100 across all tiers', () => {
    for (const tier of TIERS) {
      expect(UNIFIED_TIERS[tier].priceInCents).toBe(UNIFIED_TIERS[tier].price * 100);
    }
  });

  it('verifies TIER_CONFIGS prices exactly match UNIFIED_TIERS', () => {
    for (const tier of TIERS) {
      expect(TIER_CONFIGS[tier].price).toBe(UNIFIED_TIERS[tier].price);
      expect(TIER_CONFIGS[tier].name).toBe(UNIFIED_TIERS[tier].name);
      expect(TIER_CONFIGS[tier].limits.youtubeChannels).toBe(UNIFIED_TIERS[tier].youtubeChannels);
      expect(TIER_CONFIGS[tier].limits.videoTemplates).toBe(UNIFIED_TIERS[tier].templates);
    }
  });

  it('verifies NOWPayments TIER_PRICE_CONFIG exactly matches UNIFIED_TIERS', () => {
    for (const tier of TIERS) {
      const nowConfig = TIER_PRICE_CONFIG[tier];
      expect(nowConfig).toBeDefined();
      expect(nowConfig.price).toBe(UNIFIED_TIERS[tier].price);
      expect(nowConfig.yearlyPrice).toBe(UNIFIED_TIERS[tier].yearlyPrice);
      expect(nowConfig.name).toBe(UNIFIED_TIERS[tier].name);
      expect(nowConfig.currency).toBe('USD');
    }
  });

  it('verifies PayOS USD tier prices derive from UNIFIED_TIERS', () => {
    process.env.USD_TO_VND = '25000';
    try {
      for (const tier of TIERS) {
        const payosConfig = getPayOsTierConfig(tier);
        expect(payosConfig.usdAmount).toBe(UNIFIED_TIERS[tier].price);
        expect(payosConfig.vndAmount).toBe(
          Math.round((UNIFIED_TIERS[tier].price * 25000) / 1000) * 1000
        );
      }
    } finally {
      delete process.env.USD_TO_VND;
    }
  });

  it('verifies Admin MRR calculation uses canonical prices in cents', () => {
    // 4 customers distributed across 4 tiers (BASIC, PREMIUM, ENTERPRISE, MASTER)
    const dunningCustomers = [
      { stripe_customer_id: 'cus_1', dunning_state: 'current' },
      { stripe_customer_id: 'cus_2', dunning_state: 'current' },
      { stripe_customer_id: 'cus_3', dunning_state: 'current' },
      { stripe_customer_id: 'cus_4', dunning_state: 'current' },
    ];

    const result = calculateMRR(dunningCustomers);
    const expectedTotalCents =
      UNIFIED_TIERS.BASIC.priceInCents +
      UNIFIED_TIERS.PREMIUM.priceInCents +
      UNIFIED_TIERS.ENTERPRISE.priceInCents +
      UNIFIED_TIERS.MASTER.priceInCents;

    expect(result.totalCents).toBe(expectedTotalCents);
    expect(result.totalCents).toBe(19900 + 39900 + 79900 + 499900);
    expect(result.breakdown).toEqual({
      BASIC: 1,
      PREMIUM: 1,
      ENTERPRISE: 1,
      MASTER: 1,
    });
  });
});
