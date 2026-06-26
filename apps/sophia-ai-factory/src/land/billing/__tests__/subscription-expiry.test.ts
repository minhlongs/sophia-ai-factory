/**
 * Unit tests for subscription-expiry utility
 * @module land/billing/__tests__/subscription-expiry.test
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { calculateExpiryDate, isSubscriptionExpired, daysUntilExpiry } from '../subscription-expiry';

describe('SubscriptionExpiry', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const mockBaseDate = new Date('2025-01-15T12:00:00Z');

  describe('calculateExpiryDate', () => {
    it('should calculate expiry date for monthly billing cycle (30 days)', () => {
      const result = calculateExpiryDate(mockBaseDate, 'monthly');
      const expected = new Date(mockBaseDate);
      expected.setDate(expected.getDate() + 30);
      expect(result.getTime()).toBe(expected.getTime());
    });

    it('should calculate expiry date for yearly billing cycle (365 days)', () => {
      const result = calculateExpiryDate(mockBaseDate, 'yearly');
      const expected = new Date(mockBaseDate);
      expected.setDate(expected.getDate() + 365);
      expect(result.getTime()).toBe(expected.getTime());
    });

    it('should calculate expiry date for quarterly billing cycle (90 days)', () => {
      const result = calculateExpiryDate(mockBaseDate, 'quarterly');
      const expected = new Date(mockBaseDate);
      expected.setDate(expected.getDate() + 90);
      expect(result.getTime()).toBe(expected.getTime());
    });

    it('should throw error for unknown billing cycle', () => {
      expect(() => calculateExpiryDate(mockBaseDate, 'unknown' as any)).toThrow('Unknown billing cycle: unknown');
    });

    it('should handle edge case: leap year (Feb 15 + 30 = Mar 16)', () => {
      const leapDate = new Date('2024-02-15T12:00:00Z');
      const result = calculateExpiryDate(leapDate, 'monthly');
      const expected = new Date(leapDate);
      expected.setDate(expected.getDate() + 30);
      expect(result.getTime()).toBe(expected.getTime());
      expect(result.getMonth()).toBe(2); // March
      expect(result.getDate()).toBe(16);
    });
  });

  describe('isSubscriptionExpired', () => {
    it('should return true when expiry date is in the past', () => {
      const pastDate = new Date('2024-12-01T12:00:00Z');
      const now = new Date('2025-01-15T12:00:00Z');
      vi.setSystemTime(now);
      expect(isSubscriptionExpired(pastDate)).toBe(true);
    });

    it('should return false when expiry date is in the future', () => {
      const futureDate = new Date('2025-12-01T12:00:00Z');
      const now = new Date('2025-01-15T12:00:00Z');
      vi.setSystemTime(now);
      expect(isSubscriptionExpired(futureDate)).toBe(false);
    });

    it('should return false when expiry date is exactly now', () => {
      const now = new Date('2025-01-15T12:00:00Z');
      vi.setSystemTime(now);
      expect(isSubscriptionExpired(now)).toBe(false);
    });
  });

  describe('daysUntilExpiry', () => {
    it('should return positive days when subscription is active', () => {
      const now = new Date('2025-01-15T12:00:00Z');
      vi.useFakeTimers({ now });
      const futureDate = new Date(now.getTime() + 10 * 24 * 60 * 60 * 1000); // +10 days
      const result = daysUntilExpiry(futureDate);
      expect(result).toBe(10);
    });

    it('should return 0 when expiry is today', () => {
      const now = new Date('2025-01-15T12:00:00Z');
      vi.useFakeTimers({ now });
      const today = now;
      const result = daysUntilExpiry(today);
      expect(result).toBe(0);
    });

    it('should return negative days when expired', () => {
      const now = new Date('2025-01-15T12:00:00Z');
      vi.useFakeTimers({ now });
      const pastDate = new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000); // -5 days
      const result = daysUntilExpiry(pastDate);
      expect(result).toBe(-5);
    });

    it('should round down partial days (less than 24h counts as 0)', () => {
      const now = new Date('2025-01-15T00:00:00Z');
      vi.useFakeTimers({ now });
      const futureDate = new Date(now.getTime() + 6 * 60 * 60 * 1000); // +6 hours
      const result = daysUntilExpiry(futureDate);
      expect(result).toBe(0);
    });
  });

  describe('Integration: full subscription lifecycle', () => {
    it('should correctly track subscription from creation to expiry', () => {
      const startDate = new Date('2025-01-01T12:00:00Z');
      const expiry = calculateExpiryDate(startDate, 'monthly');
      expect(expiry.getTime()).toBeGreaterThan(startDate.getTime());

      // Freeze time just after start date (before expiry)
      const beforeExpiry = new Date('2025-01-15T00:00:00Z');
      vi.setSystemTime(beforeExpiry);
      expect(isSubscriptionExpired(expiry)).toBe(false);

      // Move time past expiry
      const afterExpiry = new Date(expiry.getTime() + 86400000); // +1 day past expiry
      vi.setSystemTime(afterExpiry);
      expect(isSubscriptionExpired(expiry)).toBe(true);
    });
  });
});
