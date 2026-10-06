/**
 * Unit Test Suite: AGY Agency Quota & Rate Limit Engine
 *
 * Tests sliding-window rate limiting, monthly MCU quota evaluation,
 * burst allowances, and state updates.
 *
 * Layer: tree/agy/__tests__
 */

import { describe, it, expect } from 'vitest';
import {
  checkRateLimitWindow,
  checkRateLimitRps,
  checkMonthlyQuota,
  calculateNextQuotaState,
  evaluateAgencyBurstCapacity,
} from '../agency-quota-engine';

describe('Agency Quota & Rate Limit Engine', () => {
  describe('checkRateLimitWindow', () => {
    it('allows requests within max limit and tracks remaining slots', () => {
      const now = 10000;
      const timestamps = [9500, 9600, 9700]; // 3 requests in last 1000ms

      const result = checkRateLimitWindow({
        timestamps,
        nowMs: now,
        windowMs: 1000,
        maxRequests: 5,
      });

      expect(result.allowed).toBe(true);
      expect(result.currentCount).toBe(3);
      expect(result.remaining).toBe(1); // 5 - 3 - 1 (for the new request)
      expect(result.retryAfterSeconds).toBe(0);
      expect(result.prunedTimestamps).toHaveLength(4);
      expect(result.prunedTimestamps).toContain(now);
    });

    it('blocks request when window capacity is full', () => {
      const now = 10000;
      // 5 requests within the last 1000ms (window: 9000 - 10000)
      const timestamps = [9100, 9200, 9300, 9400, 9500];

      const result = checkRateLimitWindow({
        timestamps,
        nowMs: now,
        windowMs: 1000,
        maxRequests: 5,
      });

      expect(result.allowed).toBe(false);
      expect(result.currentCount).toBe(5);
      expect(result.remaining).toBe(0);
      expect(result.retryAfterSeconds).toBeGreaterThan(0);
      expect(result.prunedTimestamps).toHaveLength(5); // Did not add current timestamp
    });

    it('prunes expired timestamps older than windowMs', () => {
      const now = 10000;
      // 2 old timestamps (8000, 8500), 2 active timestamps (9500, 9800)
      const timestamps = [8000, 8500, 9500, 9800];

      const result = checkRateLimitWindow({
        timestamps,
        nowMs: now,
        windowMs: 1000,
        maxRequests: 5,
      });

      expect(result.allowed).toBe(true);
      expect(result.currentCount).toBe(2);
      expect(result.prunedTimestamps).toEqual([9500, 9800, now]);
    });
  });

  describe('checkRateLimitRps', () => {
    it('evaluates rate limit per second correctly', () => {
      const allowedResult = checkRateLimitRps('agy_123', 45, 100, 1000);
      expect(allowedResult.allowed).toBe(true);
      expect(allowedResult.remaining).toBe(54); // 100 - 45 - 1
      expect(allowedResult.retryAfterSeconds).toBe(0);

      const blockedResult = checkRateLimitRps('agy_123', 100, 100, 1000);
      expect(blockedResult.allowed).toBe(false);
      expect(blockedResult.remaining).toBe(0);
      expect(blockedResult.retryAfterSeconds).toBe(1);
    });
  });

  describe('checkMonthlyQuota', () => {
    it('returns ok status when usage is well within quota limit', () => {
      const result = checkMonthlyQuota({
        agencyId: 'agy_acme',
        quotaLimitMcu: 100000,
        quotaUsedMcu: 50000,
        requestedMcu: 1000,
      });

      expect(result.allowed).toBe(true);
      expect(result.status).toBe('ok');
      expect(result.remainingMcu).toBe(50000);
      expect(result.deficitMcu).toBe(0);
    });

    it('returns warning status when remaining quota is 10% or less', () => {
      const result = checkMonthlyQuota({
        agencyId: 'agy_acme',
        quotaLimitMcu: 100000,
        quotaUsedMcu: 92000,
        requestedMcu: 1000,
      });

      expect(result.allowed).toBe(true);
      expect(result.status).toBe('warning');
      expect(result.remainingMcu).toBe(8000);
    });

    it('blocks request when quota is exhausted and overage is prohibited', () => {
      const result = checkMonthlyQuota({
        agencyId: 'agy_acme',
        quotaLimitMcu: 100000,
        quotaUsedMcu: 99500,
        requestedMcu: 1000, // Exceeds by 500 MCU
        allowOverage: false,
      });

      expect(result.allowed).toBe(false);
      expect(result.status).toBe('exhausted');
      expect(result.remainingMcu).toBe(0);
      expect(result.deficitMcu).toBe(500);
      expect(result.reason).toContain('Agency monthly quota exceeded');
    });

    it('permits overage when allowOverage is true, tracking deficit', () => {
      const result = checkMonthlyQuota({
        agencyId: 'agy_vip',
        quotaLimitMcu: 100000,
        quotaUsedMcu: 105000,
        requestedMcu: 2000,
        allowOverage: true,
      });

      expect(result.allowed).toBe(true);
      expect(result.status).toBe('warning');
      expect(result.remainingMcu).toBe(0);
      expect(result.deficitMcu).toBe(7000);
      expect(result.reason).toContain('Overage allowed');
    });
  });

  describe('calculateNextQuotaState', () => {
    it('correctly increments and decrements quota usage clamping at zero', () => {
      expect(calculateNextQuotaState(1000, 500)).toBe(1500);
      expect(calculateNextQuotaState(1000, -400)).toBe(600);
      expect(calculateNextQuotaState(200, -500)).toBe(0);
    });
  });

  describe('evaluateAgencyBurstCapacity', () => {
    it('calculates burst capacity with multiplier', () => {
      const standard = evaluateAgencyBurstCapacity({
        currentRps: 120,
        rateLimitRps: 100,
        burstMultiplier: 1.5, // 150 burst limit
      });
      expect(standard.allowed).toBe(true);
      expect(standard.burstLimit).toBe(150);

      const exceeded = evaluateAgencyBurstCapacity({
        currentRps: 180,
        rateLimitRps: 100,
        burstMultiplier: 1.5,
      });
      expect(exceeded.allowed).toBe(false);
    });
  });
});
