/**
 * Provenance integration tests — DB-backed via D1 shim.
 * Tests: recordProvenance, getProvenanceChain, getDerivatives,
 *        getProvenanceTimeline, getAgentRunProvenance, newProvenanceId
 *
 * @module tree/provenance/__tests__/integration
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createRequire } from 'node:module';

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

// ─── D1 shim ─────────────────────────────────────────────────────────────────

function makeD1(db: InstanceType<typeof DatabaseSync>) {
  return {
    prepare(sql: string) {
      const stmt = db.prepare(sql);
      return {
        bind: (...params: unknown[]) => {
          const sanitized = params.map((p) => (p === undefined ? null : p));
          return {
            first: async <T = Record<string, unknown>>() => stmt.get(...sanitized) as T | undefined,
            run: async () => {
              const r = stmt.run(...sanitized);
              return { success: true, meta: { changes: Number(r.changes ?? 0), duration: 0 } };
            },
            all: async <T = Record<string, unknown>>() => {
              return { results: stmt.all(...sanitized) as T[], meta: { changes: 0, duration: 0 } };
            },
          };
        },
        first: async <T = Record<string, unknown>>() => stmt.get() as T | undefined,
        run: async () => {
          const r = stmt.run();
          return { success: true, meta: { changes: Number(r.changes ?? 0), duration: 0 } };
        },
        all: async <T = Record<string, unknown>>() => {
          return { results: stmt.all() as T[], meta: { changes: 0, duration: 0 } };
        },
      };
    },
    exec: (s: string) => db.exec(s),
    batch: (stmts: unknown[]) => Promise.all(stmts),
  };
}

// ─── Schema ──────────────────────────────────────────────────────────────────

const SCHEMA = `
CREATE TABLE IF NOT EXISTS provenance_records (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  asset_id TEXT NOT NULL,
  agent_run_id TEXT,
  action TEXT NOT NULL,
  actor_type TEXT NOT NULL,
  actor_id TEXT NOT NULL,
  model TEXT,
  model_version TEXT,
  prompt TEXT,
  source_asset_id TEXT,
  human_edits TEXT,
  approval_id TEXT,
  derivative_of TEXT,
  metadata TEXT NOT NULL DEFAULT '{}',
  created_at INTEGER NOT NULL DEFAULT 0
);
`;

// ─── Mock setup ──────────────────────────────────────────────────────────────

const { getD1 } = await import('@/seed/db/client');
vi.mock('@/seed/db/client', () => ({
  getD1: vi.fn(),
}));

beforeEach(() => {
  vi.mocked(getD1).mockReset();
});

// ─── Helpers ─────────────────────────────────────────────────────────────────

function setupDb() {
  const db = new DatabaseSync(':memory:');
  db.exec(SCHEMA);
  return makeD1(db);
}

async function insertProvenance(d1: ReturnType<typeof makeD1>, row: Record<string, unknown>) {
  await d1
    .prepare(
      `INSERT INTO provenance_records
         (id, workspace_id, asset_id, agent_run_id, action, actor_type, actor_id,
          model, model_version, prompt, source_asset_id, human_edits,
          approval_id, derivative_of, metadata, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      row.id,
      row.workspace_id,
      row.asset_id,
      row.agent_run_id ?? null,
      row.action,
      row.actor_type,
      row.actor_id,
      row.model ?? null,
      row.model_version ?? null,
      row.prompt ?? null,
      row.source_asset_id ?? null,
      row.human_edits ?? null,
      row.approval_id ?? null,
      row.derivative_of ?? null,
      JSON.stringify(row.metadata ?? {}),
      row.created_at ?? 0,
    )
    .run();
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('Provenance — recordProvenance', () => {
  it('inserts a provenance record and returns it with generated id', async () => {
    const d1 = setupDb();
    vi.mocked(getD1).mockResolvedValue(d1 as never);

    const { recordProvenance, newProvenanceId } = await import('@/tree/provenance/types');

    const id = newProvenanceId();
    expect(id).toMatch(/^prov_[0-9a-f]{32}$/);

    const record = await recordProvenance({
      id,
      workspaceId: 'ws_1',
      assetId: 'asset_1',
      agentRunId: 'run_1',
      action: 'generated',
      actorType: 'agent',
      actorId: 'agent-x',
      model: 'claude-sonnet-4',
      metadata: { provider: 'anthropic', inputTokens: 100 },
      createdAt: 0,
    });

    expect(record.id).toBe(id);
    expect(record.workspaceId).toBe('ws_1');
    expect(record.action).toBe('generated');
    expect(record.metadata).toEqual({ provider: 'anthropic', inputTokens: 100 });
    expect(record.createdAt).toBeGreaterThan(0);
  });

  it('auto-generates id and timestamp when omitted', async () => {
    const d1 = setupDb();
    vi.mocked(getD1).mockResolvedValue(d1 as never);

    const { recordProvenance } = await import('@/tree/provenance/types');

    const record = await recordProvenance({
      id: '',
      workspaceId: 'ws_auto',
      assetId: 'asset_auto',
      action: 'edited',
      actorType: 'human',
      actorId: 'user-1',
      metadata: {},
      createdAt: 0,
    });

    expect(record.id).toMatch(/^prov_/);
    expect(record.createdAt).toBeGreaterThan(0);
  });

  it('throws ProvenanceError when D1 unavailable', async () => {
    vi.mocked(getD1).mockResolvedValue(null as never);

    const { recordProvenance, ProvenanceError } = await import('@/tree/provenance/types');

    await expect(
      recordProvenance({
        id: 'prov_x',
        workspaceId: 'ws',
        assetId: 'a',
        action: 'generated',
        actorType: 'agent',
        actorId: 'a',
        metadata: {},
        createdAt: 0,
      }),
    ).rejects.toThrow(ProvenanceError);
  });
});

describe('Provenance — getProvenanceChain', () => {
  it('returns all records for an asset ordered by created_at', async () => {
    const d1 = setupDb();
    vi.mocked(getD1).mockResolvedValue(d1 as never);

    await insertProvenance(d1, {
      id: 'p1', workspace_id: 'ws', asset_id: 'asset_chain',
      action: 'created', actor_type: 'human', actor_id: 'u1',
      metadata: {}, created_at: 100,
    });
    await insertProvenance(d1, {
      id: 'p2', workspace_id: 'ws', asset_id: 'asset_chain',
      action: 'generated', actor_type: 'agent', actor_id: 'a1',
      agent_run_id: 'run_1', model: 'gpt-4o', metadata: {}, created_at: 200,
    });
    await insertProvenance(d1, {
      id: 'p3', workspace_id: 'ws', asset_id: 'asset_chain',
      action: 'edited', actor_type: 'human', actor_id: 'u2',
      metadata: {}, created_at: 300,
    });
    // unrelated asset
    await insertProvenance(d1, {
      id: 'p4', workspace_id: 'ws', asset_id: 'other',
      action: 'created', actor_type: 'human', actor_id: 'u1',
      metadata: {}, created_at: 100,
    });

    const { getProvenanceChain } = await import('@/tree/provenance/types');
    const chain = await getProvenanceChain('asset_chain');

    expect(chain).toHaveLength(3);
    expect(chain[0].id).toBe('p1');
    expect(chain[1].id).toBe('p2');
    expect(chain[2].id).toBe('p3');
    expect(chain[0].action).toBe('created');
    expect(chain[1].model).toBe('gpt-4o');
  });

  it('returns empty array when no records exist', async () => {
    const d1 = setupDb();
    vi.mocked(getD1).mockResolvedValue(d1 as never);

    const { getProvenanceChain } = await import('@/tree/provenance/types');
    const chain = await getProvenanceChain('nonexistent');
    expect(chain).toEqual([]);
  });
});

describe('Provenance — getDerivatives', () => {
  it('returns all derivatives of an asset', async () => {
    const d1 = setupDb();
    vi.mocked(getD1).mockResolvedValue(d1 as never);

    await insertProvenance(d1, {
      id: 'd1', workspace_id: 'ws', asset_id: 'derived_1',
      derivative_of: 'source_1', action: 'derived', actor_type: 'agent',
      actor_id: 'a1', metadata: {}, created_at: 100,
    });
    await insertProvenance(d1, {
      id: 'd2', workspace_id: 'ws', asset_id: 'derived_2',
      derivative_of: 'source_1', action: 'derived', actor_type: 'agent',
      actor_id: 'a1', metadata: {}, created_at: 200,
    });
    // unrelated
    await insertProvenance(d1, {
      id: 'd3', workspace_id: 'ws', asset_id: 'derived_3',
      derivative_of: 'other_source', action: 'derived', actor_type: 'agent',
      actor_id: 'a1', metadata: {}, created_at: 100,
    });

    const { getDerivatives } = await import('@/tree/provenance/types');
    const derivatives = await getDerivatives('source_1');

    expect(derivatives).toHaveLength(2);
    expect(derivatives.map((d) => d.id).sort()).toEqual(['d1', 'd2']);
    expect(derivatives[0].derivativeOf).toBe('source_1');
  });

  it('returns empty array when no derivatives', async () => {
    const d1 = setupDb();
    vi.mocked(getD1).mockResolvedValue(d1 as never);

    const { getDerivatives } = await import('@/tree/provenance/types');
    expect(await getDerivatives('none')).toEqual([]);
  });
});

describe('Provenance — getProvenanceTimeline', () => {
  it('is equivalent to getProvenanceChain', async () => {
    const d1 = setupDb();
    vi.mocked(getD1).mockResolvedValue(d1 as never);

    await insertProvenance(d1, {
      id: 't1', workspace_id: 'ws', asset_id: 'timeline_asset',
      action: 'created', actor_type: 'human', actor_id: 'u1',
      metadata: {}, created_at: 100,
    });
    await insertProvenance(d1, {
      id: 't2', workspace_id: 'ws', asset_id: 'timeline_asset',
      action: 'generated', actor_type: 'agent', actor_id: 'a1',
      metadata: {}, created_at: 200,
    });

    const { getProvenanceTimeline, getProvenanceChain } = await import('@/tree/provenance/types');
    const timeline = await getProvenanceTimeline('timeline_asset');
    const chain = await getProvenanceChain('timeline_asset');

    expect(timeline).toEqual(chain);
    expect(timeline).toHaveLength(2);
  });
});

describe('Provenance — getAgentRunProvenance', () => {
  it('returns all provenance records for an agent run', async () => {
    const d1 = setupDb();
    vi.mocked(getD1).mockResolvedValue(d1 as never);

    await insertProvenance(d1, {
      id: 'a1', workspace_id: 'ws', asset_id: 'asset_a1',
      agent_run_id: 'run_99', action: 'generated', actor_type: 'agent',
      actor_id: 'ag', model: 'claude', metadata: {}, created_at: 100,
    });
    await insertProvenance(d1, {
      id: 'a2', workspace_id: 'ws', asset_id: 'asset_a2',
      agent_run_id: 'run_99', action: 'generated', actor_type: 'agent',
      actor_id: 'ag', model: 'claude', metadata: {}, created_at: 200,
    });
    // different run
    await insertProvenance(d1, {
      id: 'a3', workspace_id: 'ws', asset_id: 'asset_a3',
      agent_run_id: 'run_100', action: 'generated', actor_type: 'agent',
      actor_id: 'ag', model: 'claude', metadata: {}, created_at: 100,
    });

    const { getAgentRunProvenance } = await import('@/tree/provenance/types');
    const records = await getAgentRunProvenance('run_99');

    expect(records).toHaveLength(2);
    expect(records[0].agentRunId).toBe('run_99');
    expect(records.map((r) => r.id).sort()).toEqual(['a1', 'a2']);
  });

  it('returns empty array for unknown run', async () => {
    const d1 = setupDb();
    vi.mocked(getD1).mockResolvedValue(d1 as never);

    const { getAgentRunProvenance } = await import('@/tree/provenance/types');
    expect(await getAgentRunProvenance('ghost')).toEqual([]);
  });
});

describe('Provenance — barrel export', () => {
  it('exports all expected functions', async () => {
    const mod = await import('@/tree/provenance/index');
    expect(typeof mod.recordProvenance).toBe('function');
    expect(typeof mod.getProvenanceChain).toBe('function');
    expect(typeof mod.getDerivatives).toBe('function');
    expect(typeof mod.getProvenanceTimeline).toBe('function');
    expect(typeof mod.getAgentRunProvenance).toBe('function');
    expect(typeof mod.newProvenanceId).toBe('function');
    // ProvenanceError is exported as a type from the index barrel — verify from source
    const { ProvenanceError } = await import('@/tree/provenance/types');
    expect(ProvenanceError).toBeDefined();
    expect(new ProvenanceError('X', 'y').code).toBe('X');
  });
});