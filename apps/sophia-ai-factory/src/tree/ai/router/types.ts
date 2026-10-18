/**
 * Types & Catalogs for Multimodal Cost Arbitrage Router
 *
 * Layer: tree/ai/router
 */

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

export type {
  CostArbitrageDecision,
  EconomicsProviderId,
  PipelineStage,
  PipelineStageCosts,
  StageProviderOption,
  StageSelection,
  VideoPipelineSpec,
  ArbitrageStrategy,
};

export {
  AUDIO_PROVIDER_OPTIONS,
  RENDER_PROVIDER_OPTIONS,
} from './media-provider-catalogs';

export interface MultimodalRouterOptions {
  strategy?: ArbitrageStrategy;
  edgeNodeAvailable?: boolean;
  tenantKeyRef?: string;
}

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
