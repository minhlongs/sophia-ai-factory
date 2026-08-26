/**
 * Effective Autonomy Resolver Tests
 *
 * Pure resolver (buildEffectiveAutonomy) is tested deterministically with no
 * DB. The DB-wired wrapper (resolveEffectiveAutonomy) runs against an
 * in-memory node:sqlite D1 shim, and the executor integration verifies the
 * AgentContext.effectivePolicy gate path of executeAgent.
 *
 * @module tree/autonomy/__tests__/effective-autonomy
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createRequire } from 'node:module';
import {
  buildEffectiveAutonomy,
  resolveEffectiveAutonomy,
  GLOBAL_MISSION_TYPE,
} from '@/tree/autonomy/effective-autonomy';
import type { MissionTypePolicy } from '@/seed/types/production-factory';
import type { AutonomyLevel } from '@/seed/types/creative-domain';
import { makeD1 } from '@/__tests__/integration/shared-d1-shim';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makePolicy(overrides: Partial<MissionTypePolicy> = {}): MissionTypePolicy {
  return {
    id: 'mtp-1',
    workspaceId: 'ws-1',
    missionType: 'article',
    autonomyTier: 2,
    requirePublishApproval: true,
    maxCostCentsPerRun: null,
    maxAutoRetries: 3,
    createdAt: 1000,
    updatedAt: 1000,
    ...overrides,
  };
}

// ─── Pure resolver: tier mapping + fail-closed default ───────────────────────

describe('buildEffectiveAutonomy — pure resolver', () => {
  it('falls back to built-in default L2 Supervised with publish approval when nothing is configured', () => {
    const result = buildEffectiveAutonomy({
      missionPolicy: null,
      workspaceGlobalPolicy: null,
      legacyLevel: null,
    });

    expect(result.tier).toBe(2);
    expect(result.storedLevel).toBe(3);
    expect(result.requiresApproval('publish_content')).toBe(true);
    expect(result.requiresApproval('generate_text')).toBe(false);
    expect(result.budgetCapCents).toBeNull();
    expect(result.maxAutoRetries).toBe(3);
  });

  it('maps all four tiers to the correct stored levels', () => {
    const expected: Array<[0 | 1 | 2 | 3, AutonomyLevel]> = [
      [0, 0],
      [1, 2],
      [2, 3],
      [3, 4],
    ];
    for (const [tier, storedLevel] of expected) {
      const result = buildEffectiveAutonomy({ missionPolicy: makePolicy({ autonomyTier: tier }) });
      expect(result.tier).toBe(tier);
      expect(result.storedLevel).toBe(storedLevel);
    }
  });

  it('requiresApproval gates publish tools for tiers 0-2 when the flag is set', () => {
    for (const tier of [0, 1, 2] as const) {
      const gated = buildEffectiveAutonomy({
        missionPolicy: makePolicy({ autonomyTier: tier, requirePublishApproval: true }),
      });
      expect(gated.requiresApproval('publish_content')).toBe(true);
      expect(gated.requiresApproval('publish_video')).toBe(true);
      expect(gated.requiresApproval('generate_text')).toBe(false);

      const unflagged = buildEffectiveAutonomy({
        missionPolicy: makePolicy({ autonomyTier: tier, requirePublishApproval: false }),
      });
      expect(unflagged.requiresApproval('publish_content')).toBe(false);
    }
  });

  it('never requires approval at L3 full auto', () => {
    const result = buildEffectiveAutonomy({
      missionPolicy: makePolicy({ autonomyTier: 3, requirePublishApproval: true }),
    });
    expect(result.requiresApproval('publish_content')).toBe(false);
    expect(result.requiresApproval('spend_credits')).toBe(false);
  });

  it('prefers mission policy over workspace global policy over legacy level', () => {
    const mission = makePolicy({ missionType: 'article', autonomyTier: 3 });
    const global = makePolicy({ missionType: GLOBAL_MISSION_TYPE, autonomyTier: 0 });

    const withMission = buildEffectiveAutonomy({ missionPolicy: mission, workspaceGlobalPolicy: global, legacyLevel: 1 });
    expect(withMission.tier).toBe(3);
    expect(withMission.storedLevel).toBe(4);

    const withGlobalOnly = buildEffectiveAutonomy({ missionPolicy: null, workspaceGlobalPolicy: global, legacyLevel: 1 });
    expect(withGlobalOnly.tier).toBe(0);
    expect(withGlobalOnly.storedLevel).toBe(0);

    const withLegacyOnly = buildEffectiveAutonomy({ missionPolicy: null, workspaceGlobalPolicy: null, legacyLevel: 4 });
    expect(withLegacyOnly.storedLevel).toBe(4);
    expect(withLegacyOnly.tier).toBe(3);
  });

  it('passes legacy stored levels through untouched (old behavior preserved)', () => {
    for (const level of [0, 1, 2, 3, 4] as AutonomyLevel[]) {
      const result = buildEffectiveAutonomy({ missionPolicy: null, workspaceGlobalPolicy: null, legacyLevel: level });
      expect(result.storedLevel).toBe(level);
      // Legacy configs carry no approval concept — never adds new gates.
      expect(result.requiresApproval('publish_content')).toBe(false);
    }
  });

  it('caps the stored level at the mission-row autonomy level (fail-closed)', () => {
    const result = buildEffectiveAutonomy({
      missionPolicy: makePolicy({ autonomyTier: 3 }),
      missionAutonomyLevel: 2,
    });
    expect(result.storedLevel).toBe(2);
    expect(result.tier).toBe(3);
  });

  it('does not raise the stored level when the mission cap is higher', () => {
    const result = buildEffectiveAutonomy({
      missionPolicy: makePolicy({ autonomyTier: 1 }),
      missionAutonomyLevel: 4,
    });
    expect(result.storedLevel).toBe(2);
  });

  it('carries budget cap and retry limits from the policy', () => {
    const result = buildEffectiveAutonomy({
      missionPolicy: makePolicy({ maxCostCentsPerRun: 5000, maxAutoRetries: 7 }),
    });
    expect(result.budgetCapCents).toBe(5000);
    expect(result.maxAutoRetries).toBe(7);
  });
});

// ─── DB-wired resolver ───────────────────────────────────────────────────────

const req = createRequire(import.meta.url);
const { DatabaseSync } = req('node:sqlite') as {
  DatabaseSync: new (path: string) => {
    exec(sql: string): void;
    prepare(sql: string): {
      get(...params: unknown[]): unknown;
      all(...params: unknown[]): unknown[];
      run(...params: unknown[]): { lastInsertRowid: bigint; changes: number };
    };
  };
};

const POLICY_SCHEMA = `
CREATE TABLE IF NOT EXISTS mission_type_policies (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  mission_type TEXT NOT NULL,
  autonomy_tier INTEGER NOT NULL DEFAULT 2,
  require_publish_approval INTEGER NOT NULL DEFAULT 1,
  max_cost_cents_per_run INTEGER,
  max_auto_retries INTEGER NOT NULL DEFAULT 3,
  created_at INTEGER NOT NULL DEFAULT 0,
  updated_at INTEGER NOT NULL DEFAULT 0,
  UNIQUE(workspace_id, mission_type)
);
CREATE TABLE IF NOT EXISTS autonomy_configs (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  agent_type TEXT NOT NULL DEFAULT 'global',
  level INTEGER NOT NULL DEFAULT 0,
  overrides_json TEXT DEFAULT '{}',
  created_at INTEGER NOT NULL DEFAULT 0,
  updated_at INTEGER NOT NULL DEFAULT 0
);
`;

function setupDb() {
  const db = new DatabaseSync(':memory:');
  db.exec(POLICY_SCHEMA);
  return makeD1(db);
}

// The global test setup installs a shared mock at globalThis.__env.DB, which
// getD1()/getD1Sync() resolve before any other fallback. Swap it for a real
// in-memory shim per test and restore the original afterwards.
type EnvRecord = Record<string, unknown>;

function getEnv(): EnvRecord {
  return (globalThis as unknown as { __env: EnvRecord }).__env;
}

let originalDb: unknown;
let activeD1: ReturnType<typeof makeD1>;

function installDb() {
  originalDb = getEnv().DB;
  activeD1 = setupDb();
  getEnv().DB = activeD1;
}

function restoreDb() {
  getEnv().DB = originalDb;
}

async function insertPolicy(
  d1: ReturnType<typeof makeD1>,
  workspaceId: string,
  missionType: string,
  tier: number,
  requireApproval: number,
) {
  await d1
    .prepare(
      'INSERT INTO mission_type_policies (id, workspace_id, mission_type, autonomy_tier, ' +
      'require_publish_approval, max_cost_cents_per_run, max_auto_retries, created_at, updated_at) ' +
      'VALUES (?, ?, ?, ?, ?, NULL, 3, 100, 100)',
    )
    .bind(`${workspaceId}:${missionType}`, workspaceId, missionType, tier, requireApproval)
    .run();
}

async function insertLegacyConfig(d1: ReturnType<typeof makeD1>, workspaceId: string, level: number) {
  await d1
    .prepare(
      'INSERT INTO autonomy_configs (id, workspace_id, agent_type, level, overrides_json, created_at, updated_at) ' +
      'VALUES (?, ?, \'global\', ?, \'{}\', 100, 100)',
    )
    .bind(`${workspaceId}:global`, workspaceId, level)
    .run();
}

describe('resolveEffectiveAutonomy — DB-wired', () => {
  beforeEach(() => {
    installDb();
  });

  afterEach(() => {
    restoreDb();
  });

  it('keeps old deny behavior when no policy and no stored legacy config exist', async () => {
    // Legacy built-in default is level 1 → executor denies execute_agent,
    // exactly as before this feature existed.
    const result = await resolveEffectiveAutonomy({ workspaceId: 'ws-empty', missionType: 'article' });
    expect(result.storedLevel).toBe(1);
    expect(result.requiresApproval('publish_content')).toBe(false);
  });

  it('resolves the mission-type policy when present', async () => {
    await insertPolicy(activeD1, 'ws-1', 'article', 3, 0);

    const result = await resolveEffectiveAutonomy({ workspaceId: 'ws-1', missionType: 'article' });
    expect(result.tier).toBe(3);
    expect(result.storedLevel).toBe(4);
    expect(result.requiresApproval('publish_content')).toBe(false);
  });

  it('falls back to the workspace global policy when the mission type has none', async () => {
    await insertPolicy(activeD1, 'ws-1', GLOBAL_MISSION_TYPE, 0, 1);

    const result = await resolveEffectiveAutonomy({ workspaceId: 'ws-1', missionType: 'video' });
    expect(result.tier).toBe(0);
    expect(result.storedLevel).toBe(0);
  });

  it('uses the stored legacy level when no policies exist', async () => {
    await insertLegacyConfig(activeD1, 'ws-legacy', 4);

    const result = await resolveEffectiveAutonomy({ workspaceId: 'ws-legacy', missionType: 'article' });
    expect(result.storedLevel).toBe(4);
    expect(result.tier).toBe(3);
  });

  it('prefers the mission policy over a stored legacy level', async () => {
    await insertPolicy(activeD1, 'ws-1', 'article', 1, 1);
    await insertLegacyConfig(activeD1, 'ws-1', 4);

    const result = await resolveEffectiveAutonomy({ workspaceId: 'ws-1', missionType: 'article' });
    expect(result.tier).toBe(1);
    expect(result.storedLevel).toBe(2);
    expect(result.requiresApproval('publish_content')).toBe(true);
  });

  it('degrades to the fail-closed built-in default when the DB is unavailable', async () => {
    // Remove every binding the accessors consult so all reads fail closed.
    getEnv().DB = undefined;
    delete (globalThis as Record<string, unknown>).__D1_DB;

    const result = await resolveEffectiveAutonomy({ workspaceId: 'ws-x', missionType: 'article' });
    expect(result.tier).toBe(2);
    expect(result.storedLevel).toBe(3);
    expect(result.requiresApproval('publish_content')).toBe(true);
  });
});

// ─── Executor integration: AgentContext.effectivePolicy gate ─────────────────

interface FakeProvider {
  id: string;
  chat: (messages: unknown[], opts: unknown) => Promise<unknown>;
}

function makeRegistry(providers: FakeProvider[]) {
  return {
    getHealthy: () => providers.map((provider) => ({ provider, healthy: true })),
    getAll: () => providers,
  };
}

const stubProvider: FakeProvider = {
  id: 'stub-provider',
  async chat() {
    return {
      content: 'stub-output',
      model: 'stub-model',
      provider: 'stub-provider',
      usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 },
      latencyMs: 1,
    };
  },
};

describe('executeAgent — effectivePolicy gate', () => {
  afterEach(() => {
    delete (globalThis as Record<string, unknown>).__D1_DB;
  });

  async function runWithPolicy(storedLevel: AutonomyLevel) {
    const { executeAgent } = await import('@/tree/agent-protocol/agent-executor');
    const definition = {
      id: 'ag_policy_test',
      name: 'Policy Test Agent',
      role: 'test agent',
      capabilities: ['generate_text'],
      permissions: [{ tool: 'generate_text', scopes: ['read'], maxCostCents: 0, requiresApproval: false }],
      defaultAutonomy: 3 as AutonomyLevel,
      maxRetries: 1,
      timeoutMs: 1000,
      modelPolicy: { capability: 'text' },
    };
    const context = {
      workspaceId: 'ws-policy',
      memory: [],
      autonomyLevel: 0 as AutonomyLevel,
      correlationId: 'corr_policy_1',
      budgetRemainingCents: 1000,
      approvedActionIds: [],
      effectivePolicy: {
        tier: 2 as 0 | 1 | 2 | 3,
        storedLevel,
        requiresApproval: () => false,
        budgetCapCents: null,
        maxAutoRetries: 3,
      },
    };
    return executeAgent(
      definition as Parameters<typeof executeAgent>[0],
      context as Parameters<typeof executeAgent>[1],
      makeRegistry([stubProvider]) as never,
    );
  }

  it('allows the run when the effective policy stored level permits it (no DB consulted)', async () => {
    const result = await runWithPolicy(3);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.success).toBe(true);
    expect(result.value.output).toBe('stub-output');
  });

  it('denies the run when the effective policy stored level is 0', async () => {
    const result = await runWithPolicy(0);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('AUTONOMY_DENIED');
  });

  it('denies a blocked tool at stored level 3 via the policy gate', async () => {
    const { executeAgent } = await import('@/tree/agent-protocol/agent-executor');
    const definition = {
      id: 'ag_policy_spend',
      name: 'Spend Agent',
      role: 'test agent',
      capabilities: ['spend'],
      permissions: [{ tool: 'spend_credits', scopes: ['spend'], maxCostCents: 1, requiresApproval: false }],
      defaultAutonomy: 3 as AutonomyLevel,
      maxRetries: 1,
      timeoutMs: 1000,
      modelPolicy: { capability: 'text' },
    };
    const context = {
      workspaceId: 'ws-policy',
      memory: [],
      autonomyLevel: 0 as AutonomyLevel,
      correlationId: 'corr_policy_2',
      budgetRemainingCents: 1000,
      approvedActionIds: [],
      effectivePolicy: {
        tier: 2 as 0 | 1 | 2 | 3,
        storedLevel: 3 as AutonomyLevel,
        requiresApproval: () => false,
        budgetCapCents: null,
        maxAutoRetries: 3,
      },
    };
    const result = await executeAgent(
      definition as Parameters<typeof executeAgent>[0],
      context as Parameters<typeof executeAgent>[1],
      makeRegistry([stubProvider]) as never,
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('AUTONOMY_DENIED');
  });
});
