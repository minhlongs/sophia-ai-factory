/**
 * Tests for RaaS Authentication Middleware
 *
 * @module worker/middleware/raas-auth-middleware.test
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  extractApiKey,
  extractJwt,
  checkFeatureAccess,
  type AuthContext,
} from './raas-auth-middleware';
import {
  getRequiredFeature,
  validateFeatureAccess,
  getDefaultFeaturesForTier,
  isTierEligibleForOverage,
  ENDPOINT_FEATURE_MAP,
} from './feature-entitlement';
import {
  isSubscriptionActive,
  isTierEligibleForOverage as polarIsTierEligibleForOverage,
  checkSubscriptionAccess,
  getDaysUntilRenewal,
  isSubscriptionExpiringSoon,
  type PolarSubscription,
} from './polar-subscription';

describe('RaaS Auth Middleware', () => {
  describe('extractApiKey', () => {
    it('should extract API key from x-api-key header', () => {
      const request = new Request('https://example.com/api/test', {
        headers: {
          'x-api-key': 'mk_abc123_def456',
        },
      });

      const result = extractApiKey(request);
      expect(result).toBe('mk_abc123_def456');
    });

    it('should return null when x-api-key header is missing', () => {
      const request = new Request('https://example.com/api/test');

      const result = extractApiKey(request);
      expect(result).toBeNull();
    });
  });

  describe('extractJwt', () => {
    it('should extract JWT from Authorization header with Bearer prefix', () => {
      const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8U';
      const request = new Request('https://example.com/api/test', {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      const result = extractJwt(request);
      expect(result).toBe(token);
    });

    it('should return null when Authorization header is missing', () => {
      const request = new Request('https://example.com/api/test');

      const result = extractJwt(request);
      expect(result).toBeNull();
    });

    it('should return null when Authorization header does not have Bearer prefix', () => {
      const request = new Request('https://example.com/api/test', {
        headers: {
          'Authorization': 'Basic dXNlcjpwYXNz',
        },
      });

      const result = extractJwt(request);
      expect(result).toBeNull();
    });
  });

  describe('checkFeatureAccess', () => {
    const createAuthContext = (overrides?: Partial<AuthContext>): AuthContext => ({
      userId: 'user-123',
      licenseNonce: 'license-abc',
      tier: 'PREMIUM',
      featureEntitlements: ['heygen.createVideo', 'elevenlabs.synthesize', 'openrouter.chat'],
      agencyId: 'agency-xyz',
      ...overrides,
    });

    it('should allow access when feature is in entitlements', async () => {
      const context = createAuthContext();
      const result = await checkFeatureAccess('heygen.createVideo', context);

      expect(result.allowed).toBe(true);
      expect(result.featureKey).toBe('heygen.createVideo');
    });

    it('should deny access when feature is not in entitlements', async () => {
      const context = createAuthContext();
      const result = await checkFeatureAccess('admin.dashboard', context);

      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('not_entitled');
      expect(result.featureKey).toBe('admin.dashboard');
    });

    it('should deny access when subscription is canceled', async () => {
      const context = createAuthContext({
        polarSubscriptionStatus: 'canceled',
      });
      const result = await checkFeatureAccess('heygen.createVideo', context);

      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('subscription_expired');
    });

    it('should deny access when subscription is inactive', async () => {
      const context = createAuthContext({
        polarSubscriptionStatus: 'inactive',
      });
      const result = await checkFeatureAccess('heygen.createVideo', context);

      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('subscription_expired');
    });
  });
});

describe('Feature Entitlement', () => {
  describe('getRequiredFeature', () => {
    it('should return feature for exact path match', () => {
      const feature = getRequiredFeature('/api/heygen/create');
      expect(feature).toBe('heygen.createVideo');
    });

    it('should return feature for wildcard path match', () => {
      const feature = getRequiredFeature('/api/admin/users');
      expect(feature).toBe('admin.dashboard');
    });

    it('should return null for public endpoints', () => {
      const feature = getRequiredFeature('/api/public/health');
      expect(feature).toBeNull();
    });

    it('should handle query parameters', () => {
      const feature = getRequiredFeature('/api/heygen/create?param=value');
      expect(feature).toBe('heygen.createVideo');
    });
  });

  describe('validateFeatureAccess', () => {
    it('should return true when feature is in entitlements', () => {
      const entitlements = ['heygen.createVideo', 'elevenlabs.synthesize'];
      const result = validateFeatureAccess('heygen.createVideo', entitlements);
      expect(result).toBe(true);
    });

    it('should return false when feature is not in entitlements', () => {
      const entitlements = ['heygen.createVideo'];
      const result = validateFeatureAccess('admin.dashboard', entitlements);
      expect(result).toBe(false);
    });

    it('should return true when no feature is required', () => {
      const entitlements = ['heygen.createVideo'];
      const result = validateFeatureAccess('', entitlements);
      expect(result).toBe(true);
    });

    it('should return false when entitlements is empty', () => {
      const result = validateFeatureAccess('heygen.createVideo', []);
      expect(result).toBe(false);
    });
  });

  describe('getDefaultFeaturesForTier', () => {
    it('should return BASIC features for BASIC tier', () => {
      const features = getDefaultFeaturesForTier('BASIC');
      expect(features).toContain('heygen.createVideo');
      expect(features).not.toContain('admin.dashboard');
    });

    it('should return PREMIUM features for PREMIUM tier', () => {
      const features = getDefaultFeaturesForTier('PREMIUM');
      expect(features).toContain('heygen.createVideo');
      expect(features).toContain('affiliate.engine');
      expect(features).toContain('analytics.basic');
    });

    it('should return ENTERPRISE features for ENTERPRISE tier', () => {
      const features = getDefaultFeaturesForTier('ENTERPRISE');
      expect(features).toContain('api.integrations');
      expect(features).toContain('admin.dashboard');
      expect(features).toContain('analytics.advanced');
    });

    it('should return MASTER features for MASTER tier', () => {
      const features = getDefaultFeaturesForTier('MASTER');
      expect(features).toContain('white.label');
      expect(features).toContain('priority.support');
    });
  });

  describe('isTierEligibleForOverage', () => {
    it('should return false for BASIC tier', () => {
      expect(isTierEligibleForOverage('BASIC')).toBe(false);
    });

    it('should return false for PREMIUM tier', () => {
      expect(isTierEligibleForOverage('PREMIUM')).toBe(false);
    });

    it('should return true for ENTERPRISE tier', () => {
      expect(isTierEligibleForOverage('ENTERPRISE')).toBe(true);
    });

    it('should return true for MASTER tier', () => {
      expect(isTierEligibleForOverage('MASTER')).toBe(true);
    });
  });

  describe('ENDPOINT_FEATURE_MAP', () => {
    it('should have mappings for HeyGen endpoints', () => {
      expect(ENDPOINT_FEATURE_MAP['/api/heygen/create']).toBe('heygen.createVideo');
      expect(ENDPOINT_FEATURE_MAP['/api/heygen/status']).toBe('heygen.getVideoStatus');
    });

    it('should have mappings for ElevenLabs endpoints', () => {
      expect(ENDPOINT_FEATURE_MAP['/api/elevenlabs/synthesize']).toBe('elevenlabs.synthesize');
      expect(ENDPOINT_FEATURE_MAP['/api/elevenlabs/status']).toBe('elevenlabs.getAudioStatus');
    });

    it('should have mappings for OpenRouter endpoints', () => {
      expect(ENDPOINT_FEATURE_MAP['/api/openrouter/chat']).toBe('openrouter.chat');
      expect(ENDPOINT_FEATURE_MAP['/api/openrouter/complete']).toBe('openrouter.complete');
    });
  });
});

describe('Polar Subscription', () => {
  describe('isSubscriptionActive', () => {
    it('should return true for active subscription', () => {
      expect(isSubscriptionActive('active')).toBe(true);
    });

    it('should return true for past_due subscription', () => {
      expect(isSubscriptionActive('past_due')).toBe(true);
    });

    it('should return false for inactive subscription', () => {
      expect(isSubscriptionActive('inactive')).toBe(false);
    });

    it('should return false for canceled subscription', () => {
      expect(isSubscriptionActive('canceled')).toBe(false);
    });
  });

  describe('isTierEligibleForOverage (Polar)', () => {
    it('should return false for starter tier', () => {
      expect(polarIsTierEligibleForOverage('starter')).toBe(false);
    });

    it('should return false for growth tier', () => {
      expect(polarIsTierEligibleForOverage('growth')).toBe(false);
    });

    it('should return true for premium tier', () => {
      expect(polarIsTierEligibleForOverage('premium')).toBe(true);
    });

    it('should return true for master tier', () => {
      expect(polarIsTierEligibleForOverage('master')).toBe(true);
    });
  });

  describe('checkSubscriptionAccess', () => {
    it('should deny access when no subscription', () => {
      const result = checkSubscriptionAccess(null);
      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('no_subscription');
    });

    it('should allow access for active subscription', () => {
      const subscription: PolarSubscription = {
        customer_id: 'cus_123',
        subscription_id: 'sub_456',
        status: 'active',
        tier: 'premium',
        features: ['heygen.createVideo'],
      };
      const result = checkSubscriptionAccess(subscription);
      expect(result.allowed).toBe(true);
      expect(result.tier).toBe('premium');
    });

    it('should deny access for canceled subscription', () => {
      const subscription: PolarSubscription = {
        customer_id: 'cus_123',
        subscription_id: 'sub_456',
        status: 'canceled',
        tier: 'premium',
        features: ['heygen.createVideo'],
      };
      const result = checkSubscriptionAccess(subscription);
      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('canceled');
    });

    it('should allow access for past_due subscription with reason', () => {
      const subscription: PolarSubscription = {
        customer_id: 'cus_123',
        subscription_id: 'sub_456',
        status: 'past_due',
        tier: 'premium',
        features: ['heygen.createVideo'],
      };
      const result = checkSubscriptionAccess(subscription);
      expect(result.allowed).toBe(true);
      expect(result.reason).toBe('past_due');
    });
  });

  describe('getDaysUntilRenewal', () => {
    it('should calculate days until renewal', () => {
      const now = Date.now();
      const sevenDaysFromNow = Math.floor((now + 7 * 24 * 60 * 60 * 1000) / 1000);

      const subscription: PolarSubscription = {
        customer_id: 'cus_123',
        subscription_id: 'sub_456',
        status: 'active',
        tier: 'premium',
        features: [],
        current_period_end: sevenDaysFromNow,
      };

      const days = getDaysUntilRenewal(subscription);
      // Allow 1 day tolerance for execution time
      expect(days).toBeGreaterThanOrEqual(6);
      expect(days).toBeLessThanOrEqual(7);
    });

    it('should return 0 when already expired', () => {
      const yesterday = Math.floor((Date.now() - 24 * 60 * 60 * 1000) / 1000);

      const subscription: PolarSubscription = {
        customer_id: 'cus_123',
        subscription_id: 'sub_456',
        status: 'active',
        tier: 'premium',
        features: [],
        current_period_end: yesterday,
      };

      const days = getDaysUntilRenewal(subscription);
      expect(days).toBe(0);
    });

    it('should return null when current_period_end is not set', () => {
      const subscription: PolarSubscription = {
        customer_id: 'cus_123',
        subscription_id: 'sub_456',
        status: 'active',
        tier: 'premium',
        features: [],
      };

      const days = getDaysUntilRenewal(subscription);
      expect(days).toBeNull();
    });
  });

  describe('isSubscriptionExpiringSoon', () => {
    it('should return true when expiring within threshold', () => {
      const now = Date.now();
      const fiveDaysFromNow = Math.floor((now + 5 * 24 * 60 * 60 * 1000) / 1000);

      const subscription: PolarSubscription = {
        customer_id: 'cus_123',
        subscription_id: 'sub_456',
        status: 'active',
        tier: 'premium',
        features: [],
        current_period_end: fiveDaysFromNow,
      };

      const result = isSubscriptionExpiringSoon(subscription, 7);
      expect(result).toBe(true);
    });

    it('should return false when not expiring soon', () => {
      const now = Date.now();
      const thirtyDaysFromNow = Math.floor((now + 30 * 24 * 60 * 60 * 1000) / 1000);

      const subscription: PolarSubscription = {
        customer_id: 'cus_123',
        subscription_id: 'sub_456',
        status: 'active',
        tier: 'premium',
        features: [],
        current_period_end: thirtyDaysFromNow,
      };

      const result = isSubscriptionExpiringSoon(subscription, 7);
      expect(result).toBe(false);
    });
  });
});
