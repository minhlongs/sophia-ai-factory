/**
 * Tests for agent-rollback-cron — backoff-aware retry scan, terminal
 * RETRIES_EXHAUSTED flip, atomic claim (double-scan safety), payload
 * fidelity, inputJson parsing, null D1, empty scan, multi-tenant safety.
 *
 * Mocks at the getD1 level with a STATEFUL fake that simulates the guarded
 * flip (UPDATE ... WHERE status='failed' only changes rows still failed), so
 * double-scan behavior is tested against the real SQL semantics the cron
 * relies on.
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
type CronResult = { scanned: number; retried: number; cancelled: number };
type CronHandler = () => Promise<CronResult>;
function getHandler(): CronHandler {
  return (agentRollbackCron as unknown as { _handler: CronHandler })._handler;
}

// ── Stateful fake D1 ─────────────────────────────────────────────────────────

interface FakeRunRow {
  id: string;
  agent_id: string;
  mission_id: string | null;
  workspace_id: string;
  autonomy_level: number;
  retry_count: number;
  ended_at: number | null; // epoch seconds
  error_message: string;
  input_json: string | null;
  status: string;
  phase: string;
  error_json: string | null;
  mission_type: string | null; // from LEFT JOIN creative_missions
}

interface FakePolicyRow {
  workspace_id: string;
  mission_type: string;
  max_auto_retries: number;
}

interface FakeD1 {
  db: { prepare: (sql: string) => unknown };
  runs: FakeRunRow[];
  policies: FakePolicyRow[];
  /** SQL texts executed, in order — for assertion on statement shape. */
  executedSql: string[];
}

function buildFakeD1(
  runs: FakeRunRow[],
  policies: FakePolicyRow[] = [],
  /** Force every UPDATE .run() to report this change count (race simulation). */
  forcedChangeCount?: number
): FakeD1 {
  const executedSql: string[] = [];

  const makeStmt = (sql: string) => {
    const executeAll = async (bound: unknown[]) => {
      executedSql.push(sql);
      if (sql.includes('FROM mission_type_policies')) {
        return { results: policies.map((p) => ({
          workspaceId: p.workspace_id,
          missionType: p.mission_type,
          maxAutoRetries: p.max_auto_retries,
        })) };
      }
      // SELECT failed runs — simulate the WHERE/ORDER/LIMIT of the real SQL
      const limit = typeof bound[0] === 'number' ? bound[0] : 100;
      const results = runs
        .filter((r) => r.status === 'failed')
        .sort((a, b) => (a.ended_at ?? 0) - (b.ended_at ?? 0))
        .slice(0, limit)
        .map((r) => ({
          id: r.id,
          agentId: r.agent_id,
          missionId: r.mission_id,
          workspaceId: r.workspace_id,
          autonomyLevel: r.autonomy_level,
          retryCount: r.retry_count,
          endedAt: r.ended_at,
          errorMessage: r.error_message,
          inputJson: r.input_json,
          missionType: r.mission_type,
        }));
      return { results };
    };
    const executeRun = async (bound: unknown[]) => {
      executedSql.push(sql);
      if (forcedChangeCount !== undefined) return { meta: { changes: forcedChangeCount } };
      // Guarded UPDATE: id is always the LAST bound param in both UPDATEs
      const id = bound[bound.length - 1] as string;
      const row = runs.find((r) => r.id === id);
      if (!row || row.status !== 'failed') return { meta: { changes: 0 } };
      if (sql.includes("status = 'running'")) {
        row.status = 'running';
        row.phase = 'retrying';
        row.retry_count += 1;
      } else if (sql.includes("status = 'cancelled'")) {
        row.status = 'cancelled';
        row.phase = 'cancelled';
        row.error_json = bound[0] as string;
        row.ended_at = bound[1] as number;
      }
      return { meta: { changes: 1 } };
    };
    // Real D1 allows .all()/.run() directly OR after .bind(); mirror both.
    return {
      all: () => executeAll([]),
      run: () => executeRun([]),
      bind: (...bound: unknown[]) => ({
        all: () => executeAll(bound),
        run: () => executeRun(bound),
      }),
    };
  };

  return {
    db: { prepare: (sql: string) => makeStmt(sql) },
    runs,
    policies,
    executedSql,
  };
}

