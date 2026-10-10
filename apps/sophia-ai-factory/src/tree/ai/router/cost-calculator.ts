/**
 * Cost Arbitrage Math & Baseline Calculations
 *
 * Layer: tree/ai/router
 */

import type {
  CostArbitrageDecision,
  PipelineStage,
  PipelineStageCosts,
  StageProviderOption,
  VideoPipelineSpec,
} from '@/seed/types/unit-economics-types';

/**
 * Computes individual stage estimated cost based on spec parameters.
 */
export function estimateStageCost(
  stage: PipelineStage,
  option: StageProviderOption,
  spec: VideoPipelineSpec,
): number {
  if (option.isUnmetered) {
    return 0.0;
  }

  const duration = Math.max(1, spec.targetDurationSeconds);

  switch (stage) {
    case 'script': {
      const promptTokens = spec.scriptPromptTokens ?? 1200;
      const completionTokens = spec.scriptCompletionTokens ?? 400;
      const totalTokens = promptTokens + completionTokens;
      return Number((totalTokens * option.unitCostUsd).toFixed(6));
    }
    case 'visuals': {
      const frameCount = spec.frameCount ?? Math.max(1, Math.ceil(duration / 5));
      return Number((frameCount * option.unitCostUsd).toFixed(4));
    }
    case 'audio': {
      const charCount = spec.audioCharacterCount ?? Math.round(duration * 14);
      return Number((charCount * option.unitCostUsd).toFixed(6));
    }
    case 'render': {
      if (option.model === 'wan/wan-2-1-t2v') {
        return Number((duration * option.unitCostUsd).toFixed(4));
      }
      return Number(option.unitCostUsd.toFixed(4));
    }
    default:
      return 0.0;
  }
}

/**
 * Returns baseline purely cloud costs (no edge acceleration) for benchmarking savings.
 */
export function calculateCloudBaselineCost(spec: VideoPipelineSpec): number {
  const duration = Math.max(1, spec.targetDurationSeconds);
  const promptTokens = spec.scriptPromptTokens ?? 1200;
  const completionTokens = spec.scriptCompletionTokens ?? 400;
  const frameCount = spec.frameCount ?? Math.max(1, Math.ceil(duration / 5));
  const charCount = spec.audioCharacterCount ?? Math.round(duration * 14);

  // Standard production cloud stack:
  // DeepSeek Chat ($0.14/1M in, $0.28/1M out) + fal flux-schnell ($0.01/frame) + ElevenLabs Turbo ($0.00003/char) + Cloud composition ($0.005)
  const scriptCost = (promptTokens + completionTokens) * 0.00000021;
  const visualsCost = frameCount * 0.01;
  const audioCost = charCount * 0.00003;
  const renderCost = 0.005;

  return Number((scriptCost + visualsCost + audioCost + renderCost).toFixed(4));
}

/**
 * Returns breakdown of stage costs for presentation.
 */
export function calculatePipelineStageCosts(
  decision: CostArbitrageDecision,
): PipelineStageCosts {
  return {
    scriptCostUsd: decision.selectedStages.script.estimatedCostUsd,
    visualsCostUsd: decision.selectedStages.visuals.estimatedCostUsd,
    audioCostUsd: decision.selectedStages.audio.estimatedCostUsd,
    renderCostUsd: decision.selectedStages.render.estimatedCostUsd,
    totalPipelineCostUsd: decision.totalEstimatedCostUsd,
    durationSeconds: decision.durationSeconds,
    costPerSecondUsd: decision.costPerSecondUsd,
  };
}
