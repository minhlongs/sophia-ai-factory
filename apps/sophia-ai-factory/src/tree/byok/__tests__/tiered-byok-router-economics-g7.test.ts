/**
 * Gate G7 — Deterministic Offline Benchmark for Tiered BYOK Router Economics ($0 Live Spend)
 *
 * Evaluates actual routing decisions across reproducible Sophia workload prompts:
 *   - json_extraction
 *   - qa_validation
 *   - creative_script
 *   - tool_agent
 *
 * Uses exact public OpenRouter per-1M token input/output pricing (Nov 2026):
 *   - anthropic/claude-sonnet-4.5 : $3.00 / 1M input, $15.00 / 1M output ($1.50 cached input)
 *   - openai/gpt-4o               : $2.50 / 1M input, $10.00 / 1M output
 *   - openai/gpt-4o-mini          : $0.15 / 1M input, $0.60 / 1M output
 *   - google/gemini-2.5-flash-lite: $0.10 / 1M input, $0.40 / 1M output
 */

import { beforeEach, describe, expect, it } from 'vitest';
import { reset as resetCircuitBreaker } from '@/seed/security/circuit-breaker';
import { FailureKind } from '@/seed/types/failure-kind';
import {
  clearModelLockouts,
  COMPACT_FALLBACK_MODEL,
  COMPACT_PRIMARY_MODEL,
  FRONTIER_FALLBACK_MODEL,
  FRONTIER_PRIMARY_MODEL,
  recordTieredRouteOutcome,
  sanitizeToolChoiceForRoute,
  selectTieredByokRoute,
  type ByokTaskComplexity,
} from '@/tree/byok';

interface ModelRate {
  readonly inputPer1M: number;
  readonly outputPer1M: number;
  readonly cachedInputPer1M?: number;
}

const PUBLIC_OPENROUTER_RATES: Readonly<Record<string, ModelRate>> = {
  [FRONTIER_PRIMARY_MODEL]: { inputPer1M: 3.0, outputPer1M: 15.0, cachedInputPer1M: 0.3 },
  [FRONTIER_FALLBACK_MODEL]: { inputPer1M: 2.5, outputPer1M: 10.0 },
  [COMPACT_PRIMARY_MODEL]: { inputPer1M: 0.15, outputPer1M: 0.6 },
  [COMPACT_FALLBACK_MODEL]: { inputPer1M: 0.1, outputPer1M: 0.4 },
};

interface BenchmarkTask {
  readonly id: string;
  readonly taskKind: ByokTaskComplexity;
  readonly callsPerVideoPipeline: number;
  readonly inputTokens: number;
  readonly cachedSystemTokens: number;
  readonly outputTokens: number;
}

/**
 * Canonical 1-video Sophia generation pipeline workload:
 *   - 3x json_extraction (product brief, scene JSON schema, metadata tags)
 *   - 2x qa_validation (compliance & brand-voice rubric checks)
 *   - 1x creative_script (hook + storyboard scriptwriting with cacheable system prompt)
 *   - 1x tool_agent (affiliate link & channel orchestrator with tool_choice)
 */
const CANONICAL_VIDEO_PIPELINE_TASKS: readonly BenchmarkTask[] = [
  {
    id: 'extract_product_brief_and_scenes',
    taskKind: 'json_extraction',
    callsPerVideoPipeline: 3,
    inputTokens: 1_800,
    cachedSystemTokens: 0,
    outputTokens: 650,
  },
  {
    id: 'qa_rubric_and_compliance_gate',
    taskKind: 'qa_validation',
    callsPerVideoPipeline: 2,
    inputTokens: 1_500,
    cachedSystemTokens: 0,
    outputTokens: 400,
  },
  {
    id: 'creative_hook_and_script',
    taskKind: 'creative_script',
    callsPerVideoPipeline: 1,
    inputTokens: 900,
    cachedSystemTokens: 1_600,
    outputTokens: 1_100,
  },
  {
    id: 'tool_agent_channel_orchestrator',
    taskKind: 'tool_agent',
    callsPerVideoPipeline: 1,
    inputTokens: 1_100,
    cachedSystemTokens: 1_400,
    outputTokens: 700,
  },
];

