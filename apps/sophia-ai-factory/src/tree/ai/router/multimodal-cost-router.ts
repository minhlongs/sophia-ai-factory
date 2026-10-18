/**
 * Optimal Multimodal Cost Arbitrage Router
 * Layer: tree/ai/router
 */

import { createLogger } from '@/seed/utils/logger-utility';
import type {
  CostArbitrageDecision,
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
import { calculateCloudBaselineCost } from './cost-calculator';
import {
  buildArbitrageDecisionReason,
  selectBestStageCandidate,
  type StageCandidateSelectionResult,
} from './stage-candidate-evaluator';

export {
  buildArbitrageDecisionReason,
  selectBestStageCandidate,
  type StageCandidateSelectionResult,
};

const logger = createLogger('tree/ai/multimodal-cost-router');

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
    const { selection, isMekongProvider } = selectBestStageCandidate({
      stage,
      candidates: stageOptionsMap[stage],
      spec,
      strategy,
      edgeAvailable,
      tenantKeyRef,
    });
    if (isMekongProvider) isMekongGpuAccelerated = true;
    selectedStages[stage] = selection;
    totalEstimatedCostUsd += selection.estimatedCostUsd;
  }

  totalEstimatedCostUsd = Number(totalEstimatedCostUsd.toFixed(4));
  const costPerSecondUsd = Number((totalEstimatedCostUsd / duration).toFixed(6));
  const cloudBaselineCost = calculateCloudBaselineCost(spec);
  const savingsVsCloudUsd = Number(Math.max(0, cloudBaselineCost - totalEstimatedCostUsd).toFixed(4));
  const savingsPercentage = cloudBaselineCost > 0 ? Number(((savingsVsCloudUsd / cloudBaselineCost) * 100).toFixed(1)) : 0;
  const withinBudget = spec.maxBudgetUsd !== undefined ? totalEstimatedCostUsd <= spec.maxBudgetUsd : true;

  if (!withinBudget) {
    logger.warn('ARBITRAGE_BUDGET_EXCEEDED', { totalEstimatedCostUsd, budgetLimitUsd: spec.maxBudgetUsd });
  }

  const decisionReason = buildArbitrageDecisionReason({
    duration,
    selectedStages,
    isMekongGpuAccelerated,
    savingsPercentage,
    withinBudget,
    totalEstimatedCostUsd,
    maxBudgetUsd: spec.maxBudgetUsd,
  });

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