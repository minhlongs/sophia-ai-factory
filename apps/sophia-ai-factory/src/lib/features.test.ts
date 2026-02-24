import { describe, it, expect, vi, beforeEach } from 'vitest';
import { checkTierAccess, hasTierAccess, getAccessibleFeatures } from './features';

vi.mock('@/config/flags', () => ({
  getFeatureFlag: vi.fn((flag: string) => {
    if (flag === 'enable_auto_update') return false;
    return true;
  }),
}));

vi.mock('@/config/tiers', () => ({
  tierHasFeature: vi.fn((tier: string, feature: string) => {
    const tierFeatures: Record<string, string[]> = {
      BASIC: ['enable_affiliate_engine', 'enable_roi_calculator'],
      PREMIUM: ['enable_affiliate_engine', 'enable_roi_calculator'],
      ENTERPRISE: ['enable_affiliate_engine', 'enable_admin_dashboard', 'enable_roi_calculator', 'enable_api_integrations', 'enable_auto_update'],
      MASTER: ['enable_affiliate_engine', 'enable_admin_dashboard', 'enable_roi_calculator', 'enable_api_integrations', 'enable_auto_update', 'enable_early_access'],
    };
    return tierFeatures[tier]?.includes(feature) ?? false;
  }),
}));

describe('features', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('checkTierAccess', () => {
    it('grants access when tier has feature and flag enabled', () => {
      const result = checkTierAccess('BASIC', 'enable_affiliate_engine');
      expect(result.hasAccess).toBe(true);
    });

    it('denies access when feature flag disabled globally', () => {
      const result = checkTierAccess('ENTERPRISE', 'enable_auto_update');
      expect(result.hasAccess).toBe(false);
      expect(result.reason).toBe('Feature is currently disabled');
    });

    it('denies access when tier lacks feature', () => {
      const result = checkTierAccess('BASIC', 'enable_admin_dashboard');
      expect(result.hasAccess).toBe(false);
      expect(result.reason).toContain('requires');
      expect(result.requiredTier).toBe('ENTERPRISE');
    });

    it('returns correct requiredTier for premium features', () => {
      const result = checkTierAccess('BASIC', 'enable_roi_calculator');
      expect(result.hasAccess).toBe(true);
    });

    it('returns correct requiredTier for api_integrations', () => {
      const result = checkTierAccess('BASIC', 'enable_api_integrations');
      expect(result.hasAccess).toBe(false);
      expect(result.requiredTier).toBe('ENTERPRISE');
    });
  });

  describe('hasTierAccess', () => {
    it('returns true for accessible features', () => {
      expect(hasTierAccess('ENTERPRISE', 'enable_admin_dashboard')).toBe(true);
    });

    it('returns false for inaccessible features', () => {
      expect(hasTierAccess('BASIC', 'enable_admin_dashboard')).toBe(false);
    });
  });

  describe('getAccessibleFeatures', () => {
    it('returns correct features for BASIC tier', () => {
      const features = getAccessibleFeatures('BASIC');
      expect(features).toContain('enable_affiliate_engine');
      expect(features).toContain('enable_roi_calculator');
      expect(features).not.toContain('enable_admin_dashboard');
    });

    it('returns more features for ENTERPRISE tier', () => {
      const features = getAccessibleFeatures('ENTERPRISE');
      expect(features).toContain('enable_admin_dashboard');
      expect(features).toContain('enable_api_integrations');
    });
  });
});
