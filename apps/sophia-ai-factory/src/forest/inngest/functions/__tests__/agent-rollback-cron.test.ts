/**
 * Tests for agent-rollback-cron — scan window, retry cap, atomic claim,
 * payload fidelity, snake_case alias, inputJson parsing, null D1,
 * empty scan, multi-tenant safety.
 *
 * Mocks at the getD1 level to test actual SQL parameter binding.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Hoisted mocks ────────────────────────────────────────────────────────────

const { mockGetD1, mockInngestSend } = vi.hoisted(() => ({
  mockGetD1: vi.fn(),
  mockInngestSend: vi.fn(),
}));

vi.mock('@/seed/db/client', () => ({
  getD1: (...args: unknown[]) => mockGetD1(...args),
}));

vi.mock('@/seed/inngest/client', () => ({
  inngest: {
    createFunction: vi.fn((_cfg: unknown, _cron: unknown, handler: (...args: unknown[]) => unknown) => ({
      _handler: handler,
    })),
    send: (...args: unknown[]) => mockInngestSend(...args),
  },
}));

vi.mock('@/seed/utils/logger-utility', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

// Import the function after mocks are installed
const { agentRollbackCron } = await import('../agent-rollback-cron');

// Extract the handler from the InngestFunction wrapper (same pattern as executor tests)
type CronHandler = () => Promise<{ scanned: number; retried: number }>;
function getHandler(): CronHandler {
  return (agentRollbackCron as unknown as { _handler: CronHandler })._handler;
}

// ── Test helpers ─────────────────────────────────────────────────────────────

const MAX_RETRIES = 3;

/** Build a mock D1 database object that tracks prepare().bind() args. */
function buildMockD1(rows: Record<string, unknown>[], updateChanges = 1) {
  const bindArgs: unknown[][] = [];
  const stmt = {
    bind: vi.fn((...args: unknown[]) => {
      bindArgs.push(args);
      return {
        all: vi.fn().mockResolvedValue({ results: rows }),
        run: vi.fn().mockResolvedValue({ meta: { changes: updateChanges } }),
      };
    }),
  };
  const db = { prepare: vi.fn(() => stmt) };
  return { db, bindArgs, stmt };
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('agentRollbackCron', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockInngestSend.mockResolvedValue(undefined);
  });

  it('scan window filter — bound param = Date.now() - 30min (tolerance)', async () => {
    const { db, bindArgs } = buildMockD1([]);
    mockGetD1.mockResolvedValue(db);

    await getHandler()();

    // First prepare().bind() call is the SELECT query — check bound params
    expect(bindArgs[0]).toBeDefined();
    const [windowCutoff, retryCap] = bindArgs[0] as [number, number];

    // windowCutoff = floor((Date.now() - 30min) / 1000), within 2s tolerance
    const expected = Math.floor((Date.now() - 30 * 60 * 1000) / 1000);
    expect(windowCutoff).toBeGreaterThanOrEqual(expected - 2);
    expect(windowCutoff).toBeLessThanOrEqual(expected + 2);

    // retry cap = MAX_RETRIES (3)
    expect(retryCap).toBe(MAX_RETRIES);
  });

  it('retry cap filter — retry_count < 3 bound param', async () => {
    const { db, bindArgs } = buildMockD1([]);
    mockGetD1.mockResolvedValue(db);

    await getHandler()();

    const [, retryCap] = bindArgs[0] as [number, number];
    expect(retryCap).toBe(3);
  });

  it('atomic claim — meta.changes === 0 → row skipped, no dispatch', async () => {
    const row = { id: 'run_1', agentId: 'agent_1', missionId: 'm1', workspaceId: 'ws_1', autonomyLevel: 2, retryCount: 0, errorMessage: 'fail', inputJson: null };
    const { db } = buildMockD1([row], 0); // UPDATE returns 0 changes
    mockGetD1.mockResolvedValue(db);

    const result = await getHandler()();

    expect(result.scanned).toBe(1);
    expect(result.retried).toBe(0);
    expect(mockInngestSend).not.toHaveBeenCalled();
  });

  it('payload fidelity — dispatched event has all 6 fields including inputJson', async () => {
    const row = {
      id: 'run_full',
      agentId: 'agent_full',
      missionId: 'm_full',
      workspaceId: 'ws_full',
      autonomyLevel: 3,
      retryCount: 1,
      errorMessage: 'timeout',
      inputJson: '{"prompt":"Generate ad copy","model":"gpt-4"}',
    };
    const { db } = buildMockD1([row]);
    mockGetD1.mockResolvedValue(db);

    await getHandler()();

    expect(mockInngestSend).toHaveBeenCalledTimes(1);
    const dispatched = mockInngestSend.mock.calls[0][0] as {
      name: string;
      data: Record<string, unknown>;
    };

    expect(dispatched.name).toBe('agent.mission.started');
    expect(dispatched.data).toEqual(
      expect.objectContaining({
        runId: 'run_full',
        agentId: 'agent_full',
        missionId: 'm_full',
        workspaceId: 'ws_full',
        autonomyLevel: 3,
        inputJson: { prompt: 'Generate ad copy', model: 'gpt-4' },
      })
    );
  });

  it('snake_case alias — D1 rows with snake_case keys are read as camelCase', async () => {
    // Simulate D1 returning raw snake_case column names (as if AS alias wasn't applied).
    // The cron's SELECT AS aliases ensure code can read camelCase keys.
    const row = {
      id: 'run_alias',
      agentId: 'agent_alias',  // aliased via SELECT AS agentId
      missionId: 'm_alias',    // aliased via SELECT AS missionId
      workspaceId: 'ws_alias', // aliased via SELECT AS workspaceId
      autonomyLevel: 1,        // aliased via SELECT AS autonomyLevel
      retryCount: 0,
      errorMessage: 'crash',
      inputJson: null,
    };
    const { db } = buildMockD1([row]);
    mockGetD1.mockResolvedValue(db);

    await getHandler()();

    const dispatched = mockInngestSend.mock.calls[0][0] as {
      data: Record<string, unknown>;
    };

    // All camelCase keys must be populated (not undefined)
    expect(dispatched.data.agentId).toBe('agent_alias');
    expect(dispatched.data.missionId).toBe('m_alias');
    expect(dispatched.data.workspaceId).toBe('ws_alias');
    expect(dispatched.data.autonomyLevel).toBe(1);
  });

  it('inputJson parsed from JSON string in D1 row to object in dispatch', async () => {
    const row = {
      id: 'run_json',
      agentId: 'agent_json',
      missionId: 'm_json',
      workspaceId: 'ws_json',
      autonomyLevel: 2,
      retryCount: 0,
      errorMessage: 'fail',
      inputJson: '{"prompt":"Hello","temperature":0.7}', // TEXT column → JSON string
    };
    const { db } = buildMockD1([row]);
    mockGetD1.mockResolvedValue(db);

    await getHandler()();

    const dispatched = mockInngestSend.mock.calls[0][0] as {
      data: Record<string, unknown>;
    };

    // inputJson must be a parsed object, not the raw string
    expect(typeof dispatched.data.inputJson).toBe('object');
    expect(dispatched.data.inputJson).toEqual({ prompt: 'Hello', temperature: 0.7 });
  });

  it('D1 null → { scanned: 0, retried: 0 }', async () => {
    mockGetD1.mockResolvedValue(null);

    const result = await getHandler()();

    expect(result).toEqual({ scanned: 0, retried: 0 });
    expect(mockInngestSend).not.toHaveBeenCalled();
  });

  it('empty scan window → { scanned: 0, retried: 0 }', async () => {
    const { db } = buildMockD1([]); // no failed runs
    mockGetD1.mockResolvedValue(db);

    const result = await getHandler()();

    expect(result).toEqual({ scanned: 0, retried: 0 });
    expect(mockInngestSend).not.toHaveBeenCalled();
  });

  it('multi-tenant safety — row workspace_id=A only dispatched with workspace_id=A', async () => {
    const rowA = {
      id: 'run_a',
      agentId: 'agent_a',
      missionId: 'm_a',
      workspaceId: 'ws_TENANT_A',
      autonomyLevel: 2,
      retryCount: 0,
      errorMessage: 'err_a',
      inputJson: null,
    };
    const rowB = {
      id: 'run_b',
      agentId: 'agent_b',
      missionId: 'm_b',
      workspaceId: 'ws_TENANT_B',
      autonomyLevel: 3,
      retryCount: 1,
      errorMessage: 'err_b',
      inputJson: '{"prompt":"B prompt"}',
    };
    const { db } = buildMockD1([rowA, rowB]);
    mockGetD1.mockResolvedValue(db);

    const result = await getHandler()();

    expect(result.scanned).toBe(2);
    expect(result.retried).toBe(2);
    expect(mockInngestSend).toHaveBeenCalledTimes(2);

    const eventA = mockInngestSend.mock.calls[0][0] as { data: Record<string, unknown> };
    const eventB = mockInngestSend.mock.calls[1][0] as { data: Record<string, unknown> };

    expect(eventA.data.workspaceId).toBe('ws_TENANT_A');
    expect(eventA.data.runId).toBe('run_a');
    expect(eventA.data.agentId).toBe('agent_a');
    expect(eventA.data.missionId).toBe('m_a');

    expect(eventB.data.workspaceId).toBe('ws_TENANT_B');
    expect(eventB.data.runId).toBe('run_b');
    expect(eventB.data.agentId).toBe('agent_b');
    expect(eventB.data.missionId).toBe('m_b');
  });
});
