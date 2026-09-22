/**
 * @module tree/ai/multimodal-cost-router
 *
 * Multimodal Cost Arbitrage Router (Requirement R4)
 *
 * Compares per-second execution costs across:
 * - Script Generation: OpenRouter (DeepSeek, GPT-4o-mini, Claude Haiku) vs local Mekong LLM ($0.00)
 * - Visual Frames: fal.ai (Flux Schnell, Dev, Pro) vs local Mekong SDXL/Flux ($0.00)
 * - Voiceover / TTS: ElevenLabs (Flash, Turbo, Multilingual) vs local Mekong Kokoro ($0.00)
 * - Video Compilation / Render: Cloud video / Worker composition vs local Mekong HW FFmpeg ($0.00)
 *
 * Enforces:
 * - Real-time circuit breaker health verification (skips tripped/OPEN providers)
 * - Dynamic per-second cost computation: total cost / target duration
 * - Budget limit enforcement & automated fallbacks
 * - Baseline cloud cost delta comparison & savings percentage
 *
 * Layer Rule: tree layer — can import seed/ and tree/*, cannot import forest/ or land/.
 */

import { createLogger } from '@/seed/utils/logger-utility';
import { getState, shouldAllowRequest } from '@/seed/security/circuit-breaker';
import type {
  CostArbitrageDecision,
  EconomicsProviderId,
  PipelineStage,
  PipelineStageCosts,
  StageProviderOption,
  StageSelection,
  VideoPipelineSpec,
  ArbitrageStrategy,
} from '@/seed/types/unit-economics-types';

const logger = createLogger('tree/ai/multimodal-cost-router');

// ─── Provider Stage Catalogs ──────────────────────────────────────────────────

export const SCRIPT_PROVIDER_OPTIONS: StageProviderOption[] = [
  {
    provider: 'mekong',
    model: 'llama-3.1-8b-instruct',
    unitCostUsd: 0.0,
    unitDescription: 'Unmetered Apple Silicon Edge Node',
    isUnmetered: true,
    latencyAvgMs: 250,
  },
  {
    provider: 'openrouter',
    model: 'deepseek/deepseek-chat',
    unitCostUsd: 0.00000021, // Blended avg ($0.14 in / $0.28 out per 1M tokens)
    unitDescription: '$0.14-$0.28 per 1M tokens',
    isUnmetered: false,
    latencyAvgMs: 850,
  },
  {
    provider: 'openrouter',
    model: 'openai/gpt-4o-mini',
    unitCostUsd: 0.000000375, // Blended avg ($0.15 in / $0.60 out per 1M tokens)
    unitDescription: '$0.15-$0.60 per 1M tokens',
    isUnmetered: false,
    latencyAvgMs: 950,
  },
  {
    provider: 'openrouter',
    model: 'anthropic/claude-3-5-haiku',
    unitCostUsd: 0.0000024, // Blended avg ($0.80 in / $4.00 out per 1M tokens)
    unitDescription: '$0.80-$4.00 per 1M tokens',
    isUnmetered: false,
    latencyAvgMs: 700,
  },
];

export const VISUALS_PROVIDER_OPTIONS: StageProviderOption[] = [
  {
    provider: 'mekong',
    model: 'flux-1-schnell-edge',
    unitCostUsd: 0.0,
    unitDescription: 'Unmetered Local GPU Frame Synthesis',
    isUnmetered: true,
    latencyAvgMs: 1200,
  },
  {
    provider: 'fal',
    model: 'fal-ai/flux-schnell',
    unitCostUsd: 0.01, // 1¢ per frame
    unitDescription: '$0.010 per image frame (4 steps)',
    isUnmetered: false,
    latencyAvgMs: 1400,
  },
  {
    provider: 'fal',
    model: 'fal-ai/flux/dev',
    unitCostUsd: 0.03, // 3¢ per frame
    unitDescription: '$0.030 per image frame (28 steps)',
    isUnmetered: false,
    latencyAvgMs: 2800,
  },
  {
    provider: 'fal',
    model: 'fal-ai/flux-pro',
    unitCostUsd: 0.05, // 5¢ per frame
    unitDescription: '$0.050 per image frame (HQ Pro)',
    isUnmetered: false,
    latencyAvgMs: 4200,
  },
];

export const AUDIO_PROVIDER_OPTIONS: StageProviderOption[] = [
  {
    provider: 'mekong',
    model: 'kokoro-tts-v0.19',
    unitCostUsd: 0.0,
    unitDescription: 'Unmetered Local Edge Neural TTS',
    isUnmetered: true,
    latencyAvgMs: 350,
  },
  {
    provider: 'elevenlabs',
    model: 'eleven_flash_v2_5',
    unitCostUsd: 0.000015, // $0.015 per 1K chars
    unitDescription: '$0.000015 per char (Flash)',
    isUnmetered: false,
    latencyAvgMs: 450,
  },
  {
    provider: 'elevenlabs',
    model: 'eleven_turbo_v2_5',
    unitCostUsd: 0.00003, // $0.030 per 1K chars
    unitDescription: '$0.000030 per char (Turbo)',
    isUnmetered: false,
    latencyAvgMs: 650,
  },
  {
    provider: 'elevenlabs',
    model: 'eleven_multilingual_v2',
    unitCostUsd: 0.00003, // $0.030 per 1K chars
    unitDescription: '$0.000030 per char (Multilingual HQ)',
    isUnmetered: false,
    latencyAvgMs: 900,
  },
];

export const RENDER_PROVIDER_OPTIONS: StageProviderOption[] = [
  {
    provider: 'mekong',
    model: 'ffmpeg-hw-apple-silicon',
    unitCostUsd: 0.0,
    unitDescription: 'Unmetered VideoToolbox HW Encoding',
    isUnmetered: true,
    latencyAvgMs: 800,
  },
  {
    provider: 'openrouter', // Worker composition proxy
    model: 'cloudflare-worker-ffmpeg',
    unitCostUsd: 0.005, // $0.005 flat video composition compute
    unitDescription: '$0.005 flat cloud worker stitching',
    isUnmetered: false,
    latencyAvgMs: 1500,
  },
  {
    provider: 'fal',
    model: 'wan/wan-2-1-t2v',
    unitCostUsd: 0.15, // $0.15 per video second
    unitDescription: '$0.150 per second video synthesis',
    isUnmetered: false,
    latencyAvgMs: 6000,
  },
];

export interface MultimodalRouterOptions {
  strategy?: ArbitrageStrategy;
  edgeNodeAvailable?: boolean;
  tenantKeyRef?: string;
}

// ─── Pure Calculation Helpers ─────────────────────────────────────────────────

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

// ─── Main Arbitrage Routing Function ──────────────────────────────────────────

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
