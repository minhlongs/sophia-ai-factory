import { describe, it, expect, beforeEach } from 'vitest';
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
  recordFailure,
  reset,
} from '@/seed/security/circuit-breaker';
import { FailureKind } from '@/seed/types/failure-kind';

describe('MultimodalCostRouter', () => {
  beforeEach(() => {
    // Reset circuit breakers for test isolation
    reset('openrouter', 'test_tenant');
    reset('fal', 'test_tenant');
    reset('elevenlabs', 'test_tenant');
    reset('mekong', 'test_tenant');
  });

  describe('estimateStageCost', () => {
    it('returns $0.00 for unmetered Mekong edge options', () => {
      const mekongScript = SCRIPT_PROVIDER_OPTIONS.find((p) => p.provider === 'mekong')!;
      const cost = estimateStageCost('script', mekongScript, { targetDurationSeconds: 30 });
      expect(cost).toBe(0.0);
    });

    it('calculates metered cloud script cost accurately from token counts', () => {
      const openRouterDeepseek = SCRIPT_PROVIDER_OPTIONS.find(
        (p) => p.model === 'deepseek/deepseek-chat'
      )!;
      // 1200 prompt + 400 completion = 1600 tokens * 0.00000021 = $0.000336
      const cost = estimateStageCost('script', openRouterDeepseek, {
        targetDurationSeconds: 30,
        scriptPromptTokens: 1200,
        scriptCompletionTokens: 400,
      });
      expect(cost).toBeCloseTo(0.000336, 5);
    });

    it('calculates metered cloud visuals cost based on frame count', () => {
      const falSchnell = VISUALS_PROVIDER_OPTIONS.find(
        (p) => p.model === 'fal-ai/flux-schnell'
      )!;
      // 6 frames * $0.01 = $0.060
      const cost = estimateStageCost('visuals', falSchnell, {
        targetDurationSeconds: 30,
        frameCount: 6,
      });
      expect(cost).toBe(0.06);
    });

    it('calculates metered cloud audio cost based on character count', () => {
      const elevenTurbo = AUDIO_PROVIDER_OPTIONS.find(
        (p) => p.model === 'eleven_turbo_v2_5'
      )!;
      // 420 chars * $0.00003 = $0.0126
      const cost = estimateStageCost('audio', elevenTurbo, {
        targetDurationSeconds: 30,
        audioCharacterCount: 420,
      });
      expect(cost).toBeCloseTo(0.0126, 4);
    });
  });

  describe('calculateCloudBaselineCost', () => {
    it('computes standard cloud cost for a 30s video', () => {
      const baseline = calculateCloudBaselineCost({ targetDurationSeconds: 30 });
      // Script (~$0.0003) + 6 frames * $0.01 ($0.06) + 420 chars * $0.00003 ($0.0126) + render ($0.005)
      // Total approx $0.0779
      expect(baseline).toBeGreaterThan(0.07);
      expect(baseline).toBeLessThan(0.15);
    });
  });

  describe('routeMultimodalCostArbitrage', () => {
    it('selects unmetered Mekong edge when available, delivering massive savings', () => {
      const decision = routeMultimodalCostArbitrage(
        { targetDurationSeconds: 30, bypassEdge: false },
        { edgeNodeAvailable: true, tenantKeyRef: 'test_tenant' }
      );

      expect(decision.isMekongGpuAccelerated).toBe(true);
      expect(decision.selectedStages.script.provider).toBe('mekong');
      expect(decision.selectedStages.visuals.provider).toBe('mekong');
      expect(decision.selectedStages.audio.provider).toBe('mekong');
      expect(decision.selectedStages.render.provider).toBe('mekong');
      expect(decision.totalEstimatedCostUsd).toBe(0.0);
      expect(decision.costPerSecondUsd).toBe(0.0);
      expect(decision.savingsPercentage).toBe(100.0);
      expect(decision.withinBudget).toBe(true);
    });

    it('falls back cleanly to cloud providers when bypassEdge is true', () => {
      const decision = routeMultimodalCostArbitrage(
        { targetDurationSeconds: 30, bypassEdge: true },
        { tenantKeyRef: 'test_tenant' }
      );

      expect(decision.isMekongGpuAccelerated).toBe(false);
      expect(decision.selectedStages.script.provider).toBe('openrouter');
      expect(decision.selectedStages.visuals.provider).toBe('fal');
      expect(decision.selectedStages.audio.provider).toBe('elevenlabs');
      expect(decision.totalEstimatedCostUsd).toBeGreaterThan(0.0);
      expect(decision.costPerSecondUsd).toBeGreaterThan(0.0);
      expect(decision.savingsVsCloudUsd).toBeGreaterThanOrEqual(0.0);
    });

    it('scales costs with duration for cloud video generation', () => {
      const decision15s = routeMultimodalCostArbitrage(
        { targetDurationSeconds: 15, bypassEdge: true },
        { tenantKeyRef: 'test_tenant' }
      );

      const decision60s = routeMultimodalCostArbitrage(
        { targetDurationSeconds: 60, bypassEdge: true },
        { tenantKeyRef: 'test_tenant' }
      );

      expect(decision60s.totalEstimatedCostUsd).toBeGreaterThan(decision15s.totalEstimatedCostUsd);
      expect(decision15s.durationSeconds).toBe(15);
      expect(decision60s.durationSeconds).toBe(60);
    });

    it('respects circuit breaker by skipping tripped/OPEN provider and picking secondary', () => {
      // Simulate auth failure on fal.ai, which immediately trips the breaker to OPEN
      recordFailure('fal', FailureKind.AUTH_FAILURE, 'test_tenant');

      // Now run arbitrage with bypassEdge
      const decision = routeMultimodalCostArbitrage(
        { targetDurationSeconds: 30, bypassEdge: true },
        { tenantKeyRef: 'test_tenant' }
      );

      // The breaker for fal is OPEN, so fal is flagged as unhealthy
      expect(decision.selectedStages.visuals.circuitState).toBe('OPEN');
    });

    it('enforces budget limits and flags withinBudget appropriately', () => {
      // Very tight budget ($0.001) with cloud BYOK should be exceeded
      const overBudgetDecision = routeMultimodalCostArbitrage(
        { targetDurationSeconds: 30, bypassEdge: true, maxBudgetUsd: 0.001 },
        { tenantKeyRef: 'test_tenant' }
      );
      expect(overBudgetDecision.withinBudget).toBe(false);
      expect(overBudgetDecision.budgetLimitUsd).toBe(0.001);

      // Generous budget ($5.00) should be within budget
      const underBudgetDecision = routeMultimodalCostArbitrage(
        { targetDurationSeconds: 30, bypassEdge: true, maxBudgetUsd: 5.0 },
        { tenantKeyRef: 'test_tenant' }
      );
      expect(underBudgetDecision.withinBudget).toBe(true);
    });

    it('provides accurate pipeline stage breakdown via calculatePipelineStageCosts', () => {
      const decision = routeMultimodalCostArbitrage(
        { targetDurationSeconds: 30, bypassEdge: true },
        { tenantKeyRef: 'test_tenant' }
      );

      const breakdown = calculatePipelineStageCosts(decision);
      expect(breakdown.durationSeconds).toBe(30);
      expect(breakdown.scriptCostUsd).toBe(decision.selectedStages.script.estimatedCostUsd);
      expect(breakdown.visualsCostUsd).toBe(decision.selectedStages.visuals.estimatedCostUsd);
      expect(breakdown.audioCostUsd).toBe(decision.selectedStages.audio.estimatedCostUsd);
      expect(breakdown.renderCostUsd).toBe(decision.selectedStages.render.estimatedCostUsd);
      expect(breakdown.totalPipelineCostUsd).toBe(decision.totalEstimatedCostUsd);
    });
  });
});