function computeCallCostUsd(model: string, task: BenchmarkTask, usePromptCache: boolean): number {
  const rate = PUBLIC_OPENROUTER_RATES[model];
  if (!rate) throw new Error(`Missing rate for ${model}`);
  const cachedIn = usePromptCache && rate.cachedInputPer1M !== undefined ? task.cachedSystemTokens : 0;
  const uncachedIn = task.inputTokens + (task.cachedSystemTokens - cachedIn);
  return (
    (uncachedIn / 1_000_000) * rate.inputPer1M +
    (cachedIn / 1_000_000) * (rate.cachedInputPer1M ?? rate.inputPer1M) +
    (task.outputTokens / 1_000_000) * rate.outputPer1M
  );
}

describe('Gate G7 — Tiered BYOK Router Economics & Isolation Benchmark', () => {
  beforeEach(() => {
    resetCircuitBreaker('openrouter', 'tenant_bench_1');
    resetCircuitBreaker('openrouter', 'tenant_A');
    resetCircuitBreaker('openrouter', 'tenant_B');
    clearModelLockouts();
  });

  it('measures per-task and blended pipeline cost vs single-frontier baseline honestly', () => {
    let baselineTotalUsd = 0;
    let tieredNoCacheTotalUsd = 0;
    let tieredWithCacheTotalUsd = 0;
    let totalInputTokens = 0;
    let totalOutputTokens = 0;

    const perKindSavingsPct: Record<ByokTaskComplexity, number> = {
      json_extraction: 0,
      qa_validation: 0,
      creative_script: 0,
      tool_agent: 0,
    };

    for (const task of CANONICAL_VIDEO_PIPELINE_TASKS) {
      const route = selectTieredByokRoute({
        taskKind: task.taskKind,
        baselineModel: FRONTIER_PRIMARY_MODEL,
        provider: 'openrouter',
        keyRef: 'tenant_bench_1',
        systemPromptCacheable: task.cachedSystemTokens > 0,
        nowMs: 1_763_164_800_000,
      });

      const baseCall = computeCallCostUsd(FRONTIER_PRIMARY_MODEL, task, false);
      const tieredNoCacheCall = computeCallCostUsd(route.model, task, false);
      const tieredCacheCall = computeCallCostUsd(route.model, task, route.cacheControl === 'ephemeral');

      perKindSavingsPct[task.taskKind] = Number((((baseCall - tieredCacheCall) / baseCall) * 100).toFixed(2));

      baselineTotalUsd += baseCall * task.callsPerVideoPipeline;
      tieredNoCacheTotalUsd += tieredNoCacheCall * task.callsPerVideoPipeline;
      tieredWithCacheTotalUsd += tieredCacheCall * task.callsPerVideoPipeline;
      totalInputTokens += (task.inputTokens + task.cachedSystemTokens) * task.callsPerVideoPipeline;
      totalOutputTokens += task.outputTokens * task.callsPerVideoPipeline;
    }

    const blendedSavingsNoCachePct = ((baselineTotalUsd - tieredNoCacheTotalUsd) / baselineTotalUsd) * 100;
    const blendedSavingsWithCachePct = ((baselineTotalUsd - tieredWithCacheTotalUsd) / baselineTotalUsd) * 100;

    // Compact tasks save ~95.6%; frontier tasks save 0% uncached or 18-21% with prompt cache.
    expect(perKindSavingsPct.json_extraction).toBe(95.64);
    expect(perKindSavingsPct.qa_validation).toBe(95.57);
    expect(perKindSavingsPct.creative_script).toBe(18);
    expect(perKindSavingsPct.tool_agent).toBe(21);

    // 7-call canonical 1-video pipeline (5 compact + 2 frontier):
    //   Baseline (all claude-sonnet-4.5): $0.108450
    //   Tiered (uncached):                $0.044910 -> 58.59% savings
    //   Tiered (with prompt cache):       $0.036810 -> 66.06% savings
    expect(totalInputTokens).toBe(13_400);
    expect(totalOutputTokens).toBe(4_550);
    expect(Number(baselineTotalUsd.toFixed(6))).toBe(0.10845);
    expect(Number(tieredNoCacheTotalUsd.toFixed(6))).toBe(0.04491);
    expect(Number(tieredWithCacheTotalUsd.toFixed(6))).toBe(0.03681);
    expect(Number(blendedSavingsNoCachePct.toFixed(2))).toBe(58.59);
    expect(Number(blendedSavingsWithCachePct.toFixed(2))).toBe(66.06);

    // Equal-weight 1:1:1:1 sensitivity check (if a customer runs 1 call of each kind):
    //   Baseline = 0.01515 + 0.01050 + 0.02400 + 0.01800 = $0.067650
    //   Tiered uncached = 0.00066 + 0.000465 + 0.02400 + 0.01800 = $0.043125 -> 36.25% (<55%!)
    const equalWeightBase = 0.01515 + 0.0105 + 0.024 + 0.018;
    const equalWeightUncached = 0.00066 + 0.000465 + 0.024 + 0.018;
    const equalWeightSavingsPct = ((equalWeightBase - equalWeightUncached) / equalWeightBase) * 100;
    expect(Number(equalWeightSavingsPct.toFixed(2))).toBe(36.25);
  });

  it('isolates circuit breakers and model lockouts per tenant keyRef and prevents expensive fallback loops', () => {
    const nowMs = 1_763_164_800_000;

    // Tenant A hits rate-limit on compact primary -> shifts to CHEAPER compact fallback ($0.10/$0.40), NOT expensive frontier!
    recordTieredRouteOutcome({
      provider: 'openrouter',
      keyRef: 'tenant_A',
      model: COMPACT_PRIMARY_MODEL,
      ok: false,
      failureKind: FailureKind.RATE_LIMIT,
      lockoutMs: 60_000,
    });

    const routeA1 = selectTieredByokRoute({
      taskKind: 'json_extraction',
      provider: 'openrouter',
      keyRef: 'tenant_A',
      nowMs: nowMs + 1_000,
    });
    // Tenant B remains completely unaffected (primary_selected)
    const routeB = selectTieredByokRoute({
      taskKind: 'json_extraction',
      provider: 'openrouter',
      keyRef: 'tenant_B',
      nowMs: nowMs + 1_000,
    });

    expect(routeA1.model).toBe(COMPACT_FALLBACK_MODEL);
    expect(routeA1.reason).toBe('primary_locked_out_fallback');
    expect(routeA1.fallbackModel).toBeNull(); // single-hop cap: no uncontrolled fallback loop
    expect(routeB.model).toBe(COMPACT_PRIMARY_MODEL);
    expect(routeB.reason).toBe('primary_selected');

    // If Tenant A's secondary also fails -> resilientAllowed = false (hard stop, zero infinite loop)
    recordTieredRouteOutcome({
      provider: 'openrouter',
      keyRef: 'tenant_A',
      model: COMPACT_FALLBACK_MODEL,
      ok: false,
      failureKind: FailureKind.SERVER_ERROR,
      lockoutMs: 60_000,
    });
    const routeABlocked = selectTieredByokRoute({
      taskKind: 'json_extraction',
      provider: 'openrouter',
      keyRef: 'tenant_A',
      nowMs: nowMs + 2_000,
    });
    expect(routeABlocked.resilientAllowed).toBe(false);
    expect(routeABlocked.reason).toBe('all_candidates_locked_out');

    // Rollback flag `ENABLE_TIERED_BYOK_ROUTER=false` immediately restores direct baseline routing
    const rolledBack = selectTieredByokRoute({
      taskKind: 'json_extraction',
      baselineModel: FRONTIER_PRIMARY_MODEL,
      envFlag: 'false',
    });
    expect(rolledBack).toMatchObject({
      model: FRONTIER_PRIMARY_MODEL,
      tierUsed: 'direct_fallback',
      reason: 'router_disabled',
      resilientAllowed: true,
    });

    // Tool schema & tool_choice compatibility check
    const refusedTools = sanitizeToolChoiceForRoute({
      tools: [{ type: 'function', function: { name: 'lookup_offer' } }],
      toolChoice: 'required',
      capabilities: ['json_schema'],
    });
    expect(refusedTools.ok).toBe(false);
  });
});
