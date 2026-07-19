/**
 * LLM Router — Qwen vs Claude tier routing
 *
 * Tier routing:
 *   lite     → Qwen 3 32B (localhost:11434) → fallback Claude Haiku
 *   standard → Qwen 3 32B → fallback Claude Haiku
 *   max      → Claude Sonnet/Opus directly
 *
 * Circuit breaker: in-memory, resets after 60s, trips after 3 consecutive fails.
 */

import { MODEL_COSTS, estimateCost, getCostForModel } from './llm-cost-tracker';
import { tokenCounter } from '@/seed/ai/token-counter';
import { ContextWindow } from '@/seed/ai/context-window';

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

const ROUTER_CONTEXT_WINDOW = new ContextWindow();
const ROUTER_SAFETY_BUFFER = 20_000;

function checkRouteBudget(prompt: string, modelId: string): { ok: boolean; tokens: number; limit: number } {
  const tokens = tokenCounter.estimateTokens(prompt).tokens;
  const limitConfig = ROUTER_CONTEXT_WINDOW.getLimit(modelId);
  const safeLimit = limitConfig.contextLimit - ROUTER_SAFETY_BUFFER;
  return { ok: tokens <= safeLimit, tokens, limit: safeLimit };
}

// ── Circuit breaker ─────────────────────────────────────────────────────────

interface CircuitState {
  failures: number;
  openUntil: number;
}

const _circuitState: CircuitState = { failures: 0, openUntil: 0 };
const CIRCUIT_FAILURE_THRESHOLD = 3;
const CIRCUIT_RESET_MS = 60_000;

function isCircuitOpen(): boolean {
  if (_circuitState.openUntil === 0) return false;
  if (Date.now() < _circuitState.openUntil) return true;
  _circuitState.failures = 0;
  _circuitState.openUntil = 0;
  return false;
}

function recordQwenFailure(): void {
  _circuitState.failures += 1;
  if (_circuitState.failures >= CIRCUIT_FAILURE_THRESHOLD) {
    _circuitState.openUntil = Date.now() + CIRCUIT_RESET_MS;
  }
}

function recordQwenSuccess(): void {
  _circuitState.failures = 0;
  _circuitState.openUntil = 0;
}

export function _resetCircuit(): void {
  _circuitState.failures = 0;
  _circuitState.openUntil = 0;
}

export function _getCircuitState(): Readonly<CircuitState> {
  return { ..._circuitState };
}

// ── Provider calls ──────────────────────────────────────────────────────────

async function callQwen(prompt: string, baseUrl: string, timeoutMs: number): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`${baseUrl}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'qwen3:32b', prompt, stream: false }),
      signal: controller.signal,
    });
    clearTimeout(timer);
    if (!res.ok) throw new Error(`Qwen HTTP ${res.status}`);
    const data = await res.json() as { response?: string };
    return data.response ?? '';
  } finally {
    clearTimeout(timer);
  }
}

async function callClaude(prompt: string, model: string, apiKey: string): Promise<string> {
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
  return data.content?.[0]?.text ?? '';
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
    const budget = checkRouteBudget(prompt, maxModel);
    if (!budget.ok) {
      throw new Error(`CONTEXT_OVERFLOW: Prompt tokens (${budget.tokens}) exceed safe limit (${budget.limit}) for ${maxModel}`);
    }
    const text = await callClaude(prompt, maxModel, apiKey);
    return buildResult(text, maxModel, 'claude', tier, prompt);
  }

  const circuitEnabled = process.env.DISABLE_LLM_CIRCUIT_BREAKER !== 'true';
  if (!circuitEnabled || !isCircuitOpen()) {
    try {
      const budget = checkRouteBudget(prompt, 'qwen3:32b');
      if (!budget.ok) {
        throw new Error(`CONTEXT_OVERFLOW: Prompt tokens (${budget.tokens}) exceed safe limit (${budget.limit}) for qwen3:32b`);
      }
      const text = await callQwen(prompt, qwenBaseUrl, qwenTimeoutMs);
      recordQwenSuccess();
      return { text, model: 'qwen3:32b', provider: 'qwen', tier, costPer1kInput: 0, costPer1kOutput: 0, estimatedCostUsd: 0 };
    } catch {
      recordQwenFailure();
    }
  }

  const budget = checkRouteBudget(prompt, haikuModel);
  if (!budget.ok) {
    throw new Error(`CONTEXT_OVERFLOW: Prompt tokens (${budget.tokens}) exceed safe limit (${budget.limit}) for ${haikuModel}`);
  }
  const text = await callClaude(prompt, haikuModel, apiKey);
  return buildResult(text, haikuModel, 'claude', tier, prompt);
}

export async function routeWithBudget(prompt: string, budgetUsd: number, opts: LLMRouteOptions = {}): Promise<LLMRouteResult> {
  const inputTokens = tokenCounter.estimateTokens(prompt).tokens;
  const estimatedOutputTokens = Math.min(inputTokens * 2, 4096);

  const tiers: LLMTier[] = ['lite', 'standard', 'max'];
  for (const tier of tiers) {
    const model = tier === 'max' ? (opts.maxModel ?? 'claude-sonnet-4-5') : 'qwen3:32b';
    const cost = estimateCost(model, inputTokens, estimatedOutputTokens);
    if (cost <= budgetUsd) return routeLLM(tier, prompt, opts);
  }

  return routeLLM('lite', prompt, opts);
}
