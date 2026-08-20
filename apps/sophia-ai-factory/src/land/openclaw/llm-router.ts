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

import { estimateCost, getCostForModel } from './llm-cost-tracker';
import { shouldAllowRequest, recordSuccess, recordFailure, reset as resetCircuit } from '@/seed/security/circuit-breaker';
import { classifyError } from '@/seed/types/failure-kind';

export type { TenantUsage } from './llm-cost-tracker';
export { MODEL_COSTS, trackUsage, getUsageSummary, _resetUsage } from './llm-cost-tracker';

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

// ── Circuit breaker (delegated to seed circuit breaker) ──────────────────────
const QWEN_SERVICE = 'qwen-local'
const ANTHROPIC_SERVICE = 'anthropic-direct'

export function _resetCircuit(): void {
  resetCircuit(QWEN_SERVICE)
  resetCircuit(ANTHROPIC_SERVICE)
}

// ── Provider calls ──────────────────────────────────────────────────────────

async function callQwen(prompt: string, baseUrl: string, timeoutMs: number, circuitEnabled: boolean): Promise<string> {
  if (circuitEnabled && !shouldAllowRequest(QWEN_SERVICE)) {
    throw new Error('Circuit open for qwen-local');
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`${baseUrl}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'qwen3:32b', prompt: `You must respond in English only. Never respond in Chinese.\n\n${prompt}`, stream: false }),
      signal: controller.signal,
    });
    clearTimeout(timer);
    if (!res.ok) throw new Error(`Qwen HTTP ${res.status}`);
    const data = await res.json() as { response?: string };
    recordSuccess(QWEN_SERVICE);
    return data.response ?? '';
  } catch (err) {
    recordFailure(QWEN_SERVICE, classifyError(err));
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

async function callClaude(prompt: string, model: string, apiKey: string): Promise<string> {
  if (!shouldAllowRequest(ANTHROPIC_SERVICE)) {
    throw new Error('Circuit open for anthropic-direct');
  }
  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model,
        max_tokens: 4096,
        messages: [{ role: 'user', content: prompt }],
      }),
    });
    if (!res.ok) throw new Error(`Anthropic HTTP ${res.status}`);
    const data = await res.json() as { content?: { text?: string }[] };
    recordSuccess(ANTHROPIC_SERVICE);
    return data.content?.[0]?.text ?? '';
  } catch (err) {
    recordFailure(ANTHROPIC_SERVICE, classifyError(err));
    throw err;
  }
}

// ── Routing ─────────────────────────────────────────────────────────────────

function buildResult(text: string, model: string, provider: 'qwen' | 'claude', tier: LLMTier, prompt: string): LLMRouteResult {
  const costs = getCostForModel(model);
  const inputTokens = Math.ceil(prompt.length / 4);
  const outputTokens = Math.ceil(text.length / 4);
  return {
    text, model, provider, tier,
    costPer1kInput: costs.input, costPer1kOutput: costs.output,
    estimatedCostUsd: estimateCost(model, inputTokens, outputTokens),
  };
}

export async function routeLLM(tier: LLMTier, prompt: string, opts: LLMRouteOptions = {}): Promise<LLMRouteResult> {
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
    return { text, model: 'qwen3:32b', provider: 'qwen', tier, costPer1kInput: 0, costPer1kOutput: 0, estimatedCostUsd: 0 };
  } catch {
    // Qwen unavailable or circuit open — fall through to Claude Haiku
  }

  const text = await callClaude(prompt, haikuModel, apiKey);
  return buildResult(text, haikuModel, 'claude', tier, prompt);
}

export async function routeWithBudget(prompt: string, budgetUsd: number, opts: LLMRouteOptions = {}): Promise<LLMRouteResult> {
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
