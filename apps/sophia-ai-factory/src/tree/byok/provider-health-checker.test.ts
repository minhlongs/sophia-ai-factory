import { describe, it, expect } from 'vitest';
import {
  maskApiKey,
  resolveProviderHealthStatus,
  getProviderStatusBadge,
} from './provider-health-checker';

describe('provider-health-checker', () => {
  describe('maskApiKey', () => {
    it('returns empty string for empty input', () => {
      expect(maskApiKey('')).toBe('');
      expect(maskApiKey('   ')).toBe('');
    });

    it('returns 4 asterisks for short keys (<= 4 chars)', () => {
      expect(maskApiKey('a')).toBe('****');
      expect(maskApiKey('abcd')).toBe('****');
    });

    it('masks keys properly keeping only the last 4 characters', () => {
      expect(maskApiKey('sk-or-v1-abcdef1234')).toBe('****...1234');
      expect(maskApiKey('1234567890')).toBe('****...7890');
    });
  });

  describe('resolveProviderHealthStatus (7 Safe States)', () => {
    it('resolves REVOKED when isRevoked is true', () => {
      expect(resolveProviderHealthStatus({ hasKey: true, isRevoked: true })).toBe('REVOKED');
      expect(resolveProviderHealthStatus({ hasKey: false, isRevoked: true })).toBe('REVOKED');
    });

    it('resolves NOT_CONFIGURED when hasKey is false and not revoked', () => {
      expect(resolveProviderHealthStatus({ hasKey: false })).toBe('NOT_CONFIGURED');
    });

    it('resolves VALIDATING when isValidating is true', () => {
      expect(resolveProviderHealthStatus({ hasKey: true, isValidating: true })).toBe('VALIDATING');
    });

    it('resolves ACTIVE when probeSuccess is true', () => {
      expect(resolveProviderHealthStatus({ hasKey: true, probeSuccess: true })).toBe('ACTIVE');
    });

    it('resolves PROVIDER_UNAVAILABLE when isTimeout is true or httpStatus >= 500', () => {
      expect(resolveProviderHealthStatus({ hasKey: true, isTimeout: true })).toBe('PROVIDER_UNAVAILABLE');
      expect(resolveProviderHealthStatus({ hasKey: true, httpStatus: 500 })).toBe('PROVIDER_UNAVAILABLE');
      expect(resolveProviderHealthStatus({ hasKey: true, httpStatus: 504 })).toBe('PROVIDER_UNAVAILABLE');
    });

    it('resolves INVALID for 401, 403, 422 or probeSuccess false', () => {
      expect(resolveProviderHealthStatus({ hasKey: true, httpStatus: 401 })).toBe('INVALID');
      expect(resolveProviderHealthStatus({ hasKey: true, httpStatus: 403 })).toBe('INVALID');
      expect(resolveProviderHealthStatus({ hasKey: true, httpStatus: 422 })).toBe('INVALID');
      expect(resolveProviderHealthStatus({ hasKey: true, probeSuccess: false })).toBe('INVALID');
    });

    it('resolves UNKNOWN for unhandled parameter state', () => {
      expect(resolveProviderHealthStatus({ hasKey: true })).toBe('UNKNOWN');
    });
  });

  describe('getProviderStatusBadge', () => {
    it('returns Vietnamese badges by default or when specified', () => {
      const activeBadgeVi = getProviderStatusBadge('ACTIVE', 'vi');
      expect(activeBadgeVi.label).toBe('Đang hoạt động');
      expect(activeBadgeVi.color).toBe('green');

      const notConfiguredVi = getProviderStatusBadge('NOT_CONFIGURED');
      expect(notConfiguredVi.label).toBe('Chưa cấu hình');
    });

    it('returns English badges when locale is en', () => {
      const activeBadgeEn = getProviderStatusBadge('ACTIVE', 'en');
      expect(activeBadgeEn.label).toBe('Active & Connected');
      expect(activeBadgeEn.color).toBe('green');

      const invalidEn = getProviderStatusBadge('INVALID', 'en');
      expect(invalidEn.label).toBe('Invalid Key');
      expect(invalidEn.color).toBe('red');
    });
  });
});
