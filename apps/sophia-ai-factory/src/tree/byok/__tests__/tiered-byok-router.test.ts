import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { reset as resetCircuitBreaker, shouldAllowRequest } from '@/seed/security/circuit-breaker';
import { FailureKind } from '@/seed/types/failure-kind';
import { callLlmWithTools } from '@/app/api/v1/agent-chat/agent-chat-llm-caller';
import {
  COMPACT_FALLBACK_MODEL,
  COMPACT_PRIMARY_MODEL,
  FRONTIER_PRIMARY_MODEL,
  clearModelLockouts,
  isModelLockedOut,
  isTieredByokRouterEnabled,
  recordModelLockout,
  recordTieredRouteOutcome,
  sanitizeToolChoiceForRoute,
  selectTieredByokRoute,
} from '@/tree/byok';

const SAMPLE_TOOL = {
  type: 'function',
  function: {
    name: 'lookup_niche',
    description: 'Lookup profitable video niche',
    parameters: { type: 'object', properties: {} },
  },
};

describe('Tiered BYOK Model Router', () => {
  const originalEnv = process.env.ENABLE_TIERED_BYOK_ROUTER;

  beforeEach(() => {
    delete process.env.ENABLE_TIERED_BYOK_ROUTER;
    clearModelLockouts();
    resetCircuitBreaker('openrouter', 'tenant-1');
    resetCircuitBreaker('deepseek', 'tenant-1');
  });

  afterEach(() => {
    if (originalEnv === undefined) delete process.env.ENABLE_TIERED_BYOK_ROUTER;
    else process.env.ENABLE_TIERED_BYOK_ROUTER = originalEnv;
    vi.restoreAllMocks();
  });

  it('defaults rollback flag to enabled and falls back cleanly when disabled', () => {
    expect(isTieredByokRouterEnabled()).toBe(true);
    expect(isTieredByokRouterEnabled('true')).toBe(true);
    expect(isTieredByokRouterEnabled('false')).toBe(false);
    expect(isTieredByokRouterEnabled('0')).toBe(false);

    process.env.ENABLE_TIERED_BYOK_ROUTER = 'false';
    const route = selectTieredByokRoute({
      taskKind: 'json_extraction',
      baselineModel: 'anthropic/claude-3.7-sonnet',
      keyRef: 'tenant-1',
    });
    expect(route.model).toBe('anthropic/claude-3.7-sonnet');
    expect(route.tierUsed).toBe('direct_fallback');
    expect(route.reason).toBe('router_disabled');
    expect(route.estimatedSavingsPct).toBe(0);
  });

  it('routes json_extraction and qa_validation to compact tier with >= 55% savings', () => {
    const jsonRoute = selectTieredByokRoute({ taskKind: 'json_extraction', keyRef: 'tenant-1' });
    expect(jsonRoute.model).toBe(COMPACT_PRIMARY_MODEL);
    expect(jsonRoute.fallbackModel).toBe(COMPACT_FALLBACK_MODEL);
    expect(jsonRoute.tierUsed).toBe('compact');
    expect(jsonRoute.estimatedSavingsPct).toBeGreaterThanOrEqual(55);
    expect(jsonRoute.cacheControl).toBeUndefined();

    const qaRoute = selectTieredByokRoute({ taskKind: 'qa_validation', keyRef: 'tenant-1' });
    expect(qaRoute.model).toBe(COMPACT_PRIMARY_MODEL);
    expect(qaRoute.tierUsed).toBe('compact');
    expect(qaRoute.estimatedSavingsPct).toBeGreaterThanOrEqual(55);
  });

  it('routes creative_script and tool_agent to frontier tier with ephemeral cache hint', () => {
    const scriptRoute = selectTieredByokRoute({
      taskKind: 'creative_script',
      systemPromptCacheable: true,
      keyRef: 'tenant-1',
    });
    expect(scriptRoute.model).toBe(FRONTIER_PRIMARY_MODEL);
    expect(scriptRoute.tierUsed).toBe('frontier');
    expect(scriptRoute.cacheControl).toBe('ephemeral');

    const agentRoute = selectTieredByokRoute({
      taskKind: 'tool_agent',
      baselineModel: 'openai/gpt-4.1',
      systemPromptCacheable: false,
      keyRef: 'tenant-1',
    });
    expect(agentRoute.model).toBe('openai/gpt-4.1');
    expect(agentRoute.tierUsed).toBe('frontier');
    expect(agentRoute.cacheControl).toBeUndefined();
  });

  it('enforces 3-layer resilience: circuit breaker, key cooldown, and per-model lockout', () => {
    const baseMs = 1_760_000_000_000;
    const baseUnix = Math.floor(baseMs / 1000);

    recordModelLockout(COMPACT_PRIMARY_MODEL, 30_000, 'tenant-1', baseMs);
    expect(isModelLockedOut(COMPACT_PRIMARY_MODEL, 'tenant-1', baseMs + 10_000)).toBe(true);

    const shifted = selectTieredByokRoute({
      taskKind: 'json_extraction', keyRef: 'tenant-1', nowMs: baseMs + 10_000,
    });
    expect(shifted.model).toBe(COMPACT_FALLBACK_MODEL);
    expect(shifted.reason).toBe('primary_locked_out_fallback');
    expect(shifted.resilientAllowed).toBe(true);
    expect(shifted.estimatedSavingsPct).toBeGreaterThanOrEqual(55);
    expect(isModelLockedOut(COMPACT_PRIMARY_MODEL, 'tenant-1', baseMs + 31_000)).toBe(false);

    const cooled = selectTieredByokRoute({
      taskKind: 'json_extraction', keyRef: 'tenant-1', nowUnix: baseUnix,
      budget: { monthlyBudgetUsd: 50, monthSpentUsd: 5, cooldownUntil: baseUnix + 120 },
    });
    expect(cooled.reason).toBe('key_cooldown_active');
    expect(cooled.resilientAllowed).toBe(false);

    recordTieredRouteOutcome({
      provider: 'openrouter', keyRef: 'tenant-1', model: COMPACT_PRIMARY_MODEL,
      ok: false, failureKind: FailureKind.AUTH_FAILURE,
    });
    const tripped = selectTieredByokRoute({ taskKind: 'json_extraction', keyRef: 'tenant-1' });
    expect(tripped.reason).toBe('circuit_breaker_open');
    expect(tripped.resilientAllowed).toBe(false);
  });

  it('sanitizes tool_choice and wires tiered routing + tool strip into callLlmWithTools', async () => {
    const allowed = sanitizeToolChoiceForRoute({
      tools: [SAMPLE_TOOL], toolChoice: 'required', capabilities: ['json_schema', 'tool_call'],
    });
    expect(allowed.ok).toBe(true);
    if (allowed.ok) expect(allowed.value.toolChoice).toBe('required');

    const stripped = sanitizeToolChoiceForRoute({
      tools: [SAMPLE_TOOL], toolChoice: 'auto', capabilities: ['json_schema'], allowToolStrip: true,
    });
    expect(stripped.ok).toBe(true);
    if (stripped.ok) expect(stripped.value.stripped).toBe(true);

    const refused = sanitizeToolChoiceForRoute({
      tools: [SAMPLE_TOOL], toolChoice: 'auto', capabilities: ['json_schema'],
    });
    expect(refused.ok).toBe(false);
    if (!refused.ok) expect(refused.error.code).toBe('TOOL_CALL_UNSUPPORTED');

    const llmRoute = { baseUrl: 'https://openrouter.ai/api/v1', apiKey: 'sk-or-test', model: 'm1' };
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    await expect(
      callLlmWithTools({
        messages: [{ role: 'user', content: 'Run tool' }],
        tools: [SAMPLE_TOOL], userId: 'tenant-1', llmRoute, capabilities: ['json_schema'],
      }),
    ).rejects.toThrow(/TOOL_CALL_UNSUPPORTED/);
    expect(fetchSpy).not.toHaveBeenCalled();

    const sseBody = new ReadableStream({
      start(ctrl) {
        ctrl.enqueue(new TextEncoder().encode('data: [DONE]\n\n'));
        ctrl.close();
      },
    });
    fetchSpy.mockResolvedValueOnce(new Response(sseBody, { status: 200 }));
    const res = await callLlmWithTools({
      messages: [{ role: 'user', content: 'Extract JSON' }],
      tools: [SAMPLE_TOOL], userId: 'tenant-1', llmRoute,
      capabilities: ['json_schema'], allowToolStrip: true, taskKind: 'json_extraction',
    });
    expect(res.routeSelection?.model).toBe(COMPACT_PRIMARY_MODEL);
    const sentPayload = JSON.parse(String(fetchSpy.mock.calls[0]?.[1]?.body)) as Record<string, unknown>;
    expect(sentPayload.model).toBe(COMPACT_PRIMARY_MODEL);
    expect(sentPayload.tools).toBeUndefined();
  });

  it('blocks upstream fetch when resilientAllowed is false and locks out model on network timeout', async () => {
    const llmRoute = { baseUrl: 'https://openrouter.ai/api/v1', apiKey: 'sk-or-test', model: 'm1' };
    const fetchSpy = vi.spyOn(globalThis, 'fetch');

    await expect(
      callLlmWithTools({
        messages: [{ role: 'user', content: 'Score' }], userId: 'tenant-1', llmRoute,
        taskKind: 'json_extraction',
        budget: { monthlyBudgetUsd: 25, monthSpentUsd: 3, cooldownUntil: Math.floor(Date.now() / 1000) + 300 },
      }),
    ).rejects.toThrow(/BYOK_ROUTE_BLOCKED: key_cooldown_active/);
    expect(fetchSpy).not.toHaveBeenCalled();

    fetchSpy.mockRejectedValueOnce(new Error('upstream request timed out'));
    await expect(
      callLlmWithTools({
        messages: [{ role: 'user', content: 'Score' }], userId: 'tenant-1', llmRoute, taskKind: 'json_extraction',
      }),
    ).rejects.toThrow(/timed out/);
    expect(isModelLockedOut(COMPACT_PRIMARY_MODEL, 'tenant-1')).toBe(true);

    fetchSpy.mockResolvedValueOnce(new Response('unauthorized', { status: 401 }));
    await expect(
      callLlmWithTools({
        messages: [{ role: 'user', content: 'Chat' }],
        userId: 'tenant-1',
        llmRoute: { baseUrl: 'https://api.deepseek.com/v1', apiKey: 'ds-bad', model: 'deepseek-reasoner' },
        taskKind: 'tool_agent',
        systemPromptCacheable: true,
      }),
    ).rejects.toThrow(/LLM upstream error/);
    const dsBody = JSON.parse(String(fetchSpy.mock.calls.at(-1)?.[1]?.body)) as Record<string, unknown>;
    expect(dsBody.model).toBe('deepseek-reasoner');
    expect(dsBody.cache_control).toBeUndefined();
    expect(shouldAllowRequest('deepseek', 'tenant-1')).toBe(false);
    expect(shouldAllowRequest('openrouter', 'tenant-1')).toBe(true);
  });
});
