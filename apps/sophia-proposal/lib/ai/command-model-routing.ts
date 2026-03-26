/**
 * Command Model Routing — Per-command LLM model selection.
 *
 * Supports 2 modes:
 * 1. LOCAL MLX (Apple Silicon): Set LLM_BASE_URL → uses MLX models on M1/M2/M3 Max
 * 2. CLOUD API: Set ANTHROPIC_API_KEY → uses Claude models
 *
 * Local MLX setup (client's M1 Max):
 *   LLM_BASE_URL=http://localhost:11436/v1   (Nemotron-30B for fast tasks)
 *   LLM_BASE_URL_HEAVY=http://localhost:11435/v1  (DeepSeek-R1-32B for reasoning)
 *   LLM_MODEL=mlx-community/NVIDIA-Nemotron-3-Nano-30B-A3B-4bit
 *   LLM_MODEL_HEAVY=mlx-community/DeepSeek-R1-Distill-Qwen-32B-4bit
 */

// ── Types ────────────────────────────────────────────────────────────────────

export type CommandName =
  | 'proposal:create'
  | 'video:create'
  | 'content:blog'
  | 'content:social'
  | 'crm:sync'
  | 'analytics:export'
  | 'gtm:campaign'
  | 'sales:battlecard'
  | 'sales:proposal-deck'
  | 'sales:roi-calculator'
  | 'sales:competitor-analysis'
  | 'sales:pricing-optimizer'
  | 'sales:outreach-sequence'
  | 'lead:generate'
  | 'email:send';

export interface ModelConfig {
  model: string;
  maxTokens: number;
  estimatedMcuCost: number;
  tier: 'fast' | 'default' | 'heavy';
}

// ── Model Resolution ─────────────────────────────────────────────────────────

// MLX local defaults (Apple Silicon M1/M2/M3 Max)
const MLX_FAST = 'mlx-community/NVIDIA-Nemotron-3-Nano-30B-A3B-4bit';
const MLX_HEAVY = 'mlx-community/DeepSeek-R1-Distill-Qwen-32B-4bit';

// Cloud API fallbacks
const CLOUD_FAST = 'claude-haiku-4-5-20251001';
const CLOUD_DEFAULT = 'claude-sonnet-4-6-20250514';
const CLOUD_HEAVY = 'claude-opus-4-6';

/** Resolve model ID based on tier + environment */
function resolveModel(tier: 'fast' | 'default' | 'heavy'): string {
  const isLocal = !!process.env.LLM_BASE_URL;

  if (isLocal) {
    // MLX local: fast=Nemotron, default=Nemotron, heavy=DeepSeek-R1
    const envModel = tier === 'heavy'
      ? process.env.LLM_MODEL_HEAVY
      : process.env.LLM_MODEL;
    return envModel ?? (tier === 'heavy' ? MLX_HEAVY : MLX_FAST);
  }

  // Cloud API: fast=Haiku, default=Sonnet, heavy=Opus
  switch (tier) {
    case 'fast': return CLOUD_FAST;
    case 'heavy': return CLOUD_HEAVY;
    default: return CLOUD_DEFAULT;
  }
}

// ── Routing Table ────────────────────────────────────────────────────────────

const TIER_MAP: Record<CommandName, { tier: 'fast' | 'default' | 'heavy'; maxTokens: number; mcu: number }> = {
  // Fast — simple/short tasks (Nemotron-30B or Haiku)
  'email:send':               { tier: 'fast',    maxTokens: 1000, mcu: 0.01 },
  'content:social':           { tier: 'fast',    maxTokens: 1000, mcu: 0.01 },

  // Default — most tasks (Nemotron-30B or Sonnet)
  'proposal:create':          { tier: 'default', maxTokens: 2000, mcu: 0.06 },
  'video:create':             { tier: 'default', maxTokens: 2000, mcu: 0.06 },
  'content:blog':             { tier: 'default', maxTokens: 2000, mcu: 0.06 },
  'crm:sync':                 { tier: 'default', maxTokens: 1500, mcu: 0.05 },
  'analytics:export':         { tier: 'default', maxTokens: 1500, mcu: 0.05 },
  'gtm:campaign':             { tier: 'default', maxTokens: 2000, mcu: 0.06 },
  'sales:battlecard':         { tier: 'default', maxTokens: 2000, mcu: 0.06 },
  'sales:proposal-deck':      { tier: 'default', maxTokens: 2000, mcu: 0.06 },
  'sales:roi-calculator':     { tier: 'default', maxTokens: 1500, mcu: 0.05 },
  'sales:pricing-optimizer':  { tier: 'default', maxTokens: 1500, mcu: 0.05 },
  'sales:outreach-sequence':  { tier: 'default', maxTokens: 2000, mcu: 0.06 },
  'lead:generate':            { tier: 'default', maxTokens: 3000, mcu: 0.08 },

  // Heavy — deep reasoning (DeepSeek-R1-32B or Opus)
  'sales:competitor-analysis': { tier: 'heavy', maxTokens: 3000, mcu: 0.15 },
};

const DEFAULT_TIER = { tier: 'default' as const, maxTokens: 2000, mcu: 0.06 };

// ── Public API ────────────────────────────────────────────────────────────────

export function getModelConfig(command: CommandName): ModelConfig {
  const entry = TIER_MAP[command] ?? DEFAULT_TIER;
  return {
    model: resolveModel(entry.tier),
    maxTokens: entry.maxTokens,
    estimatedMcuCost: entry.mcu,
    tier: entry.tier,
  };
}

export function getModelForCommand(command: string): string {
  const entry = TIER_MAP[command as CommandName] ?? DEFAULT_TIER;
  return resolveModel(entry.tier);
}

export function getMaxTokensForCommand(command: string): number {
  return TIER_MAP[command as CommandName]?.maxTokens ?? DEFAULT_TIER.maxTokens;
}

/** Get the LLM base URL for a given tier (for direct HTTP calls) */
export function getLlmBaseUrl(tier: 'fast' | 'default' | 'heavy' = 'default'): string | null {
  if (tier === 'heavy') {
    return process.env.LLM_BASE_URL_HEAVY ?? process.env.LLM_BASE_URL ?? null;
  }
  return process.env.LLM_BASE_URL ?? null;
}
