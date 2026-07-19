import { describe, it, expect } from 'vitest';
import { ONBOARDING_TIERS, createOnboardingVideo } from '../onboarding-video';

describe('OnboardingVideo', () => {
  describe('ONBOARDING_TIERS', () => {
    it('includes ENTERPRISE', () => {
      expect(ONBOARDING_TIERS.has('ENTERPRISE')).toBe(true);
    });

    it('includes MASTER', () => {
      expect(ONBOARDING_TIERS.has('MASTER')).toBe(true);
    });

    it('excludes BASIC', () => {
      expect(ONBOARDING_TIERS.has('BASIC')).toBe(false);
    });

    it('excludes PREMIUM', () => {
      expect(ONBOARDING_TIERS.has('PREMIUM')).toBe(false);
    });
  });

  describe('createOnboardingVideo', () => {
    it('returns failure when no HEYGEN_API_KEY', async () => {
      const prev = process.env.HEYGEN_API_KEY;
      delete (process.env as Record<string, string | undefined>).HEYGEN_API_KEY;
      const result = await createOnboardingVideo({
        userId: 'test-user',
        tier: 'ENTERPRISE',
        paymentId: 'pay-test-1',
        userEmail: 'test@example.com',
      });
      process.env.HEYGEN_API_KEY = prev;
      expect(result.success).toBe(false);
      expect(result.error).toContain('HEYGEN_API_KEY');
    });

    it('returns failure for invalid tier (falls back to ENTERPRISE script)', async () => {
      const prev = process.env.HEYGEN_API_KEY;
      delete (process.env as Record<string, string | undefined>).HEYGEN_API_KEY;
      const result = await createOnboardingVideo({
        userId: 'test-user',
        tier: 'INVALID_TIER',
        paymentId: 'pay-test-2',
        userEmail: 'test@example.com',
      });
      process.env.HEYGEN_API_KEY = prev;
      expect(result.success).toBe(false);
    });

    it('normalizes tier to ENTERPRISE for Enterprise', () => {
      expect(ONBOARDING_TIERS.has('ENTERPRISE')).toBe(true);
    });

    it('normalizes tier to MASTER for Master', () => {
      expect(ONBOARDING_TIERS.has('MASTER')).toBe(true);
    });
  });
});
