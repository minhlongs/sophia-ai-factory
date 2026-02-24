import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getFeatureFlag, getAllFeatureFlags, getFeatureFlagDescription, FEATURE_FLAGS } from './flags';

describe('flags', () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
  });

  describe('FEATURE_FLAGS config', () => {
    it('defines 6 feature flags', () => {
      expect(Object.keys(FEATURE_FLAGS)).toHaveLength(6);
    });

    it('each flag has name, description, defaultEnabled, requiredTier', () => {
      for (const flag of Object.values(FEATURE_FLAGS)) {
        expect(flag).toHaveProperty('name');
        expect(flag).toHaveProperty('description');
        expect(typeof flag.defaultEnabled).toBe('boolean');
        expect(flag).toHaveProperty('requiredTier');
      }
    });

    it('enable_auto_update is disabled by default', () => {
      expect(FEATURE_FLAGS.enable_auto_update.defaultEnabled).toBe(false);
    });
  });

  describe('getFeatureFlag', () => {
    it('returns default value when no env override', () => {
      expect(getFeatureFlag('enable_affiliate_engine')).toBe(true);
      expect(getFeatureFlag('enable_auto_update')).toBe(false);
    });

    it('env override with "true" enables flag', () => {
      vi.stubEnv('NEXT_PUBLIC_FEATURE_AUTO_UPDATE', 'true');
      expect(getFeatureFlag('enable_auto_update')).toBe(true);
    });

    it('env override with "1" enables flag', () => {
      vi.stubEnv('NEXT_PUBLIC_FEATURE_AUTO_UPDATE', '1');
      expect(getFeatureFlag('enable_auto_update')).toBe(true);
    });

    it('env override with "false" disables flag', () => {
      vi.stubEnv('NEXT_PUBLIC_FEATURE_AFFILIATE_ENGINE', 'false');
      expect(getFeatureFlag('enable_affiliate_engine')).toBe(false);
    });

    it('env override with "0" disables flag', () => {
      vi.stubEnv('NEXT_PUBLIC_FEATURE_AFFILIATE_ENGINE', '0');
      expect(getFeatureFlag('enable_affiliate_engine')).toBe(false);
    });
  });

  describe('getAllFeatureFlags', () => {
    it('returns all 6 flags with boolean values', () => {
      const flags = getAllFeatureFlags();
      expect(Object.keys(flags)).toHaveLength(6);
      for (const val of Object.values(flags)) {
        expect(typeof val).toBe('boolean');
      }
    });

    it('reflects env overrides', () => {
      vi.stubEnv('NEXT_PUBLIC_FEATURE_AUTO_UPDATE', 'true');
      const flags = getAllFeatureFlags();
      expect(flags.enable_auto_update).toBe(true);
    });
  });

  describe('getFeatureFlagDescription', () => {
    it('returns description for known flags', () => {
      const desc = getFeatureFlagDescription('enable_affiliate_engine');
      expect(desc).toContain('affiliate');
    });

    it('returns description for admin dashboard', () => {
      const desc = getFeatureFlagDescription('enable_admin_dashboard');
      expect(desc).toContain('admin');
    });
  });
});
