/**
 * LLM cost tracking — per-model pricing + per-tenant usage accumulation.
 * In-memory; resets per CF Worker isolate cold-start.
 */

import type { LLMRouteResult } from './llm-router';

/** USD per 1K tokens — based on Anthropic pricing (May 2026) */
export const MODEL_COSTS: Record<string, { input: number; output: number }> = {
  'qwen3:32b':           { input: 0,       output: 0 },
  'claude-haiku-3-5':    { input: 0.0008,  output: 0.004 },
  'claude-sonnet-4-5':   { input: 0.003,   output: 0.015 },
  'claude-opus-4-5':     { input: 0.015,   output: 0.075 },
};

export function estimateCost(model: string, inputTokens: number, outputTokens: number): number {
  const costs = MODEL_COSTS[model] ?? { input: 0.003, output: 0.015 };
  return (inputTokens / 1000) * costs.input + (outputTokens / 1000) * costs.output;
}

export function getCostForModel(model: string): { input: number; output: number } {
  return MODEL_COSTS[model] ?? { input: 0.003, output: 0.015 };
}

// ── Per-tenant usage tracking ───────────────────────────────────────────────

export interface TenantUsage {
  totalCostUsd: number;
  callCount: number;
  byModel: Record<string, { calls: number; costUsd: number }>;
}

const _usageMap = new Map<string, TenantUsage>();

export function trackUsage(tenantId: string, result: LLMRouteResult): void {
  const existing = _usageMap.get(tenantId) ?? { totalCostUsd: 0, callCount: 0, byModel: {} };
  existing.totalCostUsd += result.estimatedCostUsd;
  existing.callCount += 1;
  const modelEntry = existing.byModel[result.model] ?? { calls: 0, costUsd: 0 };
  modelEntry.calls += 1;
  modelEntry.costUsd += result.estimatedCostUsd;
  existing.byModel[result.model] = modelEntry;
  _usageMap.set(tenantId, existing);
}

export function getUsageSummary(tenantId: string): TenantUsage | null {
  return _usageMap.get(tenantId) ?? null;
}

export function _resetUsage(): void {
  _usageMap.clear();
}
