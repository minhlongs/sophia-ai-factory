/**
 * LLM Router — Qwen vs Claude tier routing
 *
 * Tier routing:
 *   lite     → Qwen 3 32B (localhost:11434) → fallback Claude Haiku
 *   standard → Qwen 3 32B → fallback Claude Haiku
 *   max      → Claude Sonnet/Opus directly
 *
 * Circuit breaker: delegated to @/seed/security/circuit-breaker, keyed per provider.
 */

import { estimateCost, getCostForModel } from '@/tree/agent-fleet/llm-cost-tracker';
import { callClaude, callQwen, _resetCircuit } from './llm-provider-clients';

export type { TenantUsage } from '@/tree/agent-fleet/llm-cost-tracker';
export { MODEL_COSTS, trackUsage, getUsageSummary, _resetUsage } from '@/tree/agent-fleet/llm-cost-tracker';
export { _resetCircuit };

export type LLMTier = 'lite' | 'standard' | 'max';

export interface LLMRouteOptions {
  anthropicApiKey?: string;
  qwenBaseUrl?: string;
  qwenTimeoutMs?: number;
  maxModel?: string;
  haikuModel?: string;
}

export interface LLMRouteResult {
  text: string;
  model: string;
  provider: 'qwen' | 'claude';
  tier: LLMTier;
  costPer1kInput: number;
  costPer1kOutput: number;
  estimatedCostUsd: number;
}

// ── Routing ─────────────────────────────────────────────────────────────────

function buildResult(
  text: string,
  model: string,
  provider: 'qwen' | 'claude',
  tier: LLMTier,
  prompt: string,
): LLMRouteResult {
  const costs = getCostForModel(model);
  const inputTokens = Math.ceil(prompt.length / 4);
  const outputTokens = Math.ceil(text.length / 4);
  return {
    text,
    model,
    provider,
    tier,
    costPer1kInput: costs.input,
    costPer1kOutput: costs.output,
    estimatedCostUsd: estimateCost(model, inputTokens, outputTokens),
  };
}

export async function routeLLM(
  tier: LLMTier,
  prompt: string,
  opts: LLMRouteOptions = {},
): Promise<LLMRouteResult> {
  const qwenBaseUrl = opts.qwenBaseUrl ?? process.env.QWEN_BASE_URL ?? 'http://localhost:11434';
  const qwenTimeoutMs = opts.qwenTimeoutMs ?? 3_000;
  const apiKey = opts.anthropicApiKey ?? process.env.ANTHROPIC_API_KEY ?? '';
  const maxModel = opts.maxModel ?? 'claude-sonnet-4-5';
  const haikuModel = opts.haikuModel ?? 'claude-haiku-3-5';

  if (tier === 'max') {
    const text = await callClaude(prompt, maxModel, apiKey);
    return buildResult(text, maxModel, 'claude', tier, prompt);
  }

  const circuitEnabled = process.env.DISABLE_LLM_CIRCUIT_BREAKER !== 'true';
  try {
    const text = await callQwen(prompt, qwenBaseUrl, qwenTimeoutMs, circuitEnabled);
    return {
      text,
      model: 'qwen3:32b',
      provider: 'qwen',
      tier,
      costPer1kInput: 0,
      costPer1kOutput: 0,
      estimatedCostUsd: 0,
    };
  } catch {
    // Qwen unavailable or circuit open — fall through to Claude Haiku
  }

  const text = await callClaude(prompt, haikuModel, apiKey);
  return buildResult(text, haikuModel, 'claude', tier, prompt);
}

export async function routeWithBudget(
  prompt: string,
  budgetUsd: number,
  opts: LLMRouteOptions = {},
): Promise<LLMRouteResult> {
  const inputTokens = Math.ceil(prompt.length / 4);
  const estimatedOutputTokens = Math.min(inputTokens * 2, 4096);

  const tiers: LLMTier[] = ['lite', 'standard', 'max'];
  for (const tier of tiers) {
    const model = tier === 'max' ? (opts.maxModel ?? 'claude-sonnet-4-5') : 'qwen3:32b';
    const cost = estimateCost(model, inputTokens, estimatedOutputTokens);
    if (cost <= budgetUsd) return routeLLM(tier, prompt, opts);
  }

  return routeLLM('lite', prompt, opts);
}
