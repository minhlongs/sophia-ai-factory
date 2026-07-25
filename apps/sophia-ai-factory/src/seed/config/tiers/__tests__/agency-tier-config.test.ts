import { AGENCY_TIERS, TIER_CONFIGS, getTierConfig, tierHasFeature, getAllTiers } from '../tier-configs';
import { describe, it, expect } from 'vitest'

describe('Agency Tier Config', () => {
  it('should export AGENCY_TIERS with all required tiers', () => {
    expect(AGENCY_TIERS).toBeDefined();
    expect(AGENCY_TIERS.starter).toBeDefined();
    expect(AGENCY_TIERS.growth).toBeDefined();
    expect(AGENCY_TIERS.enterprise).toBeDefined();
  });

  describe('AGENCY_TIERS.starter', () => {
    const tier = AGENCY_TIERS.starter;
    it('has correct monthlyPrice', () => {
      expect(tier.monthlyPrice).toBe(500);
    });
    it('has maxSubTenants of 5', () => {
      expect(tier.maxSubTenants).toBe(5);
    });
    it('has monthlyCredits of 100', () => {
      expect(tier.monthlyCredits).toBe(100);
    });
  });

  describe('AGENCY_TIERS.growth', () => {
    const tier = AGENCY_TIERS.growth;
    it('has correct monthlyPrice', () => {
      expect(tier.monthlyPrice).toBe(1500);
    });
    it('has maxSubTenants of 20', () => {
      expect(tier.maxSubTenants).toBe(20);
    });
    it('has monthlyCredits of 500', () => {
      expect(tier.monthlyCredits).toBe(500);
    });
  });

  describe('AGENCY_TIERS.enterprise', () => {
    const tier = AGENCY_TIERS.enterprise;
    it('has correct monthlyPrice', () => {
      expect(tier.monthlyPrice).toBe(3000);
    });
    it('has maxSubTenants of Infinity', () => {
      expect(tier.maxSubTenants).toBe(Infinity);
    });
    it('has monthlyCredits of Infinity', () => {
      expect(tier.monthlyCredits).toBe(Infinity);
    });
  });

  it('all tier prices are numbers', () => {
    Object.values(AGENCY_TIERS).forEach((tier) => {
      expect(typeof tier.monthlyPrice).toBe('number');
      expect(tier.monthlyPrice).toBeGreaterThan(0);
    });
  });

  it('all maxSubTenants are positive numbers or Infinity', () => {
    Object.values(AGENCY_TIERS).forEach((tier) => {
      if (tier.maxSubTenants !== Infinity) {
        expect(typeof tier.maxSubTenants).toBe('number');
        expect(tier.maxSubTenants).toBeGreaterThan(0);
      }
    });
  });

  it('all monthlyCredits are positive numbers or Infinity', () => {
    Object.values(AGENCY_TIERS).forEach((tier) => {
      if (tier.monthlyCredits !== Infinity) {
        expect(typeof tier.monthlyCredits).toBe('number');
        expect(tier.monthlyCredits).toBeGreaterThan(0);
      }
    });
  });
});
