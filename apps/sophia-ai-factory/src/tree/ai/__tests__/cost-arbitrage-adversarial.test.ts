/**
 * @module tree/ai/__tests__/cost-arbitrage-adversarial.test.ts
 *
 * Empirical Adversarial Challenger Test Suite:
 * Milestone 4 — Multi-Model Cost Arbitrage & Hybrid Edge Fallback Engine (Requirement R4)
 *
 * Stress-tests:
 * 1. Provider outages across Script, Visuals, Audio, and Render stages.
 * 2. All-providers-down terminal failure handling.
 * 3. 6,000ms latency SLA timeout triggers and automatic failover.
 * 4. High-concurrency multi-tenant state isolation (zero cross-contamination).
 * 5. Boundary specs (0s, extreme durations, zero budget, recovery probes).
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  routeMultimodalCostArbitrage,
  calculatePipelineStageCosts,
  calculateCloudBaselineCost,
  estimateStageCost,
  SCRIPT_PROVIDER_OPTIONS,
  VISUALS_PROVIDER_OPTIONS,
  AUDIO_PROVIDER_OPTIONS,
  RENDER_PROVIDER_OPTIONS,
} from '../multimodal-cost-router';
import {
  executeWithCostFallback,
  evaluateProviderHealth,
  getFallbackChain,
  resetProviderHealth,
  DEFAULT_LATENCY_THRESHOLD_MS,
} from '../cost-arbitrage-fallback';
import {
  recordFailure,
  recordSuccess,
  reset,
  getState,
  shouldAllowRequest,
  __testSetEntry,
} from '@/seed/security/circuit-breaker';
import { FailureKind, CircuitState } from '@/seed/types/failure-kind';

describe('Adversarial Challenger: Milestone 4 Cost Arbitrage & Fallback Engine', () => {
  const TENANT_A = 'adversarial_tenant_alpha';
  const TENANT_B = 'adversarial_tenant_bravo';
  const TENANT_C = 'adversarial_tenant_charlie';

  const ALL_PROVIDERS = ['mekong', 'openrouter', 'fal', 'elevenlabs', 'anthropic', 'fish-speech'];

  beforeEach(() => {
    // Thoroughly reset circuit breaker state for clean isolation
    for (const p of ALL_PROVIDERS) {
      reset(p, TENANT_A);
      reset(p, TENANT_B);
      reset(p, TENANT_C);
      reset(p, 'platform');
    }
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // ═════════════════════════════════════════════════════════════════════════════
  // 1. PROVIDER OUTAGES ACROSS ALL 4 PIPELINE STAGES
  // ═════════════════════════════════════════════════════════════════════════════

  describe('1. Provider Outages Across All Stages', () => {
    it('Stage 1 (Script): Mekong down -> OpenRouter fallback', async () => {
      // Trip Mekong edge node for Tenant A
      recordFailure('mekong', FailureKind.AUTH_FAILURE, TENANT_A);
      expect(shouldAllowRequest('mekong', TENANT_A)).toBe(false);

      // 1. Cost Router Decision Verification
      const decision = routeMultimodalCostArbitrage(
        { targetDurationSeconds: 30, bypassEdge: false },
        { edgeNodeAvailable: true, tenantKeyRef: TENANT_A }
      );

      expect(decision.selectedStages.script.provider).toBe('openrouter');
      expect(decision.selectedStages.script.model).toBe('deepseek/deepseek-chat');
      expect(decision.selectedStages.script.circuitState).toBe('CLOSED');
      expect(decision.selectedStages.script.estimatedCostUsd).toBeGreaterThan(0.0);

      // 2. Fallback Engine Execution Verification
      const executionCalls: string[] = [];
      const mockExecutor = vi.fn().mockImplementation(async (provider: string) => {
        executionCalls.push(provider);
        if (provider === 'mekong') {
          throw new Error('Mekong local LLM connection refused');
        }
        return { script: 'AI Hook: 3 Proven Ways to Scale to $10K MRR', provider };
      });

      const outcome = await executeWithCostFallback<{ script: string; provider: string }>({
        stage: 'script',
        primaryProvider: 'mekong',
        fallbackChain: ['openrouter', 'anthropic'],
        tenantKeyRef: TENANT_A,
        execute: mockExecutor,
      });

      // Note: Mekong circuit was already OPEN, so executeWithCostFallback skips Mekong directly
      expect(outcome.providerUsed).toBe('openrouter');
      expect(outcome.fallbackTriggered).toBe(true);
      expect(outcome.result.script).toContain('$10K MRR');
      expect(executionCalls).not.toContain('mekong'); // Skipped because circuit breaker is OPEN
      expect(executionCalls).toContain('openrouter');
    });

    it('Stage 2 (Visuals): fal.ai down -> Mekong fallback', async () => {
      // 1. When fal.ai is primary and trips during runtime
      const executionCalls: string[] = [];
      const mockExecutor = vi.fn().mockImplementation(async (provider: string) => {
        executionCalls.push(provider);
        if (provider === 'fal') {
          throw new Error('fal.ai 503 Service Temporarily Unavailable');
        }
        return { frames: ['frame_1.jpg', 'frame_2.jpg'], provider };
      });

      const outcome = await executeWithCostFallback({
        stage: 'visuals',
        primaryProvider: 'fal',
        tenantKeyRef: TENANT_A,
        execute: mockExecutor,
      });

      expect(outcome.fallbackTriggered).toBe(true);
      expect(outcome.providerUsed).toBe('mekong');
      expect(outcome.attemptsCount).toBe(2);
      expect(executionCalls).toEqual(['fal', 'mekong']);

      // Verify fal.ai failure was recorded in circuit breaker
      const falState = getState('fal', TENANT_A);
      expect(falState.failureCount).toBeGreaterThanOrEqual(1);

      // 2. Cost Router Verification: When edge is available, router prefers Mekong
      const routerDecision = routeMultimodalCostArbitrage(
        { targetDurationSeconds: 30, bypassEdge: false },
        { edgeNodeAvailable: true, tenantKeyRef: TENANT_A }
      );
      expect(routerDecision.selectedStages.visuals.provider).toBe('mekong');
      expect(routerDecision.selectedStages.visuals.isUnmetered).toBe(true);
      expect(routerDecision.selectedStages.visuals.estimatedCostUsd).toBe(0.0);
    });

    it('Stage 3 (Audio): ElevenLabs down -> Mekong Kokoro fallback', async () => {
      // Trip ElevenLabs circuit breaker
      recordFailure('elevenlabs', FailureKind.AUTH_FAILURE, TENANT_A);
      expect(shouldAllowRequest('elevenlabs', TENANT_A)).toBe(false);

      // 1. Router Verification: When edge is available, router uses Mekong Kokoro
      const routerDecision = routeMultimodalCostArbitrage(
        { targetDurationSeconds: 30, bypassEdge: false },
        { edgeNodeAvailable: true, tenantKeyRef: TENANT_A }
      );
      expect(routerDecision.selectedStages.audio.provider).toBe('mekong');
      expect(routerDecision.selectedStages.audio.model).toBe('kokoro-tts-v0.19');
      expect(routerDecision.selectedStages.audio.isUnmetered).toBe(true);

      // 2. Fallback Engine Verification:
      // In DEFAULT_FALLBACK_CHAINS, audio has elevenlabs -> ['fish-speech', 'mekong'].
      // If fish-speech is also unavailable, verify it falls through to Mekong Kokoro.
      const executionCalls: string[] = [];
      const mockExecutor = vi.fn().mockImplementation(async (provider: string) => {
        executionCalls.push(provider);
        if (provider === 'elevenlabs') {
          throw new Error('ElevenLabs quota exhausted (402)');
        }
        if (provider === 'fish-speech') {
          throw new Error('fish-speech daemon offline');
        }
        if (provider === 'mekong') {
          return { audioBuffer: 'kokoro_audio_bytes', provider: 'mekong' };
        }
        throw new Error(`Unexpected provider: ${provider}`);
      });

      const outcome = await executeWithCostFallback<{ audioBuffer: string; provider: string }>({
        stage: 'audio',
        primaryProvider: 'elevenlabs',
        tenantKeyRef: TENANT_A,
        execute: mockExecutor,
      });

      expect(outcome.providerUsed).toBe('mekong');
      expect(outcome.fallbackTriggered).toBe(true);
      expect(outcome.result.audioBuffer).toBe('kokoro_audio_bytes');
      // elevenlabs was skipped because circuit was OPEN; fish-speech was tried and failed; mekong succeeded.
      expect(executionCalls).toEqual(['fish-speech', 'mekong']);

      // Also test with explicit fallbackChain: ['mekong']
      const directOutcome = await executeWithCostFallback({
        stage: 'audio',
        primaryProvider: 'elevenlabs',
        fallbackChain: ['mekong'],
        tenantKeyRef: TENANT_A,
        execute: mockExecutor,
      });
      expect(directOutcome.providerUsed).toBe('mekong');
      expect(directOutcome.fallbackTriggered).toBe(true);
    });

    it('Stage 4 (Render): Cloud worker down -> Mekong HW FFmpeg fallback', async () => {
      const executionCalls: string[] = [];
      const mockExecutor = vi.fn().mockImplementation(async (provider: string) => {
        executionCalls.push(provider);
        if (provider === 'openrouter') {
          throw new Error('Cloudflare Worker CPU time limit exceeded');
        }
        return { videoUrl: 'https://r2.sophia.network/video_final.mp4', provider };
      });

      // Default fallback chain for render from openrouter: ['fal', 'mekong']
      // Let's test with fallbackChain: ['mekong']
      const outcome = await executeWithCostFallback({
        stage: 'render',
        primaryProvider: 'openrouter',
        fallbackChain: ['mekong'],
        tenantKeyRef: TENANT_A,
        execute: mockExecutor,
      });

      expect(outcome.providerUsed).toBe('mekong');
      expect(outcome.fallbackTriggered).toBe(true);
      expect(outcome.attemptsCount).toBe(2);
      expect(executionCalls).toEqual(['openrouter', 'mekong']);
    });

    it('All providers down: clean error thrown with composite diagnostic', async () => {
      // All candidate providers in script stage fail
      const failingExecutor = vi.fn().mockRejectedValue(new Error('Global DNS resolution failure'));

      await expect(
        executeWithCostFallback({
          stage: 'script',
          primaryProvider: 'mekong',
          fallbackChain: ['openrouter', 'anthropic'],
          tenantKeyRef: TENANT_A,
          execute: failingExecutor,
        })
      ).rejects.toThrow(
        'All providers in fallback chain exhausted for stage "script". Last error: Global DNS resolution failure'
      );

      // Verify all 3 providers had failures recorded in circuit breaker
      expect(getState('mekong', TENANT_A).failureCount).toBeGreaterThanOrEqual(1);
      expect(getState('openrouter', TENANT_A).failureCount).toBeGreaterThanOrEqual(1);
      expect(getState('anthropic', TENANT_A).failureCount).toBeGreaterThanOrEqual(1);
    });
  });

  // ═════════════════════════════════════════════════════════════════════════════
  // 2. LATENCY SLA TIMEOUT STRESS (6,000ms SLA CEILING)
  // ═════════════════════════════════════════════════════════════════════════════

  describe('2. Latency SLA Timeout Stress', () => {
    it('verifies DEFAULT_LATENCY_THRESHOLD_MS is exactly 6,000ms', () => {
      expect(DEFAULT_LATENCY_THRESHOLD_MS).toBe(6_000);
    });

    it('Delay > 6,000ms SLA triggers timeout and automatic fallback (fake timers)', async () => {
      vi.useFakeTimers();

      const mockExecutor = vi.fn().mockImplementation(async (provider: string) => {
        if (provider === 'mekong') {
          // Simulate hanging Mekong node (e.g. GPU deadlocked, takes 10,000ms)
          await new Promise((resolve) => setTimeout(resolve, 10_000));
          return { script: 'too_late' };
        }
        // Fallback provider responds quickly in 200ms
        await new Promise((resolve) => setTimeout(resolve, 200));
        return { script: 'fallback_script_success', provider };
      });

      const fallbackPromise = executeWithCostFallback({
        stage: 'script',
        primaryProvider: 'mekong',
        fallbackChain: ['openrouter'],
        tenantKeyRef: TENANT_A,
        // Using default threshold (6,000ms)
        execute: mockExecutor,
      });

      // Advance timers by 6,001ms to trigger SLA timeout on primary
      await vi.advanceTimersByTimeAsync(6_001);

      // Advance timers by another 250ms for openrouter to respond
      await vi.advanceTimersByTimeAsync(250);

      const outcome = await fallbackPromise;

      expect(outcome.fallbackTriggered).toBe(true);
      expect(outcome.providerUsed).toBe('openrouter');
      expect(outcome.fallbackReason).toContain('exceeded SLA threshold of 6000ms');

      // Verify circuit breaker recorded the failure on mekong
      const mekongState = getState('mekong', TENANT_A);
      expect(mekongState.failureCount).toBe(1);
    });

    it('Executions under SLA threshold succeed without fallback', async () => {
      const mockExecutor = vi.fn().mockImplementation(async (provider: string) => {
        // Fast execution (15ms) well below threshold
        await new Promise((resolve) => setTimeout(resolve, 15));
        return { data: 'fast_result', provider };
      });

      const outcome = await executeWithCostFallback({
        stage: 'visuals',
        primaryProvider: 'mekong',
        fallbackChain: ['fal'],
        tenantKeyRef: TENANT_A,
        latencyThresholdMs: 500, // 500ms SLA
        execute: mockExecutor,
      });

      expect(outcome.fallbackTriggered).toBe(false);
      expect(outcome.providerUsed).toBe('mekong');
      expect(outcome.attemptsCount).toBe(1);
      expect(mockExecutor).toHaveBeenCalledTimes(1);
    });

    it('Real-clock timeout: 50ms SLA trips slow 150ms primary and fails over to secondary', async () => {
      const mockExecutor = vi.fn().mockImplementation(async (provider: string) => {
        if (provider === 'primary_slow') {
          await new Promise((resolve) => setTimeout(resolve, 150));
          return 'slow_data';
        }
        return 'fast_fallback_data';
      });

      const outcome = await executeWithCostFallback({
        stage: 'audio',
        primaryProvider: 'primary_slow',
        fallbackChain: ['secondary_fast'],
        tenantKeyRef: TENANT_A,
        latencyThresholdMs: 40, // strict 40ms SLA
        execute: mockExecutor,
      });

      expect(outcome.fallbackTriggered).toBe(true);
      expect(outcome.providerUsed).toBe('secondary_fast');
      expect(outcome.fallbackReason).toContain('exceeded SLA threshold of 40ms');
    });
  });

  // ═════════════════════════════════════════════════════════════════════════════
  // 3. RAPID CONCURRENT ROUTING & TENANT STATE ISOLATION
  // ═════════════════════════════════════════════════════════════════════════════

  describe('3. Rapid Concurrent Routing & Multi-Tenant State Isolation', () => {
    it('Tripping circuit breaker on Tenant A does NOT affect Tenant B or Tenant C', () => {
      // 1. Trip openrouter on Tenant A via AUTH_FAILURE (immediate OPEN)
      recordFailure('openrouter', FailureKind.AUTH_FAILURE, TENANT_A);

      expect(shouldAllowRequest('openrouter', TENANT_A)).toBe(false);
      expect(getState('openrouter', TENANT_A).state).toBe(CircuitState.OPEN);

      // 2. Verify Tenant B and Tenant C still see openrouter as CLOSED and available
      expect(shouldAllowRequest('openrouter', TENANT_B)).toBe(true);
      expect(getState('openrouter', TENANT_B).state).toBe(CircuitState.CLOSED);

      expect(shouldAllowRequest('openrouter', TENANT_C)).toBe(true);
      expect(getState('openrouter', TENANT_C).state).toBe(CircuitState.CLOSED);

      // 3. Router decision isolation:
      // Tenant A (cloud bypass): openrouter is OPEN, so cost router flags it as OPEN
      const decisionA = routeMultimodalCostArbitrage(
        { targetDurationSeconds: 30, bypassEdge: true },
        { tenantKeyRef: TENANT_A }
      );
      expect(decisionA.selectedStages.script.circuitState).toBe('OPEN');

      // Tenant B (cloud bypass): openrouter is CLOSED and healthy
      const decisionB = routeMultimodalCostArbitrage(
        { targetDurationSeconds: 30, bypassEdge: true },
        { tenantKeyRef: TENANT_B }
      );
      expect(decisionB.selectedStages.script.circuitState).toBe('CLOSED');
      expect(decisionB.selectedStages.script.model).toBe('deepseek/deepseek-chat');
    });

    it('Sustains 100 rapid concurrent routing requests across 10 distinct tenants without state leakage', async () => {
      const TENANT_COUNT = 10;
      const REQUESTS_PER_TENANT = 10;
      const tenants = Array.from({ length: TENANT_COUNT }, (_, i) => `tenant_concurrent_${i}`);

      // Trip fal on even-numbered tenants only
      for (let i = 0; i < TENANT_COUNT; i++) {
        if (i % 2 === 0) {
          recordFailure('fal', FailureKind.AUTH_FAILURE, tenants[i]);
        }
      }

      // Launch 100 concurrent routing calculations
      const requests = tenants.flatMap((tenant, tenantIndex) =>
        Array.from({ length: REQUESTS_PER_TENANT }, (_, reqIndex) => async () => {
          const spec = {
            targetDurationSeconds: 15 + (reqIndex % 4) * 15,
            bypassEdge: true,
          };
          const decision = routeMultimodalCostArbitrage(spec, { tenantKeyRef: tenant });

          // Invariant assertions per tenant:
          if (tenantIndex % 2 === 0) {
            // Even tenants: fal is OPEN
            expect(decision.selectedStages.visuals.circuitState).toBe('OPEN');
          } else {
            // Odd tenants: fal is CLOSED
            expect(decision.selectedStages.visuals.circuitState).toBe('CLOSED');
          }
          expect(decision.totalEstimatedCostUsd).toBeGreaterThan(0);
          expect(decision.costPerSecondUsd).toBeGreaterThan(0);
          return { tenant, cost: decision.totalEstimatedCostUsd };
        })
      );

      const results = await Promise.all(requests.map((fn) => fn()));
      expect(results.length).toBe(100);

      // Verify circuit breaker state remains pristine
      for (let i = 0; i < TENANT_COUNT; i++) {
        const isEven = i % 2 === 0;
        expect(shouldAllowRequest('fal', tenants[i])).toBe(!isEven);
      }
    });

    it('50 concurrent executions through executeWithCostFallback isolate failures cleanly', async () => {
      const tenantHealthy = 'tenant_fallback_healthy';
      const tenantFailing = 'tenant_fallback_failing';

      const mockExecutor = vi.fn().mockImplementation(async (provider: string) => {
        if (provider === 'failing_primary') {
          throw new Error('Simulated upstream 502 Bad Gateway');
        }
        return `success_${provider}`;
      });

      const failingTasks = Array.from({ length: 25 }, () =>
        executeWithCostFallback({
          stage: 'script',
          primaryProvider: 'failing_primary',
          fallbackChain: ['healthy_backup'],
          tenantKeyRef: tenantFailing,
          execute: mockExecutor,
        })
      );

      const healthyTasks = Array.from({ length: 25 }, () =>
        executeWithCostFallback({
          stage: 'script',
          primaryProvider: 'healthy_backup',
          fallbackChain: ['another_backup'],
          tenantKeyRef: tenantHealthy,
          execute: mockExecutor,
        })
      );

      const [failingResults, healthyResults] = await Promise.all([
        Promise.all(failingTasks),
        Promise.all(healthyTasks),
      ]);

      expect(failingResults.length).toBe(25);
      failingResults.forEach((res) => {
        expect(res.fallbackTriggered).toBe(true);
        expect(res.providerUsed).toBe('healthy_backup');
      });

      expect(healthyResults.length).toBe(25);
      healthyResults.forEach((res) => {
        expect(res.fallbackTriggered).toBe(false);
        expect(res.providerUsed).toBe('healthy_backup');
      });

      // Failing tenant tripped its breaker
      expect(getState('failing_primary', tenantFailing).failureCount).toBeGreaterThanOrEqual(1);
      // Healthy tenant had 0 failures on healthy_backup
      expect(getState('healthy_backup', tenantHealthy).failureCount).toBe(0);
    });
  });

  // ═════════════════════════════════════════════════════════════════════════════
  // 4. BOUNDARY & ADVERSARIAL EDGE CASES
  // ═════════════════════════════════════════════════════════════════════════════

  describe('4. Boundary & Adversarial Edge Cases', () => {
    it('Defends against 0-second target duration input (normalizes to 1s)', () => {
      const decision = routeMultimodalCostArbitrage(
        { targetDurationSeconds: 0, bypassEdge: false },
        { edgeNodeAvailable: true, tenantKeyRef: TENANT_A }
      );

      expect(decision.durationSeconds).toBe(1);
      expect(decision.costPerSecondUsd).toBe(0);
      expect(Number.isNaN(decision.costPerSecondUsd)).toBe(false);
    });

    it('Defends against negative duration input', () => {
      const decision = routeMultimodalCostArbitrage(
        { targetDurationSeconds: -60, bypassEdge: true },
        { tenantKeyRef: TENANT_A }
      );

      expect(decision.durationSeconds).toBe(1);
      expect(decision.costPerSecondUsd).toBeGreaterThan(0);
      expect(Number.isFinite(decision.costPerSecondUsd)).toBe(true);
    });

    it('Accurately handles 1-hour video render specs without numeric overflow', () => {
      const oneHourDecision = routeMultimodalCostArbitrage(
        { targetDurationSeconds: 3600, bypassEdge: true },
        { tenantKeyRef: TENANT_A }
      );

      expect(oneHourDecision.durationSeconds).toBe(3600);
      expect(oneHourDecision.totalEstimatedCostUsd).toBeGreaterThan(5.0);
      expect(Number.isFinite(oneHourDecision.totalEstimatedCostUsd)).toBe(true);
    });

    it('Zero-budget ($0.00) properly marks withinBudget=false for cloud bypass and true for edge', () => {
      const cloudDecision = routeMultimodalCostArbitrage(
        { targetDurationSeconds: 30, bypassEdge: true, maxBudgetUsd: 0.0 },
        { tenantKeyRef: TENANT_A }
      );
      expect(cloudDecision.withinBudget).toBe(false);

      const edgeDecision = routeMultimodalCostArbitrage(
        { targetDurationSeconds: 30, bypassEdge: false, maxBudgetUsd: 0.0 },
        { edgeNodeAvailable: true, tenantKeyRef: TENANT_A }
      );
      expect(edgeDecision.withinBudget).toBe(true);
    });

    it('Circuit Breaker recovery: successful probe in HALF_OPEN resets breaker to CLOSED', () => {
      // 1. Force state to HALF_OPEN
      __testSetEntry('test_service', TENANT_A, {
        state: CircuitState.HALF_OPEN,
        failureCount: 5,
        cooldownUntil: Date.now() - 1000,
      });

      expect(getState('test_service', TENANT_A).state).toBe(CircuitState.HALF_OPEN);

      // 2. Successful probe execution records success
      recordSuccess('test_service', TENANT_A);

      // 3. Breaker is now CLOSED and failure count is 0
      const entry = getState('test_service', TENANT_A);
      expect(entry.state).toBe(CircuitState.CLOSED);
      expect(entry.failureCount).toBe(0);
      expect(shouldAllowRequest('test_service', TENANT_A)).toBe(true);
    });
  });
});
