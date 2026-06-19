import { describe, it, expect } from 'vitest';
import { ONBOARDING_TIERS } from '@/land/video/templates/onboarding-video';

describe('nowpayments-ipn-subscription — onboarding trigger', () => {
  describe('ONBOARDING_TIERS eligibility', () => {
    it('ENTERPRISE is eligible for onboarding video', () => {
      expect(ONBOARDING_TIERS.has('ENTERPRISE')).toBe(true);
    });

    it('MASTER is eligible for onboarding video', () => {
      expect(ONBOARDING_TIERS.has('MASTER')).toBe(true);
    });

    it('BASIC is NOT eligible', () => {
      expect(ONBOARDING_TIERS.has('BASIC')).toBe(false);
    });

    it('PREMIUM is NOT eligible', () => {
      expect(ONBOARDING_TIERS.has('PREMIUM')).toBe(false);
    });
  });

  describe('ONBOARDING_TIERS set size', () => {
    it('has exactly 2 tiers', () => {
      expect(ONBOARDING_TIERS.size).toBe(2);
    });
  });
});
