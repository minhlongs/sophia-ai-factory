/**
 * AgentExecutor cost-estimation tests.
 *
 * Pins the executor-level cost math (agent-executor.ts, step 7):
 *  - known model   → seed estimateCost() USD result × 100 → cents
 *  - unknown model → fallback Math.ceil(totalTokens × 0.001 × 100)
 *                    + logger.warn('model not in pricing table')
 * Real executeAgent on the D1 shim; stubs only the provider response
 * and — fallback case only — the pricing lookup.
 *
 * @module tree/agent-protocol/__tests__/agent-executor-cost
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createRequire } from 'node:module';
import { makeD1, SCHEMA, mockGetD1 } from '@/__tests__/integration/shared-d1-shim';
import type { AgentDefinition } from '@/seed/types/creative-domain';
import type { ChatMessage } from '@/seed/ai/provider-interface';
import type { ProviderRegistry } from '@/seed/ai/provider-registry';
import { logger } from '@/seed/utils/logger-utility';

const req = createRequire(import.meta.url);
type SqliteStatement = {
  get(...p: unknown[]): unknown;
  all(...p: unknown[]): unknown[];
  run(...p: unknown[]): { lastInsertRowid: bigint; changes: number };
};
const { DatabaseSync } = req('node:sqlite') as {
  DatabaseSync: new (p: string) => { exec(s: string): void; prepare(s: string): SqliteStatement };
};

const { getD1 } = await import('@/seed/db/client');
vi.mock('@/seed/db/client', () => ({ getD1: vi.fn() }));

// Spy the pricing lookup only; estimateCost stays real so the known-model
// branch exercises actual seed estimator math.
vi.mock('@/seed/ai/cost-estimator', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/seed/ai/cost-estimator')>();
  return {
    ...actual,
    getModelPricing: vi.fn(actual.getModelPricing),
  };
});

import { getModelPricing, estimateCost } from '@/seed/ai/cost-estimator';
import { resolveModelForCapability } from '@/tree/agent-protocol/builtin-agents';
import { executeAgent } from '@/tree/agent-protocol/agent-executor';

beforeEach(() => {
  vi.mocked(getD1).mockReset();
});

// ─── Fixtures ────────────────────────────────────────────────────────────────

const AGENT_ROLE = 'cost test copywriter';

interface UsageShape {
  inputTokens: number;
  outputTokens: number;
}

function makeProvider(id: string, usage: UsageShape) {
  return {
    id,
    healthy: true,
    async chat(_messages: unknown[], _opts: unknown) {
      return {
        content: `output-from-${id}`,
        model: id,
        provider: id,
        usage: { ...usage, totalTokens: usage.inputTokens + usage.outputTokens },
        latencyMs: 5,
      };
    },
  };
}

function makeRegistry(providers: ReturnType<typeof makeProvider>[]) {
  return {
    getHealthy: () =>
      providers.map((p) => ({ id: p.id as 'openrouter', provider: p, health: { status: 'healthy' } })),
  } as unknown as ProviderRegistry;
}

function makeDefinition(): AgentDefinition {
  return {
    id: 'ag_cost',
    name: 'Cost Test Agent',
    role: AGENT_ROLE,
    capabilities: ['text'],
    permissions: [
      { tool: 'read_mission', scopes: ['read'], maxCostCents: 0, requiresApproval: false },
    ],
    defaultAutonomy: 3 as 0 | 1 | 2 | 3 | 4,
    maxRetries: 1,
    timeoutMs: 1000,
    modelPolicy: { capability: 'text' },
  } as AgentDefinition;
}

function makeContext() {
  return {
    workspaceId: 'ws_cost',
    memory: [] as never[],
    autonomyLevel: 0 as 0 | 1 | 2 | 3 | 4,
    correlationId: 'corr_cost_1',
    budgetRemainingCents: 1000,
    approvedActionIds: [],
  };
}

async function setupAutonomy() {
  const db = new DatabaseSync(':memory:');
  db.exec(SCHEMA);
  const d1 = makeD1(db);
  mockGetD1(d1);
  // Level 4 = full autonomy for both agent-level and tool-level gates.
  const insert =
    'INSERT INTO autonomy_configs (id, workspace_id, agent_type, level, overrides_json, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?), (?, ?, ?, ?, ?, ?, ?)';
  await d1
    .prepare(insert)
    .bind('aut_ws_global', 'ws_cost', 'global', 4, '{}', 100, 100, 'aut_ws_ag', 'ws_cost', 'ag_cost', 4, '{}', 100, 100)
    .run();
}

/** Messages exactly as the executor builds them before the provider call. */
function expectedMessages(): ChatMessage[] {
  return [
    { role: 'system', content: AGENT_ROLE },
    // memory is empty in makeContext(), so JSON.stringify([]) === '[]'
    { role: 'user', content: '[]' },
  ];
}

describe('executeAgent cost estimation', () => {
  it('known model charges seed estimateCost x 100 cents', async () => {
    await setupAutonomy();
    const warnSpy = vi.spyOn(logger, 'warn').mockImplementation(() => undefined);

    const registry = makeRegistry([
      makeProvider('openrouter', { inputTokens: 1000, outputTokens: 500 }),
    ]);

    const result = await executeAgent(makeDefinition(), makeContext(), registry);

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const resolvedModel = resolveModelForCapability('text');
    expect(resolvedModel).toBe('meta-llama/llama-4-scout');

    // Independent recomputation of the executor's formula:
    // costUsd = estimateCost(messages, resolvedModel, {maxTokens:2048, providerId})
    // costCents = Math.round(costUsd * 100)
    const expectedUsd = estimateCost(expectedMessages(), resolvedModel, {
      maxTokens: 2048,
      providerId: 'openrouter',
    });
    const expectedCents = Math.round(expectedUsd * 100);

    expect(expectedCents).toBeGreaterThan(0); // guards against a vacuous zero-match
    expect(result.value.costCents).toBe(expectedCents);
    expect(result.value.totalTokens).toBe(1500);
    expect(warnSpy).not.toHaveBeenCalledWith(
      expect.stringContaining('model not in pricing table'),
      expect.anything(),
    );
    warnSpy.mockRestore();
  });

  it('unknown model falls back to ceil(totalTokens*0.001*100) and warns once', async () => {
    await setupAutonomy();
    const warnSpy = vi.spyOn(logger, 'warn').mockImplementation(() => undefined);

    // Executor calls getModelPricing exactly once per run — scope the
    // override to that single call so the real table stays intact elsewhere.
    vi.mocked(getModelPricing).mockReturnValueOnce(undefined);

    const registry = makeRegistry([
      makeProvider('openrouter', { inputTokens: 789, outputTokens: 445 }),
    ]);

    const result = await executeAgent(makeDefinition(), makeContext(), registry);

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    // 789 + 445 = 1234 tokens → ceil(1234 × 0.001 × 100) = ceil(123.4) = 124
    expect(result.value.totalTokens).toBe(1234);
    expect(result.value.costCents).toBe(Math.ceil(1234 * 0.001 * 100));
    expect(result.value.costCents).toBe(124);

    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(warnSpy).toHaveBeenCalledWith(
      '[AgentExecutor] model not in pricing table, used fallback',
      expect.objectContaining({ model: resolveModelForCapability('text') }),
    );
    warnSpy.mockRestore();
  });
});
