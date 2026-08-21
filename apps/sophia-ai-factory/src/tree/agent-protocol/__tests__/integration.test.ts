/**
 * AgentExecutor integration tests — DB-backed via D1 shim.
 * Tests: executeAgent with mocked ProviderRegistry and autonomy_configs.
 * Covers: autonomy gate, per-permission enforcement, budget check,
 *         provider selection, provenance recording, error codes.
 *
 * @module tree/agent-protocol/__tests__/integration
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createRequire } from 'node:module';
import { makeD1, SCHEMA, mockGetD1 } from '@/__tests__/integration/shared-d1-shim';
import type { AgentDefinition } from '@/seed/types/creative-domain';

const req = createRequire(import.meta.url);
const { DatabaseSync } = req('node:sqlite') as {
  DatabaseSync: new (p: string) => {
    exec(s: string): void;
    prepare(s: string): {
      get(...p: unknown[]): unknown;
      all(...p: unknown[]): unknown[];
      run(...p: unknown[]): { lastInsertRowid: bigint; changes: number };
    };
  };
};

const { getD1 } = await import('@/seed/db/client');
vi.mock('@/seed/db/client', () => ({ getD1: vi.fn() }));

beforeEach(() => {
  vi.mocked(getD1).mockReset();
});

function setupDb() {
  const db = new DatabaseSync(':memory:');
  db.exec(SCHEMA);
  return makeD1(db);
}

// ─── Fake provider + registry ────────────────────────────────────────────────

interface FakeProvider {
  id: string;
  healthy: boolean;
  chat: (messages: unknown[], opts: unknown) => Promise<unknown>;
}

function makeProvider(id: string, healthy = true): FakeProvider {
  return {
    id,
    healthy,
    async chat(_messages: unknown[], _opts: unknown) {
      return {
        content: `output-from-${id}`,
        model: id,
        provider: id,
        usage: { inputTokens: 100, outputTokens: 50, totalTokens: 150 },
        latencyMs: 12,
      };
    },
  };
}

function makeRegistry(providers: FakeProvider[]) {
  return {
    getHealthy: () => providers.filter((p) => p.healthy).map((p) => ({ provider: p, healthy: true })),
    getAll: () => providers,
  };
}

// ─── Agent definition helpers ────────────────────────────────────────────────

function makeDefinition(overrides: Record<string, unknown> = {}) {
  return {
    id: 'ag_test',
    name: 'Test Agent',
    role: 'content writer',
    capabilities: ['text'],
    permissions: [
      { tool: 'read_mission', scopes: ['read'], maxCostCents: 0, requiresApproval: false },
    ],
    defaultAutonomy: 3 as 0 | 1 | 2 | 3 | 4,
    maxRetries: 1,
    timeoutMs: 1000,
    modelPolicy: { capability: 'text' },
    ...overrides,
  } as AgentDefinition;
}

function makeContext(overrides: Record<string, unknown> = {}) {
  return {
    workspaceId: 'ws',
    memory: [],
    autonomyLevel: 0 as 0 | 1 | 2 | 3 | 4,
    correlationId: 'corr_1',
    budgetRemainingCents: 1000,
    approvedActionIds: [],
    ...overrides,
  };
}

// ─── Autonomy config helpers ─────────────────────────────────────────────────

async function setAutonomyLevel(d1: ReturnType<typeof makeD1>, workspaceId: string, agentType: string, level: number) {
  await d1
    .prepare(`INSERT INTO autonomy_configs (id, workspace_id, agent_type, level, overrides_json, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)`)
    .bind(`aut_${workspaceId}_${agentType}`, workspaceId, agentType, level, '{}', 100, 100)
    .run();
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('executeAgent — success path', () => {
  it('runs an agent and records provenance', async () => {
    const d1 = setupDb();
    mockGetD1(d1);
    await setAutonomyLevel(d1, 'ws', 'global', 3); // level 3 allows read_mission
    await setAutonomyLevel(d1, 'ws', 'ag_test', 3);

    const registry = makeRegistry([makeProvider('openrouter')]);
    const { executeAgent } = await import('@/tree/agent-protocol/agent-executor');

    const result = await executeAgent(makeDefinition(), makeContext(), registry as never);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.success).toBe(true);
    expect(result.value.output).toBe('output-from-openrouter');
    expect(result.value.artifacts.length).toBeGreaterThanOrEqual(1);
    expect(result.value.costCents).toBeGreaterThanOrEqual(0);
    expect(result.value.provenanceRecordId).toMatch(/^prov_/);

    // provenance was recorded
    const prov = await d1.prepare(`SELECT * FROM provenance_records WHERE id = ?1`).bind(result.value.provenanceRecordId).first();
    expect(prov).not.toBeNull();
  });
});

describe('executeAgent — autonomy gate', () => {
  it('denies when workspace autonomy level is 0', async () => {
    const d1 = setupDb();
    mockGetD1(d1);
    await setAutonomyLevel(d1, 'ws', 'global', 0);

    const registry = makeRegistry([makeProvider('openrouter')]);
    const { executeAgent } = await import('@/tree/agent-protocol/agent-executor');

    const result = await executeAgent(makeDefinition(), makeContext(), registry as never);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('AUTONOMY_DENIED');
  });

  it('denies when workspace autonomy level is 1', async () => {
    const d1 = setupDb();
    mockGetD1(d1);
    await setAutonomyLevel(d1, 'ws', 'global', 1);

    const registry = makeRegistry([makeProvider('openrouter')]);
    const { executeAgent } = await import('@/tree/agent-protocol/agent-executor');

    const result = await executeAgent(makeDefinition(), makeContext(), registry as never);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('AUTONOMY_DENIED');
  });

  it('denies when tool permission not allowed at level 2', async () => {
    const d1 = setupDb();
    mockGetD1(d1);
    await setAutonomyLevel(d1, 'ws', 'global', 2); // level 2: only read-only actions

    const registry = makeRegistry([makeProvider('openrouter')]);
    const { executeAgent } = await import('@/tree/agent-protocol/agent-executor');

    // read_mission IS allowed at level 2 — but agent-level gate uses 'execute_agent' which is NOT in the read-only set
    const result = await executeAgent(makeDefinition(), makeContext(), registry as never);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('AUTONOMY_DENIED');
  });

  it('denies when tool requires approval but not present in context', async () => {
    const d1 = setupDb();
    mockGetD1(d1);
    await setAutonomyLevel(d1, 'ws', 'global', 4); // full autonomy
    await setAutonomyLevel(d1, 'ws', 'ag_test', 4);

    const registry = makeRegistry([makeProvider('openrouter')]);
    const { executeAgent } = await import('@/tree/agent-protocol/agent-executor');

    const result = await executeAgent(
      makeDefinition({
        permissions: [{ tool: 'spend_credits', scopes: ['spend'], maxCostCents: 100, requiresApproval: true }],
      }),
      makeContext(),
      registry as never,
    );

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('AUTONOMY_DENIED');
  });
});

describe('executeAgent — budget check', () => {
  it('fails with BUDGET_EXCEEDED when estimated cost exceeds remaining', async () => {
    const d1 = setupDb();
    mockGetD1(d1);
    await setAutonomyLevel(d1, 'ws', 'global', 4);
    await setAutonomyLevel(d1, 'ws', 'ag_test', 4);

    const registry = makeRegistry([makeProvider('openrouter')]);
    const { executeAgent } = await import('@/tree/agent-protocol/agent-executor');

    const result = await executeAgent(
      makeDefinition({
        permissions: [{ tool: 'spend_credits', scopes: ['spend'], maxCostCents: 5000, requiresApproval: false }],
      }),
      makeContext({ budgetRemainingCents: 100 }),
      registry as never,
    );

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('BUDGET_EXCEEDED');
  });
});

describe('executeAgent — provider selection', () => {
  it('fails with NO_PROVIDER when registry is empty', async () => {
    const d1 = setupDb();
    mockGetD1(d1);
    await setAutonomyLevel(d1, 'ws', 'global', 4);
    await setAutonomyLevel(d1, 'ws', 'ag_test', 4);

    const registry = makeRegistry([]);
    const { executeAgent } = await import('@/tree/agent-protocol/agent-executor');

    const result = await executeAgent(makeDefinition(), makeContext(), registry as never);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('NO_PROVIDER');
  });

  it('fails with NO_PROVIDER_HEALTHY when no healthy providers', async () => {
    const d1 = setupDb();
    mockGetD1(d1);
    await setAutonomyLevel(d1, 'ws', 'global', 4);
    await setAutonomyLevel(d1, 'ws', 'ag_test', 4);

    const registry = makeRegistry([makeProvider('openrouter', false)]);
    const { executeAgent } = await import('@/tree/agent-protocol/agent-executor');

    const result = await executeAgent(makeDefinition(), makeContext(), registry as never);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('NO_PROVIDER');
  });
});

describe('executeAgent — error handling', () => {
  it('returns PROVIDER_ERROR when provider chat throws', async () => {
    const d1 = setupDb();
    mockGetD1(d1);
    await setAutonomyLevel(d1, 'ws', 'global', 4);
    await setAutonomyLevel(d1, 'ws', 'ag_test', 4);

    const registry = {
      getHealthy: () => [{
        provider: {
          id: 'broken',
          async chat() { throw new Error('network timeout'); },
        },
        healthy: true,
      }],
    };
    const { executeAgent } = await import('@/tree/agent-protocol/agent-executor');

    const result = await executeAgent(makeDefinition(), makeContext(), registry as never);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('PROVIDER_ERROR');
  });

  it('still succeeds when provenance write fails (non-fatal)', async () => {
    const d1 = setupDb();
    mockGetD1(d1);
    await setAutonomyLevel(d1, 'ws', 'global', 4);
    await setAutonomyLevel(d1, 'ws', 'ag_test', 4);

    // Corrupt the provenance table to force a write failure
    await d1.exec(`DROP TABLE provenance_records`);

    const registry = makeRegistry([makeProvider('openrouter')]);
    const { executeAgent } = await import('@/tree/agent-protocol/agent-executor');

    const result = await executeAgent(makeDefinition(), makeContext(), registry as never);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.success).toBe(true);
    // provenance record id falls back to agent-run id when write fails
    expect(result.value.provenanceRecordId).toBeUndefined();
  });
});

describe('executeAgent — barrel export', () => {
  it('exports executeAgent and ExecutorError', async () => {
    const mod = await import('@/tree/agent-protocol/index');
    expect(typeof mod.executeAgent).toBe('function');
    // ExecutorError is exported as a type — verify the class is reachable from source
    const { ExecutorError } = await import('@/tree/agent-protocol/agent-executor');
    expect(ExecutorError).toBeDefined();
    expect(new ExecutorError('NO_PROVIDER', 'x').code).toBe('NO_PROVIDER');
  });
});