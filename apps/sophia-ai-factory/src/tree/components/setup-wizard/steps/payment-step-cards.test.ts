import { describe, expect, it } from 'vitest';
import { UNIFIED_TIERS } from '@/seed/config/tiers';
import type { Tier } from '@/seed/types';
import { TIER_DETAILS } from './payment-step-cards';

const TIERS: Tier[] = ['BASIC', 'PREMIUM', 'ENTERPRISE', 'MASTER'];

describe('setup wizard payment cards', () => {
  it('uses the canonical tier prices, monthly MCU allowances, and billing types', () => {
    for (const tier of TIERS) {
      expect(TIER_DETAILS[tier]).toEqual({
        name: UNIFIED_TIERS[tier].name,
        price: UNIFIED_TIERS[tier].price,
        mcuMonthly: UNIFIED_TIERS[tier].mcuMonthly,
        billingType: UNIFIED_TIERS[tier].billingType,
      });
    }

    expect(TIER_DETAILS.MASTER.price).toBe(4999);
    expect(TIER_DETAILS.MASTER.billingType).toBe('lifetime');
  });
});
