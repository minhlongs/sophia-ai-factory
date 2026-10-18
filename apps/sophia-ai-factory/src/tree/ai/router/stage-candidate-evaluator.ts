/**
 * Stage Candidate Evaluator & Decision Reason Formatter for Multimodal Cost Router
 *
 * Layer: tree/ai/router
 */

import { getState, shouldAllowRequest } from '@/seed/security/circuit-breaker';
import type {
  ArbitrageStrategy,
  CostArbitrageDecision,
  EconomicsProviderId,
  PipelineStage,
  StageProviderOption,
  StageSelection,
  VideoPipelineSpec,
} from '@/seed/types/unit-economics-types';
import { estimateStageCost } from './cost-calculator';

export interface StageCandidateSelectionResult {
  selection: StageSelection;
  isMekongProvider: boolean;
}

/**
 * Evaluates and ranks provider candidates for a single pipeline stage.
 */
export function selectBestStageCandidate(params: {
  stage: PipelineStage;
  candidates: StageProviderOption[];
  spec: VideoPipelineSpec;
  strategy: ArbitrageStrategy;
  edgeAvailable: boolean;
  tenantKeyRef: string;
}): StageCandidateSelectionResult {
  const { stage, candidates, spec, strategy, edgeAvailable, tenantKeyRef } = params;

  const evaluatedCandidates = candidates
    .filter((candidate) => {
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

  evaluatedCandidates.sort((a, b) => {
    if (a.isHealthy !== b.isHealthy) {
      return a.isHealthy ? -1 : 1;
    }
    if (strategy === 'quality_priority' && !a.candidate.isUnmetered && !b.candidate.isUnmetered) {
      return b.cost - a.cost;
    }
    return a.cost - b.cost;
  });

  const chosen = evaluatedCandidates[0];
  if (!chosen) {
    throw new Error(`No eligible providers for ${stage} stage`);
  }

  return {
    selection: {
      stage,
      provider: chosen.candidate.provider as EconomicsProviderId,
      model: chosen.candidate.model,
      estimatedCostUsd: chosen.cost,
      isUnmetered: chosen.candidate.isUnmetered,
      circuitState: chosen.circuitState,
    },
    isMekongProvider: chosen.candidate.provider === 'mekong',
  };
}

/**
 * Formats the human-readable arbitrage decision explanation.
 */
export function buildArbitrageDecisionReason(params: {
  duration: number;
  selectedStages: CostArbitrageDecision['selectedStages'];
  isMekongGpuAccelerated: boolean;
  savingsPercentage: number;
  withinBudget: boolean;
  totalEstimatedCostUsd: number;
  maxBudgetUsd?: number;
}): string {
  const {
    duration,
    selectedStages,
    isMekongGpuAccelerated,
    savingsPercentage,
    withinBudget,
    totalEstimatedCostUsd,
    maxBudgetUsd,
  } = params;

  let decisionReason = `Arbitraged ${duration}s pipeline: ${selectedStages.script.model} ($${selectedStages.script.estimatedCostUsd}), ${selectedStages.visuals.model} ($${selectedStages.visuals.estimatedCostUsd}), ${selectedStages.audio.model} ($${selectedStages.audio.estimatedCostUsd}), ${selectedStages.render.model} ($${selectedStages.render.estimatedCostUsd}).`;

  if (isMekongGpuAccelerated) {
    decisionReason += ` Accelerated via unmetered Mekong GPU Edge (${savingsPercentage}% savings vs cloud).`;
  } else {
    decisionReason += ` Cloud BYOK routing (${selectedStages.script.provider}/${selectedStages.visuals.provider}/${selectedStages.audio.provider}).`;
  }

  if (!withinBudget) {
    decisionReason += ` Warning: Cost $${totalEstimatedCostUsd} exceeds budget $${maxBudgetUsd}.`;
  }

  return decisionReason;
}
