import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AuthorizationError, verifyTierAccess, withTierGate, withTierGateAsync } from './tier-gate';

vi.mock('@/lib/features', () => ({
  checkTierAccess: vi.fn((tier: string, feature: string) => {
    const accessMap: Record<string, string[]> = {
      BASIC: ['enable_affiliate_engine', 'enable_roi_calculator'],
      ENTERPRISE: ['enable_affiliate_engine', 'enable_admin_dashboard', 'enable_roi_calculator', 'enable_api_integrations'],
    };
    const hasAccess = accessMap[tier]?.includes(feature) ?? false;
    if (hasAccess) return { hasAccess: true };
    return { hasAccess: false, reason: `Requires higher tier`, requiredTier: 'ENTERPRISE' };
  }),
}));

describe('tier-gate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('AuthorizationError', () => {
    it('creates error with message and requiredTier', () => {
      const err = new AuthorizationError('Access denied', 'ENTERPRISE');
      expect(err.message).toBe('Access denied');
      expect(err.name).toBe('AuthorizationError');
      expect(err.requiredTier).toBe('ENTERPRISE');
      expect(err).toBeInstanceOf(Error);
    });

    it('creates error without requiredTier', () => {
      const err = new AuthorizationError('Forbidden');
      expect(err.requiredTier).toBeUndefined();
    });
  });

  describe('verifyTierAccess', () => {
    it('does not throw when tier has access', () => {
      expect(() => verifyTierAccess('BASIC', 'enable_affiliate_engine')).not.toThrow();
    });

    it('throws AuthorizationError when tier lacks access', () => {
      expect(() => verifyTierAccess('BASIC', 'enable_admin_dashboard')).toThrow(AuthorizationError);
    });

    it('includes requiredTier in thrown error', () => {
      try {
        verifyTierAccess('BASIC', 'enable_admin_dashboard');
      } catch (e) {
        expect(e).toBeInstanceOf(AuthorizationError);
        expect((e as AuthorizationError).requiredTier).toBe('ENTERPRISE');
      }
    });
  });

  describe('withTierGate', () => {
    it('executes function when authorized', () => {
      const fn = vi.fn(() => 42);
      const result = withTierGate(fn, 'ENTERPRISE', 'enable_admin_dashboard');
      expect(result).toBe(42);
      expect(fn).toHaveBeenCalledOnce();
    });

    it('throws without executing when unauthorized', () => {
      const fn = vi.fn(() => 42);
      expect(() => withTierGate(fn, 'BASIC', 'enable_admin_dashboard')).toThrow(AuthorizationError);
      expect(fn).not.toHaveBeenCalled();
    });
  });

  describe('withTierGateAsync', () => {
    it('executes async function when authorized', async () => {
      const fn = vi.fn(async () => 'ok');
      const result = await withTierGateAsync(fn, 'ENTERPRISE', 'enable_admin_dashboard');
      expect(result).toBe('ok');
      expect(fn).toHaveBeenCalledOnce();
    });

    it('throws without executing when unauthorized', async () => {
      const fn = vi.fn(async () => 'ok');
      await expect(withTierGateAsync(fn, 'BASIC', 'enable_admin_dashboard')).rejects.toThrow(AuthorizationError);
      expect(fn).not.toHaveBeenCalled();
    });
  });
});
