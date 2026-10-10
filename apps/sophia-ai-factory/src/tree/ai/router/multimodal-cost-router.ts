/**
 * Optimal Multimodal Cost Arbitrage Router
 *
 * Layer: tree/ai/router
 */

import { createLogger } from '@/seed/utils/logger-utility';
import { getState, shouldAllowRequest } from '@/seed/security/circuit-breaker';
import type {
  CostArbitrageDecision,
  EconomicsProviderId,
  PipelineStage,
  StageProviderOption,
  StageSelection,
  VideoPipelineSpec,
} from '@/seed/types/unit-economics-types';
import {
  SCRIPT_PROVIDER_OPTIONS,
  VISUALS_PROVIDER_OPTIONS,
  AUDIO_PROVIDER_OPTIONS,
  RENDER_PROVIDER_OPTIONS,
  type MultimodalRouterOptions,
} from './types';
import {
  estimateStageCost,
  calculateCloudBaselineCost,
} from './cost-calculator';

const logger = createLogger('tree/ai/multimodal-cost-router');

/**
 * Intelligently routes each stage of a video pipeline to the cheapest healthy provider.
 *
 * Algorithm:
 * 1. Filters candidates based on edge preference/availability and circuit breaker state.
 * 2. Evaluates cost per candidate for the pipeline specification.
 * 3. Sorts by estimated cost ascending (cheapest first).
 * 4. Checks circuit breaker via `shouldAllowRequest(candidate.provider)`.
 * 5. Assembles selected stage matrix and computes total cost, per-second cost, savings vs cloud.
 * 6. Verifies budget constraints.
 */
export function routeMultimodalCostArbitrage(
  spec: VideoPipelineSpec,
  options: MultimodalRouterOptions = {},
): CostArbitrageDecision {
  const duration = Math.max(1, spec.targetDurationSeconds);
  const strategy = options.strategy ?? 'cheapest_healthy';
  const edgeAvailable = options.edgeNodeAvailable ?? !spec.bypassEdge;
  const tenantKeyRef = options.tenantKeyRef ?? 'platform';

  const stages: PipelineStage[] = ['script', 'visuals', 'audio', 'render'];

  const stageOptionsMap: Record<PipelineStage, StageProviderOption[]> = {
    script: SCRIPT_PROVIDER_OPTIONS,
    visuals: VISUALS_PROVIDER_OPTIONS,
    audio: AUDIO_PROVIDER_OPTIONS,
    render: RENDER_PROVIDER_OPTIONS,
  };

  const selectedStages: CostArbitrageDecision['selectedStages'] = {
    script: null as unknown as StageSelection,
    visuals: null as unknown as StageSelection,
    audio: null as unknown as StageSelection,
    render: null as unknown as StageSelection,
  };

  let totalEstimatedCostUsd = 0;
  let isMekongGpuAccelerated = false;

  for (const stage of stages) {
    const candidates = stageOptionsMap[stage];

    // Filter and score candidates
    const evaluatedCandidates = candidates
      .filter((candidate) => {
        // If candidate is unmetered Mekong edge, require edgeAvailable and not bypassed
        if (candidate.provider === 'mekong') {
          if (!edgeAvailable || spec.bypassEdge) return false;
        }
        return true;
      })
      .map((candidate) => {
        const cbState = getState(candidate.provider, tenantKeyRef);
        const isHealthy = shouldAllowRequest(candidate.provider, tenantKeyRef);
        const cost = estimateStageCost(stage, candidate, spec);

        return {
          candidate,
          cost,
          isHealthy,
          circuitState: cbState.state,
        };
      });

    // Sort by:
    // 1. Healthy status first (healthy > tripped)
    // 2. Cost ascending (cheapest first)
    // 3. For quality_priority: prefers higher quality tier if affordable
    evaluatedCandidates.sort((a, b) => {
      if (a.isHealthy !== b.isHealthy) {
        return a.isHealthy ? -1 : 1;
      }
      if (strategy === 'quality_priority' && !a.candidate.isUnmetered && !b.candidate.isUnmetered) {
        return b.cost - a.cost;
      }
      return a.cost - b.cost;
    });

    const chosen = evaluatedCandidates[0] ?? {
      candidate: candidates[candidates.length - 1],
      cost: estimateStageCost(stage, candidates[candidates.length - 1], spec),
      isHealthy: true,
      circuitState: 'CLOSED' as const,
    };

    if (chosen.candidate.provider === 'mekong') {
      isMekongGpuAccelerated = true;
    }

    selectedStages[stage] = {
      stage,
      provider: chosen.candidate.provider as EconomicsProviderId,
      model: chosen.candidate.model,
      estimatedCostUsd: chosen.cost,
      isUnmetered: chosen.candidate.isUnmetered,
      circuitState: chosen.circuitState,
    };

    totalEstimatedCostUsd += chosen.cost;
  }

  totalEstimatedCostUsd = Number(totalEstimatedCostUsd.toFixed(4));
  const costPerSecondUsd = Number((totalEstimatedCostUsd / duration).toFixed(6));

  const cloudBaselineCost = calculateCloudBaselineCost(spec);
  const savingsVsCloudUsd = Number(Math.max(0, cloudBaselineCost - totalEstimatedCostUsd).toFixed(4));
  const savingsPercentage =
    cloudBaselineCost > 0
      ? Number(((savingsVsCloudUsd / cloudBaselineCost) * 100).toFixed(1))
      : 0;

  const withinBudget =
    spec.maxBudgetUsd !== undefined ? totalEstimatedCostUsd <= spec.maxBudgetUsd : true;

  let decisionReason = `Arbitraged ${duration}s pipeline: ${selectedStages.script.model} ($${selectedStages.script.estimatedCostUsd}), ${selectedStages.visuals.model} ($${selectedStages.visuals.estimatedCostUsd}), ${selectedStages.audio.model} ($${selectedStages.audio.estimatedCostUsd}), ${selectedStages.render.model} ($${selectedStages.render.estimatedCostUsd}).`;

  if (isMekongGpuAccelerated) {
    decisionReason += ` Accelerated via unmetered Mekong GPU Edge (${savingsPercentage}% savings vs cloud).`;
  } else {
    decisionReason += ` Cloud BYOK routing (${selectedStages.script.provider}/${selectedStages.visuals.provider}/${selectedStages.audio.provider}).`;
  }

  if (!withinBudget) {
    decisionReason += ` Warning: Cost $${totalEstimatedCostUsd} exceeds budget $${spec.maxBudgetUsd}.`;
    logger.warn('ARBITRAGE_BUDGET_EXCEEDED', {
      totalEstimatedCostUsd,
      budgetLimitUsd: spec.maxBudgetUsd,
    });
  }

  return {
    selectedStages,
    totalEstimatedCostUsd,
    durationSeconds: duration,
    costPerSecondUsd,
    isMekongGpuAccelerated,
    savingsVsCloudUsd,
    savingsPercentage,
    strategy,
    decisionReason,
    evaluatedAt: new Date().toISOString(),
    withinBudget,
    budgetLimitUsd: spec.maxBudgetUsd,
  };
}
