/**
 * Production Graph repository — DB-backed tests via the shared D1 shim.
 *
 * Runs the real repo functions against an in-memory SQLite database with the
 * migration-0257 tables (production_graphs / production_graph_runs), so SQL
 * semantics (UNIQUE conflicts, guarded UPDATE change counts, JSON round-trips)
 * are exercised for real rather than mocked away.
 *
 * @module tree/production-graph/__tests__/repo
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { freshDb, makeD1 } from '@/__tests__/integration/shared-d1-shim';
import type { GraphDefinition, ProductionGraphNodeState } from '@/seed/types/production-factory';

const mocks = vi.hoisted(() => ({
  createServerClient: vi.fn(),
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock('@/seed/db/client', () => ({
  createServerClient: (...args: unknown[]) => mocks.createServerClient(...args),
}));

vi.mock('@/seed/utils/logger-utility', () => ({
  logger: mocks.logger,
}));

import {
  getGraphBySlug,
  getGraphById,
  listTemplates,
  createGraph,
  createRun,
  getRun,
  updateRunStatus,
  setNodeStates,
  getNodeStates,
  completeRun,
  failRun,
  type CreateGraphInput,
} from '../repo';

// Migration 0257 tables — the shared SCHEMA does not include them.
const GRAPH_TABLES = `
CREATE TABLE IF NOT EXISTS production_graphs (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  mission_type TEXT NOT NULL,
  slug TEXT NOT NULL,
  name TEXT NOT NULL,
  definition_json TEXT NOT NULL,
  is_template INTEGER NOT NULL DEFAULT 1,
  created_at INTEGER NOT NULL DEFAULT 0,
  updated_at INTEGER NOT NULL DEFAULT 0,
  UNIQUE(workspace_id, slug)
);
CREATE TABLE IF NOT EXISTS production_graph_runs (
  id TEXT PRIMARY KEY,
  graph_id TEXT NOT NULL,
  mission_id TEXT NOT NULL,
  workspace_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'queued',
  phase TEXT NOT NULL DEFAULT 'planning',
  node_states_json TEXT,
  output_json TEXT,
  error_json TEXT,
  error_message TEXT,
  total_cost_cents INTEGER NOT NULL DEFAULT 0,
  total_tokens INTEGER NOT NULL DEFAULT 0,
  retry_count INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL DEFAULT 0,
  started_at INTEGER,
  ended_at INTEGER
);
`;

function definition(): GraphDefinition {
  return {
    nodes: [
      { id: 'a', agentSlug: 'sophia-researcher' },
      { id: 'b', agentSlug: 'sophia-editor', isPublishNode: true },
    ],
    edges: [{ from: 'a', to: 'b' }],
  };
}

function graphInput(overrides: Partial<CreateGraphInput> = {}): CreateGraphInput {
  return {
    id: 'graph_1',
    missionType: 'article-factory',
    slug: 'article-factory',
    name: 'Article Factory',
    definition: definition(),
    isTemplate: true,
    ...overrides,
  };
}

let db: ReturnType<typeof freshDb>;

beforeEach(() => {
  vi.clearAllMocks();
  db = freshDb();
  db.exec(GRAPH_TABLES);
  mocks.createServerClient.mockReturnValue(makeD1(db));
});

describe('createGraph + reads', () => {
  it('creates a graph and reads it back by slug and id', async () => {
    const created = await createGraph('ws_1', graphInput());
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    expect(created.value.id).toBe('graph_1');
    expect(created.value.workspaceId).toBe('ws_1');
    expect(created.value.isTemplate).toBe(true);
    expect(created.value.definition.nodes).toHaveLength(2);

    const bySlug = await getGraphBySlug('ws_1', 'article-factory');
    expect(bySlug.ok).toBe(true);
    if (bySlug.ok) expect(bySlug.value?.id).toBe('graph_1');

    const byId = await getGraphById('graph_1');
    expect(byId.ok).toBe(true);
    if (byId.ok) expect(byId.value?.slug).toBe('article-factory');
  });

  it('returns success(null) when the graph is absent', async () => {
    const bySlug = await getGraphBySlug('ws_1', 'missing');
    expect(bySlug.ok).toBe(true);
    if (bySlug.ok) expect(bySlug.value).toBeNull();

    const byId = await getGraphById('missing');
    expect(byId.ok).toBe(true);
    if (byId.ok) expect(byId.value).toBeNull();
  });

  it('rejects a duplicate (workspace, slug) with CONFLICT', async () => {
    const first = await createGraph('ws_1', graphInput());
    expect(first.ok).toBe(true);

    const dup = await createGraph('ws_1', graphInput({ id: 'graph_dup' }));
    expect(dup.ok).toBe(false);
    if (dup.ok) return;
    expect(dup.error.code).toBe('CONFLICT');
  });

  it('allows the same slug in a different workspace', async () => {
    await createGraph('ws_1', graphInput());
    const other = await createGraph('ws_2', graphInput({ id: 'graph_ws2' }));
    expect(other.ok).toBe(true);
  });

  it('rejects missing required fields with VALIDATION_ERROR', async () => {
    const missing = await createGraph('ws_1', graphInput({ slug: '' }));
    expect(missing.ok).toBe(false);
    if (missing.ok) return;
    expect(missing.error.code).toBe('VALIDATION_ERROR');
  });

  it('rejects an empty definition with VALIDATION_ERROR', async () => {
    const empty = await createGraph('ws_1', graphInput({ definition: { nodes: [], edges: [] } }));
    expect(empty.ok).toBe(false);
    if (empty.ok) return;
    expect(empty.error.code).toBe('VALIDATION_ERROR');
  });

  it('returns DB_ERROR for a corrupt definition_json', async () => {
    await createGraph('ws_1', graphInput());
    db.exec(`UPDATE production_graphs SET definition_json = '{not-json' WHERE id = 'graph_1'`);

    const result = await getGraphById('graph_1');
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('DB_ERROR');
  });
});

describe('listTemplates', () => {
  it('lists only template graphs for the workspace, ordered by slug', async () => {
    await createGraph('ws_1', graphInput({ id: 'g_b', slug: 'b-template' }));
    await createGraph('ws_1', graphInput({ id: 'g_a', slug: 'a-template' }));
    await createGraph('ws_1', graphInput({ id: 'g_custom', slug: 'custom', isTemplate: false }));
    await createGraph('ws_other', graphInput({ id: 'g_other', slug: 'other-ws' }));

    const result = await listTemplates('ws_1');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.map((g) => g.slug)).toEqual(['a-template', 'b-template']);
  });

  it('returns an empty list when there are no templates', async () => {
    const result = await listTemplates('ws_empty');
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value).toEqual([]);
  });
});

describe('createRun + getRun', () => {
  it('creates a run in queued/planning and reads it back', async () => {
    const created = await createRun('ws_1', { id: 'run_1', graphId: 'graph_1', missionId: 'm_1' });
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    expect(created.value.status).toBe('queued');
    expect(created.value.phase).toBe('planning');
    expect(created.value.retryCount).toBe(0);
    expect(created.value.nodeStates).toBeNull();

    const fetched = await getRun('run_1');
    expect(fetched.ok).toBe(true);
    if (fetched.ok) expect(fetched.value?.graphId).toBe('graph_1');
  });

  it('honors a provided retryCount', async () => {
    const created = await createRun('ws_1', {
      id: 'run_retry',
      graphId: 'graph_1',
      missionId: 'm_1',
      retryCount: 2,
    });
    expect(created.ok).toBe(true);
    if (created.ok) expect(created.value.retryCount).toBe(2);
  });

  it('returns success(null) for a missing run', async () => {
    const result = await getRun('missing');
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value).toBeNull();
  });

  it('rejects missing required fields with VALIDATION_ERROR', async () => {
    const result = await createRun('ws_1', { id: '', graphId: 'graph_1', missionId: 'm_1' });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('VALIDATION_ERROR');
  });

  it('rejects a negative retryCount with VALIDATION_ERROR', async () => {
    const result = await createRun('ws_1', {
      id: 'run_neg',
      graphId: 'graph_1',
      missionId: 'm_1',
      retryCount: -1,
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('VALIDATION_ERROR');
  });

  it('rejects a fractional retryCount with VALIDATION_ERROR', async () => {
    const result = await createRun('ws_1', {
      id: 'run_frac',
      graphId: 'graph_1',
      missionId: 'm_1',
      retryCount: 1.5,
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('VALIDATION_ERROR');
  });
});

describe('updateRunStatus (guarded transition)', () => {
  it('flips when the current status matches the expected status', async () => {
    await createRun('ws_1', { id: 'run_1', graphId: 'graph_1', missionId: 'm_1' });

    const result = await updateRunStatus('run_1', 'queued', 'running', 'executing');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.flipped).toBe(true);

    const run = await getRun('run_1');
    if (run.ok) {
      expect(run.value?.status).toBe('running');
      expect(run.value?.phase).toBe('executing');
    }
  });

  it('does not flip when the row has moved on (stale writer loses the race)', async () => {
    await createRun('ws_1', { id: 'run_1', graphId: 'graph_1', missionId: 'm_1' });
    await updateRunStatus('run_1', 'queued', 'running', 'executing');

    // Expecting queued, but the row is already running → 0 rows changed.
    const result = await updateRunStatus('run_1', 'queued', 'completed', 'review');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.flipped).toBe(false);

    const run = await getRun('run_1');
    if (run.ok) expect(run.value?.status).toBe('running');
  });
});

describe('node states checkpoint', () => {
  it('round-trips node states through setNodeStates/getNodeStates', async () => {
    await createRun('ws_1', { id: 'run_1', graphId: 'graph_1', missionId: 'm_1' });
    const states: ProductionGraphNodeState[] = [
      { nodeId: 'a', status: 'completed', outputJson: '{"ok":true}', startedAt: 100, endedAt: 200 },
      { nodeId: 'b', status: 'pending' },
    ];

    const set = await setNodeStates('run_1', states);
    expect(set.ok).toBe(true);

    const got = await getNodeStates('run_1');
    expect(got.ok).toBe(true);
    if (!got.ok) return;
    expect(got.value).toEqual(states);
  });

  it('returns null when the run has no checkpoint yet', async () => {
    await createRun('ws_1', { id: 'run_1', graphId: 'graph_1', missionId: 'm_1' });
    const got = await getNodeStates('run_1');
    expect(got.ok).toBe(true);
    if (got.ok) expect(got.value).toBeNull();
  });

  it('returns NOT_FOUND for a missing run', async () => {
    const got = await getNodeStates('missing');
    expect(got.ok).toBe(false);
    if (got.ok) return;
    expect(got.error.code).toBe('NOT_FOUND');
  });
});

describe('completeRun (terminal success)', () => {
  it('sets completed/review, output, totals, and stamps ended_at', async () => {
    await createRun('ws_1', { id: 'run_1', graphId: 'graph_1', missionId: 'm_1' });
    await updateRunStatus('run_1', 'queued', 'running', 'executing');

    const result = await completeRun('run_1', 'running', {
      outputJson: '{"final":true}',
      totalCostCents: 42,
      totalTokens: 1000,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.flipped).toBe(true);

    const run = await getRun('run_1');
    if (!run.ok || !run.value) return;
    expect(run.value.status).toBe('completed');
    expect(run.value.phase).toBe('review');
    expect(run.value.outputJson).toBe('{"final":true}');
    expect(run.value.totalCostCents).toBe(42);
    expect(run.value.totalTokens).toBe(1000);
    expect(run.value.endedAt).not.toBeNull();
  });

  it('does not flip when the expected status does not match', async () => {
    await createRun('ws_1', { id: 'run_1', graphId: 'graph_1', missionId: 'm_1' });
    // Row is still queued; expecting running → no change.
    const result = await completeRun('run_1', 'running', {
      outputJson: null,
      totalCostCents: 0,
      totalTokens: 0,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.flipped).toBe(false);
  });
});

describe('failRun (terminal failure)', () => {
  it('sets failed, structured error, totals, and stamps ended_at', async () => {
    await createRun('ws_1', { id: 'run_1', graphId: 'graph_1', missionId: 'm_1' });
    await updateRunStatus('run_1', 'queued', 'running', 'executing');

    const result = await failRun(
      'run_1',
      'running',
      { code: 'NODE_FAILED', message: 'node b blew up', details: { nodeId: 'b' } },
      { totalCostCents: 7, totalTokens: 50 },
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.flipped).toBe(true);

    const run = await getRun('run_1');
    if (!run.ok || !run.value) return;
    expect(run.value.status).toBe('failed');
    expect(run.value.errorMessage).toBe('node b blew up');
    expect(run.value.totalCostCents).toBe(7);
    expect(run.value.endedAt).not.toBeNull();
    const parsed = JSON.parse(run.value.errorJson ?? '{}') as { code: string };
    expect(parsed.code).toBe('NODE_FAILED');
  });

  it('falls back to the error code when message is absent', async () => {
    await createRun('ws_1', { id: 'run_1', graphId: 'graph_1', missionId: 'm_1' });
    await updateRunStatus('run_1', 'queued', 'running', 'executing');

    await failRun('run_1', 'running', { code: 'BUDGET_EXCEEDED' }, { totalCostCents: 0, totalTokens: 0 });

    const run = await getRun('run_1');
    if (run.ok) expect(run.value?.errorMessage).toBe('BUDGET_EXCEEDED');
  });

  it('does not flip when the expected status does not match', async () => {
    await createRun('ws_1', { id: 'run_1', graphId: 'graph_1', missionId: 'm_1' });
    const result = await failRun(
      'run_1',
      'running',
      { code: 'NODE_FAILED' },
      { totalCostCents: 0, totalTokens: 0 },
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.flipped).toBe(false);
  });
});

describe('DB unavailable', () => {
  it('returns DB_UNAVAILABLE when createServerClient throws', async () => {
    mocks.createServerClient.mockImplementation(() => {
      throw new Error('D1 database binding not available');
    });

    const result = await getGraphById('graph_1');
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('DB_UNAVAILABLE');
    expect(mocks.logger.error).toHaveBeenCalled();
  });
});
