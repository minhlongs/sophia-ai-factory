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
