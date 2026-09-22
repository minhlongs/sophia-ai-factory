import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  executeWithCostFallback,
  evaluateProviderHealth,
  getFallbackChain,
  resetProviderHealth,
} from '../cost-arbitrage-fallback';
import {
  recordFailure,
  reset,
  getState,
} from '@/seed/security/circuit-breaker';
import { FailureKind, CircuitState } from '@/seed/types/failure-kind';

describe('CostArbitrageFallback', () => {
  const TEST_TENANT = 'tenant_arbitrage_test';

  beforeEach(() => {
    reset('primary_test', TEST_TENANT);
    reset('secondary_test', TEST_TENANT);
    reset('tertiary_test', TEST_TENANT);
    reset('mekong', TEST_TENANT);
    reset('openrouter', TEST_TENANT);
    reset('fal', TEST_TENANT);
  });

  describe('getFallbackChain', () => {
    it('returns configured fallback providers for script stage', () => {
      const chain = getFallbackChain('script', 'mekong');
      expect(chain).toContain('openrouter');
      expect(chain).toContain('anthropic');
    });

    it('returns configured fallback providers for visuals stage', () => {
      const chain = getFallbackChain('visuals', 'fal');
      expect(chain).toContain('mekong');
    });

    it('returns fallback providers for unmapped provider gracefully', () => {
      const chain = getFallbackChain('script', 'unknown_provider');
      expect(Array.isArray(chain)).toBe(true);
      expect(chain.length).toBeGreaterThan(0);
    });
  });

  describe('evaluateProviderHealth', () => {
    it('returns healthy status for initialized provider', () => {
      const health = evaluateProviderHealth('primary_test', TEST_TENANT);
      expect(health.circuitState).toBe(CircuitState.CLOSED);
      expect(health.isAvailable).toBe(true);
      expect(health.failureCount).toBe(0);
    });

    it('reflects OPEN circuit when failure threshold reached', () => {
      recordFailure('primary_test', FailureKind.AUTH_FAILURE, TEST_TENANT);
      const health = evaluateProviderHealth('primary_test', TEST_TENANT);
      expect(health.circuitState).toBe(CircuitState.OPEN);
      expect(health.isAvailable).toBe(false);
    });
  });

  describe('executeWithCostFallback', () => {
    it('executes primary provider when healthy without triggering fallback', async () => {
      const mockFn = vi.fn().mockImplementation(async (provider: string) => {
        return `response_from_${provider}`;
      });

      const outcome = await executeWithCostFallback({
        stage: 'script',
        primaryProvider: 'primary_test',
        fallbackChain: ['secondary_test'],
        tenantKeyRef: TEST_TENANT,
        execute: mockFn,
      });

      expect(outcome.result).toBe('response_from_primary_test');
      expect(outcome.fallbackTriggered).toBe(false);
      expect(outcome.providerUsed).toBe('primary_test');
      expect(outcome.primaryProvider).toBe('primary_test');
      expect(outcome.attemptsCount).toBe(1);
      expect(mockFn).toHaveBeenCalledTimes(1);
      expect(mockFn).toHaveBeenCalledWith('primary_test');
    });

    it('fails over to secondary provider when primary throws an error', async () => {
      const mockFn = vi.fn().mockImplementation(async (provider: string) => {
        if (provider === 'primary_test') {
          throw new Error('Primary provider 500 Internal Server Error');
        }
        return `recovered_by_${provider}`;
      });

      const outcome = await executeWithCostFallback({
        stage: 'script',
        primaryProvider: 'primary_test',
        fallbackChain: ['secondary_test'],
        tenantKeyRef: TEST_TENANT,
        execute: mockFn,
      });

      expect(outcome.result).toBe('recovered_by_secondary_test');
      expect(outcome.fallbackTriggered).toBe(true);
      expect(outcome.providerUsed).toBe('secondary_test');
      expect(outcome.primaryProvider).toBe('primary_test');
      expect(outcome.attemptsCount).toBe(2);

      // Verify circuit breaker on primary recorded the failure
      const primaryState = getState('primary_test', TEST_TENANT);
      expect(primaryState.failureCount).toBeGreaterThanOrEqual(1);
    });

    it('skips primary provider if circuit breaker is already OPEN', async () => {
      // Trip primary breaker
      recordFailure('primary_test', FailureKind.AUTH_FAILURE, TEST_TENANT);

      const mockFn = vi.fn().mockImplementation(async (provider: string) => {
        return `success_from_${provider}`;
      });

      const outcome = await executeWithCostFallback({
        stage: 'script',
        primaryProvider: 'primary_test',
        fallbackChain: ['secondary_test'],
        tenantKeyRef: TEST_TENANT,
        execute: mockFn,
      });

      expect(outcome.result).toBe('success_from_secondary_test');
      expect(outcome.providerUsed).toBe('secondary_test');
      // Mock should not have been called with primary_test at all
      expect(mockFn).not.toHaveBeenCalledWith('primary_test');
      expect(mockFn).toHaveBeenCalledWith('secondary_test');
    });

    it('fails over when primary provider exceeds latency threshold', async () => {
      const mockFn = vi.fn().mockImplementation(async (provider: string) => {
        if (provider === 'primary_test') {
          // Simulate hung/slow provider exceeding 100ms threshold
          await new Promise((resolve) => setTimeout(resolve, 250));
          return 'slow_result';
        }
        return `fast_fallback_${provider}`;
      });

      const outcome = await executeWithCostFallback({
        stage: 'visuals',
        primaryProvider: 'primary_test',
        fallbackChain: ['secondary_test'],
        tenantKeyRef: TEST_TENANT,
        latencyThresholdMs: 80, // strict 80ms ceiling
        execute: mockFn,
      });

      expect(outcome.result).toBe('fast_fallback_secondary_test');
      expect(outcome.fallbackTriggered).toBe(true);
      expect(outcome.providerUsed).toBe('secondary_test');
    });

    it('throws when all providers in fallback chain fail', async () => {
      const mockFn = vi.fn().mockRejectedValue(new Error('Global service outage'));

      await expect(
        executeWithCostFallback({
          stage: 'audio',
          primaryProvider: 'primary_test',
          fallbackChain: ['secondary_test'],
          tenantKeyRef: TEST_TENANT,
          execute: mockFn,
        })
      ).rejects.toThrow(/All providers in fallback chain exhausted/);
    });

    it('resets provider circuit breaker with resetProviderHealth', () => {
      recordFailure('primary_test', FailureKind.AUTH_FAILURE, TEST_TENANT);
      expect(evaluateProviderHealth('primary_test', TEST_TENANT).isAvailable).toBe(false);

      resetProviderHealth('primary_test', TEST_TENANT);
      expect(evaluateProviderHealth('primary_test', TEST_TENANT).isAvailable).toBe(true);
    });
  });
});