function makeRun(overrides: Partial<FakeRunRow> & { id: string }): FakeRunRow {
  return {
    agent_id: 'agent_1',
    mission_id: 'm1',
    workspace_id: 'ws_1',
    autonomy_level: 2,
    retry_count: 0,
    ended_at: Math.floor(Date.now() / 1000) - 60 * 60, // failed 1h ago → always due
    error_message: 'boom',
    input_json: null,
    status: 'failed',
    phase: 'failed',
    error_json: null,
    mission_type: null,
    ...overrides,
  };
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('agentRollbackCron', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockInngestSend.mockResolvedValue(undefined);
  });

  it('SELECT has no fixed time window — only status filter + LIMIT', async () => {
    const fake = buildFakeD1([]);
    mockGetD1.mockResolvedValue(fake.db);

    await getHandler()();

    const select = fake.executedSql.find((s) => s.includes('FROM agent_runs'));
    expect(select).toBeDefined();
    expect(select).toContain("status = 'failed'");
    expect(select).toContain('LIMIT ?');
    // The old hard 30-minute cutoff must be gone
    expect(select).not.toContain('ended_at >=');
    // No SQL math — backoff is computed in JS
    expect(select).not.toMatch(/pow|POWER|EXP\(/i);
  });

  it('old run (>30 min) is retried — no longer dropped by a scan window', async () => {
    const twoHoursAgo = Math.floor(Date.now() / 1000) - 2 * 60 * 60;
    const fake = buildFakeD1([makeRun({ id: 'run_old', ended_at: twoHoursAgo, retry_count: 0 })]);
    mockGetD1.mockResolvedValue(fake.db);

    const result = await getHandler()();

    expect(result).toEqual({ scanned: 1, retried: 1, cancelled: 0 });
    expect(mockInngestSend).toHaveBeenCalledTimes(1);
    const dispatched = mockInngestSend.mock.calls[0][0] as { data: Record<string, unknown> };
    expect(dispatched.data.runId).toBe('run_old');
  });

  it('fresh failure inside backoff window → not retried this scan', async () => {
    const oneMinuteAgo = Math.floor(Date.now() / 1000) - 60; // retryCount 0 → 5 min backoff
    const fake = buildFakeD1([makeRun({ id: 'run_fresh', ended_at: oneMinuteAgo, retry_count: 0 })]);
    mockGetD1.mockResolvedValue(fake.db);

    const result = await getHandler()();

    expect(result).toEqual({ scanned: 1, retried: 0, cancelled: 0 });
    expect(mockInngestSend).not.toHaveBeenCalled();
    expect(fake.runs[0].status).toBe('failed'); // untouched
  });

  it('backoff grows with retryCount — 10-min-old run due at retryCount 1, not at 2', async () => {
    const tenMinAgo = Math.floor(Date.now() / 1000) - 10 * 60 - 5; // just past 10 min
    const due = buildFakeD1([makeRun({ id: 'run_due', ended_at: tenMinAgo, retry_count: 1 })]);
    mockGetD1.mockResolvedValue(due.db);
    expect((await getHandler()()).retried).toBe(1);

    mockInngestSend.mockClear();
    const notDue = buildFakeD1([makeRun({ id: 'run_not_due', ended_at: tenMinAgo, retry_count: 2 })]);
    mockGetD1.mockResolvedValue(notDue.db);
    expect((await getHandler()()).retried).toBe(0);
    expect(mockInngestSend).not.toHaveBeenCalled();
  });

  it('retries exhausted → terminal cancelled with RETRIES_EXHAUSTED error_json', async () => {
    const fake = buildFakeD1([
      makeRun({ id: 'run_done', retry_count: 3, error_message: 'still broken' }),
    ]);
    mockGetD1.mockResolvedValue(fake.db);

    const result = await getHandler()();

    expect(result).toEqual({ scanned: 1, retried: 0, cancelled: 1 });
    expect(mockInngestSend).not.toHaveBeenCalled();
    const row = fake.runs[0];
    expect(row.status).toBe('cancelled');
    expect(row.phase).toBe('cancelled');
    const errorJson = JSON.parse(row.error_json ?? '{}') as Record<string, unknown>;
    expect(errorJson.code).toBe('RETRIES_EXHAUSTED');
    expect(errorJson.retryCount).toBe(3);
    expect(errorJson.maxAutoRetries).toBe(3);
    expect(errorJson.lastError).toBe('still broken');
  });

  it('policy max_auto_retries overrides the default cap', async () => {
    // retry_count 1 with policy cap 1 → exhausted even though default cap is 3
    const fake = buildFakeD1(
      [makeRun({ id: 'run_pol', retry_count: 1, mission_type: 'video' })],
      [{ workspace_id: 'ws_1', mission_type: 'video', max_auto_retries: 1 }]
    );
    mockGetD1.mockResolvedValue(fake.db);

    const result = await getHandler()();

    expect(result.cancelled).toBe(1);
    expect(result.retried).toBe(0);
    const errorJson = JSON.parse(fake.runs[0].error_json ?? '{}') as Record<string, unknown>;
    expect(errorJson.code).toBe('RETRIES_EXHAUSTED');
    expect(errorJson.maxAutoRetries).toBe(1);
  });

  it('policy table unreadable → falls back to default cap without crashing', async () => {
    const db = {
      prepare: (sql: string) => ({
        bind: () => ({
          all: async () => {
            if (sql.includes('mission_type_policies')) throw new Error('no such table');
            return { results: [] };
          },
          run: async () => ({ meta: { changes: 0 } }),
        }),
      }),
    };
    mockGetD1.mockResolvedValue(db);

    const result = await getHandler()();

    expect(result).toEqual({ scanned: 0, retried: 0, cancelled: 0 });
  });

  it('double scan → no double dispatch (guarded flip WHERE status=failed)', async () => {
    const fake = buildFakeD1([makeRun({ id: 'run_dup', retry_count: 0 })]);
    mockGetD1.mockResolvedValue(fake.db);

    const first = await getHandler()();
    expect(first.retried).toBe(1);
    expect(mockInngestSend).toHaveBeenCalledTimes(1);

    // Second scan over the SAME stateful DB: row is now 'running', so the
    // SELECT no longer returns it and no second dispatch can happen.
    const second = await getHandler()();
    expect(second).toEqual({ scanned: 0, retried: 0, cancelled: 0 });
    expect(mockInngestSend).toHaveBeenCalledTimes(1);
    expect(fake.runs[0].retry_count).toBe(1); // incremented exactly once
  });

  it('concurrent claim race — guarded UPDATE reports 0 changes → no dispatch', async () => {
    // Simulates another scan flipping the row between SELECT and UPDATE: the
    // guarded UPDATE (WHERE id AND status='failed') reports meta.changes === 0
    // and the cron must skip dispatch for that row.
    const fake = buildFakeD1([makeRun({ id: 'run_race' })], [], 0);
    mockGetD1.mockResolvedValue(fake.db);

    const result = await getHandler()();

    expect(result).toEqual({ scanned: 1, retried: 0, cancelled: 0 });
    expect(mockInngestSend).not.toHaveBeenCalled();
  });

  it('payload fidelity — dispatched event has all 6 fields including inputJson', async () => {
    const fake = buildFakeD1([
      makeRun({
        id: 'run_full',
        agent_id: 'agent_full',
        mission_id: 'm_full',
        workspace_id: 'ws_full',
        autonomy_level: 3,
        retry_count: 1,
        error_message: 'timeout',
        input_json: '{"prompt":"Generate ad copy","model":"Claude-Fable"}',
      }),
    ]);
    mockGetD1.mockResolvedValue(fake.db);

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
        inputJson: { prompt: 'Generate ad copy', model: 'Claude-Fable' },
      })
    );
  });

  it('inputJson parsed from JSON string in D1 row to object in dispatch', async () => {
    const fake = buildFakeD1([
      makeRun({ id: 'run_json', input_json: '{"prompt":"Hello","temperature":0.7}' }),
    ]);
    mockGetD1.mockResolvedValue(fake.db);

    await getHandler()();

    const dispatched = mockInngestSend.mock.calls[0][0] as { data: Record<string, unknown> };
    expect(typeof dispatched.data.inputJson).toBe('object');
    expect(dispatched.data.inputJson).toEqual({ prompt: 'Hello', temperature: 0.7 });
  });

  it('malformed inputJson degrades to undefined instead of crashing the scan', async () => {
    const fake = buildFakeD1([makeRun({ id: 'run_bad_json', input_json: '{not-json' })]);
    mockGetD1.mockResolvedValue(fake.db);

    const result = await getHandler()();

    expect(result.retried).toBe(1);
    const dispatched = mockInngestSend.mock.calls[0][0] as { data: Record<string, unknown> };
    expect(dispatched.data.inputJson).toBeUndefined();
  });

  it('run without mission_id is not dispatched (executor requires a mission)', async () => {
    const fake = buildFakeD1([makeRun({ id: 'run_orphan', mission_id: null })]);
    mockGetD1.mockResolvedValue(fake.db);

    const result = await getHandler()();

    expect(result).toEqual({ scanned: 1, retried: 0, cancelled: 0 });
    expect(mockInngestSend).not.toHaveBeenCalled();
    expect(fake.runs[0].status).toBe('failed'); // left failed, surfaced via warn log
  });

  it('NULL ended_at is treated as immediately due (row never stranded)', async () => {
    const fake = buildFakeD1([makeRun({ id: 'run_null_ended', ended_at: null })]);
    mockGetD1.mockResolvedValue(fake.db);

    const result = await getHandler()();

    expect(result.retried).toBe(1);
  });

  it('D1 null → { scanned: 0, retried: 0, cancelled: 0 }', async () => {
    mockGetD1.mockResolvedValue(null);

    const result = await getHandler()();

    expect(result).toEqual({ scanned: 0, retried: 0, cancelled: 0 });
    expect(mockInngestSend).not.toHaveBeenCalled();
  });

  it('empty scan → { scanned: 0, retried: 0, cancelled: 0 }', async () => {
    const fake = buildFakeD1([]);
    mockGetD1.mockResolvedValue(fake.db);

    const result = await getHandler()();

    expect(result).toEqual({ scanned: 0, retried: 0, cancelled: 0 });
    expect(mockInngestSend).not.toHaveBeenCalled();
  });

  it('multi-tenant safety — each row dispatched with its own workspace payload', async () => {
    const fake = buildFakeD1([
      makeRun({ id: 'run_a', agent_id: 'agent_a', mission_id: 'm_a', workspace_id: 'ws_TENANT_A' }),
      makeRun({
        id: 'run_b',
        agent_id: 'agent_b',
        mission_id: 'm_b',
        workspace_id: 'ws_TENANT_B',
        autonomy_level: 3,
        retry_count: 1,
        input_json: '{"prompt":"B prompt"}',
      }),
    ]);
    mockGetD1.mockResolvedValue(fake.db);

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

  it('mixed batch — due retried, not-due skipped, exhausted cancelled in one scan', async () => {
    const nowSec = Math.floor(Date.now() / 1000);
    const fake = buildFakeD1([
      makeRun({ id: 'run_due', ended_at: nowSec - 3600, retry_count: 0 }),
      makeRun({ id: 'run_backoff', ended_at: nowSec - 60, retry_count: 0 }),
      makeRun({ id: 'run_exhausted', ended_at: nowSec - 3600, retry_count: 3 }),
    ]);
    mockGetD1.mockResolvedValue(fake.db);

    const result = await getHandler()();

    expect(result).toEqual({ scanned: 3, retried: 1, cancelled: 1 });
    expect(mockInngestSend).toHaveBeenCalledTimes(1);
    expect((mockInngestSend.mock.calls[0][0] as { data: Record<string, unknown> }).data.runId).toBe('run_due');
    expect(fake.runs.find((r) => r.id === 'run_backoff')?.status).toBe('failed');
    expect(fake.runs.find((r) => r.id === 'run_exhausted')?.status).toBe('cancelled');
  });
});
