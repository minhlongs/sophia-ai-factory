/**
 * Tests for tree/performance module (Sophia 2027 Phase 3).
 *
 * Covers: PerformanceEvent CRUD, Experiment lifecycle,
 *         D1_UNAVAILABLE + INSERT_FAILED + NOT_FOUND + INVALID_TRANSITION errors,
 *         row↔domain mapping, aggregation, edge cases.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

import type { PerformanceErrorCode } from '../index';

// ─── Mock setup ────────────────────────────────────────────────────────────

const mocks = vi.hoisted(() => ({
  mockGetD1: vi.fn(),
}));

vi.mock('@/seed/db/client', () => ({
  getD1: mocks.mockGetD1,
}));

function stmt(opts: {
  first?: unknown;
  all?: { results?: unknown[] };
  run?: unknown;
}) {
  return {
    bind: vi.fn().mockReturnThis(),
    first: vi.fn().mockResolvedValue(opts.first ?? null),
    all: vi.fn().mockResolvedValue(opts.all ?? { results: [] }),
    run: vi.fn().mockResolvedValue(opts.run ?? { success: true, meta: { changes: 1, duration: 1 } }),
  };
}

function buildDb(stmts: ReturnType<typeof stmt>[]) {
  let callIdx = 0;
  return {
    prepare: vi.fn().mockImplementation(() => {
      if (callIdx >= stmts.length) throw new Error('No more prepared stmts mocked');
      return stmts[callIdx++];
    }),
  };
}

// ─── Test data ─────────────────────────────────────────────────────────────

const NOW_S = Math.floor(Date.now() / 1000);

function makeEvent(overrides: Partial<import('@/seed/types/creative-domain').PerformanceEvent> = {}) {
  return {
    id: 'pevt_00000000000000000000000000000001',
    workspaceId: 'ws_001',
    assetId: 'asset_001',
    projectId: 'proj_001',
    channel: 'youtube',
    eventType: 'view',
    count: 100,
    valueCents: 500,
    recordedAt: NOW_S,
    ...overrides,
  };
}

function makeExperiment(overrides: Partial<import('@/seed/types/creative-domain').Experiment> = {}) {
  return {
    id: 'exp_00000000000000000000000000000001',
    workspaceId: 'ws_001',
    projectId: 'proj_001',
    hypothesis: 'Thumbnail B outperforms A',
    metric: 'click_through_rate',
    audience: 'SEA millennials',
    channel: 'youtube',
    status: 'draft' as const,
    variants: [
      { id: 'var_a', experimentId: 'exp_00000000000000000000000000000001', name: 'A', description: 'Control', trafficPercent: 50 },
      { id: 'var_b', experimentId: 'exp_00000000000000000000000000000001', name: 'B', description: 'Variant', trafficPercent: 50 },
    ],
    createdAt: NOW_S,
    updatedAt: NOW_S,
    ...overrides,
  };
}

// ─── PerformanceEvent tests ────────────────────────────────────────────────

describe('PerformanceEvent repository', () => {
  beforeEach(() => {
    mocks.mockGetD1.mockClear();
  });

  describe('newPerformanceEventId', () => {
    it('generates a pevt_ prefixed ID with 32 hex chars', async () => {
      const events = await import('../index');
      const id = (events as any).newPerformanceEventId();
      expect(id).toMatch(/^pevt_[0-9a-f]{32}$/);
    });
  });

  describe('recordPerformanceEvent', () => {
    it('inserts a performance event successfully', async () => {
      const { recordPerformanceEvent } = await import('../index');
      const s = stmt({});
      mocks.mockGetD1.mockReturnValue(buildDb([s]));

      await recordPerformanceEvent(makeEvent());

      expect(s.run).toHaveBeenCalled();
    });

    it('throws D1_UNAVAILABLE when getD1 returns null', async () => {
      const { recordPerformanceEvent } = await import('../index');
      mocks.mockGetD1.mockReturnValue(null);

      try {
        await recordPerformanceEvent(makeEvent());
        throw new Error('should have thrown');
      } catch (err) {
        expect(err).toBeInstanceOf(Error);
        expect((err as any).code).toBe('D1_UNAVAILABLE');
      }
    });

    it('wraps DB errors with INSERT_FAILED code', async () => {
      const { recordPerformanceEvent } = await import('../index');
      const failingStmt = {
        bind: vi.fn().mockReturnThis(),
        run: vi.fn().mockRejectedValue(new Error('DB write failed')),
      };
      mocks.mockGetD1.mockReturnValue({ prepare: () => failingStmt });

      try {
        await recordPerformanceEvent(makeEvent());
        throw new Error('should have thrown');
      } catch (err) {
        expect(err).toBeInstanceOf(Error);
        expect((err as any).code).toBe('INSERT_FAILED');
      }
    });
  });

  describe('getPerformanceEvents', () => {
    it('returns events filtered by workspace', async () => {
      const { getPerformanceEvents } = await import('../index');
      const event = makeEvent();
      const row = {
        id: event.id, workspace_id: event.workspaceId, asset_id: event.assetId,
        project_id: event.projectId, channel: event.channel, event_type: event.eventType,
        count: event.count, value_cents: event.valueCents, recorded_at: event.recordedAt,
        raw_data: null,
      };
      const s = stmt({ all: { results: [row] } });
      mocks.mockGetD1.mockReturnValue(buildDb([s]));

      const results = await getPerformanceEvents('ws_001');

      expect(results).toHaveLength(1);
      expect(results[0].id).toBe(event.id);
      expect(results[0].workspaceId).toBe('ws_001');
    });

    it('applies optional filters (projectId, channel, dateRange)', async () => {
      const { getPerformanceEvents } = await import('../index');
      const s = stmt({ all: { results: [] } });
      mocks.mockGetD1.mockReturnValue(buildDb([s]));

      await getPerformanceEvents('ws_001', {
        projectId: 'proj_001',
        channel: 'youtube',
        dateRange: { from: NOW_S - 86400, to: NOW_S },
      });

      expect(s.bind).toHaveBeenCalled();
    });

    it('throws D1_UNAVAILABLE when getD1 returns null', async () => {
      const { getPerformanceEvents } = await import('../index');
      mocks.mockGetD1.mockReturnValue(null);

      try {
        await getPerformanceEvents('ws_001');
        throw new Error('should have thrown');
      } catch (err) {
        expect(err).toBeInstanceOf(Error);
        expect((err as any).code).toBe('D1_UNAVAILABLE');
      }
    });
  });
});

// ─── Experiment tests ──────────────────────────────────────────────────────

describe('Experiment repository', () => {
  beforeEach(() => {
    mocks.mockGetD1.mockClear();
  });

  describe('newExperimentId', () => {
    it('generates an exp_ prefixed ID with 32 hex chars', async () => {
      const experiment = await import('../index');
      const id = (experiment as any).newExperimentId();
      expect(id).toMatch(/^exp_[0-9a-f]{32}$/);
    });
  });

  describe('createExperiment', () => {
    it('inserts experiment and its variants', async () => {
      const { createExperiment } = await import('../index');
      const exp = makeExperiment();
      const expStmt = stmt({});
      const varStmt1 = stmt({});
      const varStmt2 = stmt({});
      mocks.mockGetD1.mockReturnValue(buildDb([expStmt, varStmt1, varStmt2]));

      await createExperiment(exp);

      expect(expStmt.bind).toHaveBeenCalled();
      expect(varStmt1.bind).toHaveBeenCalled();
      expect(varStmt2.bind).toHaveBeenCalled();
    });

    it('throws INSERT_FAILED on DB error', async () => {
      const { createExperiment } = await import('../index');
      const failingStmt = {
        bind: vi.fn().mockReturnThis(),
        run: vi.fn().mockRejectedValue(new Error('constraint violation')),
      };
      mocks.mockGetD1.mockReturnValue({ prepare: () => failingStmt });

      try {
        await createExperiment(makeExperiment());
        throw new Error('should have thrown');
      } catch (err) {
        expect(err).toBeInstanceOf(Error);
        expect((err as any).code).toBe('INSERT_FAILED');
      }
    });
  });

  describe('getExperiment', () => {
    it('returns experiment with variants', async () => {
      const { getExperiment } = await import('../index');
      const exp = makeExperiment();
      const expRow = {
        id: exp.id, workspace_id: exp.workspaceId, project_id: exp.projectId,
        hypothesis: exp.hypothesis, metric: exp.metric, audience: exp.audience,
        channel: exp.channel, status: exp.status, started_at: null, ended_at: null,
        winner_variant_id: null, confidence: null, result: null,
        created_at: exp.createdAt, updated_at: exp.updatedAt,
      };
      const varRows = [
        { id: 'var_a', experiment_id: exp.id, name: 'A', description: 'Control', asset_id: null, traffic_percent: 50 },
        { id: 'var_b', experiment_id: exp.id, name: 'B', description: 'Variant', asset_id: null, traffic_percent: 50 },
      ];
      const expStmt = stmt({ first: expRow });
      const varStmt = stmt({ all: { results: varRows } });
      mocks.mockGetD1.mockReturnValue(buildDb([expStmt, varStmt]));

      const result = await getExperiment(exp.id);

      expect(result.id).toBe(exp.id);
      expect(result.variants).toHaveLength(2);
      expect(result.variants[0].name).toBe('A');
    });

    it('throws NOT_FOUND when experiment does not exist', async () => {
      const { getExperiment } = await import('../index');
      const s1 = stmt({ first: null });
      const s2 = stmt({ all: { results: [] } });
      const s3 = stmt({});
      const s4 = stmt({});
      mocks.mockGetD1.mockReturnValue(buildDb([s1, s2, s3, s4]));

      try {
        await getExperiment('nonexistent');
        throw new Error('should have thrown');
      } catch (err) {
        expect(err).toBeInstanceOf(Error);
        expect((err as any).code).toBe('NOT_FOUND');
      }
    });

    it('throws D1_UNAVAILABLE when getD1 returns null', async () => {
      const { getExperiment } = await import('../index');
      mocks.mockGetD1.mockReturnValue(null);

      try {
        await getExperiment('exp_001');
        throw new Error('should have thrown');
      } catch (err) {
        expect(err).toBeInstanceOf(Error);
        expect((err as any).code).toBe('D1_UNAVAILABLE');
      }
    });
  });

  describe('listExperiments', () => {
    it('returns experiments filtered by workspace', async () => {
      const { listExperiments } = await import('../index');
      const exp = makeExperiment();
      const row = {
        id: exp.id, workspace_id: exp.workspaceId, project_id: exp.projectId,
        hypothesis: exp.hypothesis, metric: exp.metric, audience: exp.audience,
        channel: exp.channel, status: exp.status, started_at: null, ended_at: null,
        winner_variant_id: null, confidence: null, result: null,
        created_at: exp.createdAt, updated_at: exp.updatedAt,
      };
      const s = stmt({ all: { results: [row] } });
      mocks.mockGetD1.mockReturnValue(buildDb([s]));

      const results = await listExperiments('ws_001');

      expect(results).toHaveLength(1);
    });
  });

  describe('startExperiment', () => {
    it('transitions draft → running', async () => {
      const { startExperiment } = await import('../index');
      const exp = makeExperiment({ status: 'draft' });
      const draftRow = {
        id: exp.id, workspace_id: exp.workspaceId, project_id: exp.projectId,
        hypothesis: exp.hypothesis, metric: exp.metric, audience: exp.audience,
        channel: exp.channel, status: 'draft', started_at: null, ended_at: null,
        winner_variant_id: null, confidence: null, result: null,
        created_at: exp.createdAt, updated_at: exp.updatedAt,
      };
      const runningRow = { ...draftRow, status: 'running', started_at: NOW_S };
      const getStmt = stmt({ first: draftRow });
      const updateStmt = stmt({});
      const fetchStmt = stmt({ first: runningRow });
      const varStmt = stmt({ all: { results: [] } });
      mocks.mockGetD1.mockReturnValue(buildDb([getStmt, updateStmt, fetchStmt, varStmt]));

      const result = await startExperiment(exp.id);

      expect(result.status).toBe('running');
      expect(result.startedAt).toBe(NOW_S);
    });

    it('throws INVALID_TRANSITION for running → running', async () => {
      const { startExperiment } = await import('../index');
      const runningRow = {
        id: 'exp_001', workspace_id: 'ws_001', project_id: 'proj_001',
        hypothesis: 'test', metric: 'ctr', audience: 'all', channel: 'yt',
        status: 'running', started_at: NOW_S, ended_at: null,
        winner_variant_id: null, confidence: null, result: null,
        created_at: NOW_S, updated_at: NOW_S,
      };
      const s1 = stmt({ first: runningRow });
      const s2 = stmt({});
      const s3 = stmt({ first: runningRow });
      const s4 = stmt({ all: { results: [] } });
      mocks.mockGetD1.mockReturnValue(buildDb([s1, s2, s3, s4]));

      try {
        await startExperiment('exp_001');
        throw new Error('should have thrown');
      } catch (err) {
        expect(err).toBeInstanceOf(Error);
        expect((err as any).code).toBe('INVALID_TRANSITION');
      }
    });
  });

  describe('completeExperiment', () => {
    it('transitions running → completed with winner', async () => {
      const { completeExperiment } = await import('../index');
      const runningRow = {
        id: 'exp_001', workspace_id: 'ws_001', project_id: 'proj_001',
        hypothesis: 'test', metric: 'ctr', audience: 'all', channel: 'yt',
        status: 'running', started_at: NOW_S, ended_at: null,
        winner_variant_id: null, confidence: null, result: null,
        created_at: NOW_S, updated_at: NOW_S,
      };
      const completedRow = { ...runningRow, status: 'completed', ended_at: NOW_S, winner_variant_id: 'var_b', confidence: 0.95 };
      const getStmt = stmt({ first: runningRow });
      const updateStmt = stmt({});
      const fetchStmt = stmt({ first: completedRow });
      const varStmt = stmt({ all: { results: [] } });
      mocks.mockGetD1.mockReturnValue(buildDb([getStmt, updateStmt, fetchStmt, varStmt]));

      const result = await completeExperiment('exp_001', {
        winnerVariantId: 'var_b',
        confidence: 0.95,
        result: 'B wins',
      });

      expect(result.status).toBe('completed');
      expect(result.winnerVariantId).toBe('var_b');
      expect(result.confidence).toBe(0.95);
    });

    it('throws INVALID_TRANSITION for draft → completed', async () => {
      const { completeExperiment } = await import('../index');
      const draftRow = {
        id: 'exp_001', workspace_id: 'ws_001', project_id: 'proj_001',
        hypothesis: 'test', metric: 'ctr', audience: 'all', channel: 'yt',
        status: 'draft', started_at: null, ended_at: null,
        winner_variant_id: null, confidence: null, result: null,
        created_at: NOW_S, updated_at: NOW_S,
      };
      const s1 = stmt({ first: draftRow });
      const s2 = stmt({});
      const s3 = stmt({ first: draftRow });
      const s4 = stmt({ all: { results: [] } });
      mocks.mockGetD1.mockReturnValue(buildDb([s1, s2, s3, s4]));

      try {
        await completeExperiment('exp_001');
        throw new Error('should have thrown');
      } catch (err) {
        expect(err).toBeInstanceOf(Error);
        expect((err as any).code).toBe('INVALID_TRANSITION');
      }
    });
  });

  describe('recordExperimentResult', () => {
    it('inserts a result for an experiment variant', async () => {
      const { recordExperimentResult } = await import('../index');
      const s = stmt({});
      mocks.mockGetD1.mockReturnValue(buildDb([s]));

      await recordExperimentResult('exp_001', 'var_a', {
        sampleSize: 1000,
        conversions: 45,
        conversionRate: 4.5,
        revenueCents: 2250,
        metadata: { source: 'utm_test' },
      });

      expect(s.run).toHaveBeenCalled();
    });

    it('throws INSERT_FAILED on DB error', async () => {
      const { recordExperimentResult } = await import('../index');
      const failingStmt = {
        bind: vi.fn().mockReturnThis(),
        run: vi.fn().mockRejectedValue(new Error('FK constraint')),
      };
      mocks.mockGetD1.mockReturnValue({ prepare: () => failingStmt });

      try {
        await recordExperimentResult('exp_001', 'var_a', {
          sampleSize: 100, conversions: 5, conversionRate: 5,
          revenueCents: 250, metadata: {},
        });
        throw new Error('should have thrown');
      } catch (err) {
        expect(err).toBeInstanceOf(Error);
        expect((err as any).code).toBe('INSERT_FAILED');
      }
    });
  });

  describe('getExperimentResults', () => {
    it('returns results with variant info via JOIN', async () => {
      const { getExperimentResults } = await import('../index');
      const s = stmt({
        all: {
          results: [
            {
              id: 'eres_001', experiment_id: 'exp_001', variant_id: 'var_a',
              sample_size: 500, conversions: 20, conversion_rate: 4.0,
              revenue_cents: 1000, metadata: '{}', recorded_at: NOW_S,
              variant_name: 'A',
            },
          ],
        },
      });
      mocks.mockGetD1.mockReturnValue(buildDb([s]));

      const results = await getExperimentResults('exp_001');

      expect(results).toHaveLength(1);
      expect(results[0].variantId).toBe('var_a');
      expect(results[0].sampleSize).toBe(500);
    });

    it('returns empty array when no results exist', async () => {
      const { getExperimentResults } = await import('../index');
      const s = stmt({ all: { results: [] } });
      mocks.mockGetD1.mockReturnValue(buildDb([s]));

      const results = await getExperimentResults('exp_empty');

      expect(results).toHaveLength(0);
    });
  });
});

// ─── Row mapping tests ─────────────────────────────────────────────────────

describe('Row mapping', () => {
  it('performanceRowToDomain converts snake_case to camelCase', async () => {
    const { performanceRowToDomain } = await import('../index');
    const row = {
      id: 'pevt_001', workspace_id: 'ws_001', asset_id: 'asset_001',
      project_id: 'proj_001', channel: 'youtube', event_type: 'view',
      count: 10, value_cents: 50, recorded_at: NOW_S, raw_data: '{"key":"val"}',
    };
    const domain = performanceRowToDomain(row);

    expect(domain.workspaceId).toBe('ws_001');
    expect(domain.eventType).toBe('view');
    expect(domain.rawData).toEqual({ key: 'val' });
  });

  it('experimentRowToDomain handles null optional fields', async () => {
    const { experimentRowToDomain } = await import('../index');
    const row = {
      id: 'exp_001', workspace_id: 'ws_001', project_id: 'proj_001',
      hypothesis: 'test', metric: 'ctr', audience: 'all', channel: 'yt',
      status: 'draft' as const, started_at: null, ended_at: null,
      winner_variant_id: null, confidence: null, result: null,
      created_at: NOW_S, updated_at: NOW_S,
    };
    const domain = experimentRowToDomain(row);

    expect(domain.startedAt).toBeUndefined();
    expect(domain.confidence).toBeUndefined();
    expect(domain.variants).toEqual([]);
  });
});

// ─── isValidTransition tests ───────────────────────────────────────────────

describe('isValidTransition', () => {
  it('allows draft → running', async () => {
    const { isValidTransition } = await import('../index');
    expect(isValidTransition('draft', 'running')).toBe(true);
  });

  it('allows draft → cancelled', async () => {
    const { isValidTransition } = await import('../index');
    expect(isValidTransition('draft', 'cancelled')).toBe(true);
  });

  it('allows running → completed', async () => {
    const { isValidTransition } = await import('../index');
    expect(isValidTransition('running', 'completed')).toBe(true);
  });

  it('blocks completed → running', async () => {
    const { isValidTransition } = await import('../index');
    expect(isValidTransition('completed', 'running')).toBe(false);
  });

  it('blocks cancelled → running', async () => {
    const { isValidTransition } = await import('../index');
    expect(isValidTransition('cancelled', 'running')).toBe(false);
  });
});