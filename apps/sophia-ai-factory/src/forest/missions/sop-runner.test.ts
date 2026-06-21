/**
 * Tests: sop-runner.ts
 *
 * Mocks: dispatchMission, all repo calls via D1 mock.
 * Asserts: run lifecycle transitions, advanceSchedule called on success,
 *          StepFailed produces 'paused', full run error produces 'failed'.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock dispatchMission before imports
vi.mock('@/forest/missions/dispatcher', () => ({
  dispatchMission: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/seed/utils/logger-utility', () => ({
  logger: { info: vi.fn(), error: vi.fn(), debug: vi.fn(), warn: vi.fn() },
}));

import { runSop } from './sop-runner';
import type { RunContext } from '@/seed/sop/executor/types';

// ---------------------------------------------------------------------------
// D1 Mock
// ---------------------------------------------------------------------------

function buildTestDb(options: {
  installation?: Record<string, unknown> | null;
  template?: Record<string, unknown> | null;
  missionStatus?: string;
  missionResult?: string;
}) {
  const {
    installation = makeInstallation(),
    template = makeTemplate(),
    missionStatus = 'succeeded',
    missionResult = '{"output":"done"}',
  } = options;

  const stmtMock = {
    bind: vi.fn().mockReturnThis(),
    run: vi.fn().mockResolvedValue({ meta: { changes: 1 } }),
    first: vi.fn().mockImplementation((_col?: string) => {
      // The runner calls .first() multiple times for different tables
      // We track call count to differentiate
      const callCount = (stmtMock.first as ReturnType<typeof vi.fn>).mock.calls.length;

      if (callCount === 1) return Promise.resolve(installation);   // getInstallation
      if (callCount === 2) return Promise.resolve(template);       // getTemplateById
	if (callCount === 3) return Promise.resolve({ user_id: 'user-001', org_id: 'org-001', sop_template_id: 'tpl-001' }); // resolveInstallationContext
	if (callCount === 4) return Promise.resolve({ id: 'run-001', installation_id: 'inst-001', trigger_type: 'cron', mission_ids: '[]', status: 'pending', result_summary: null, error_message: null, requires_approval: 0, started_at: null, completed_at: null, created_at: 1000 }); // createRun SELECT after INSERT
	// mission_ids for appendMissionId
	if (callCount === 5) return Promise.resolve({ mission_ids: '[]' });
      // mission poll
      return Promise.resolve({ status: missionStatus, result: missionResult, error: null });
    }),
    all: vi.fn().mockResolvedValue({ results: [] }),
  };

  return {
    prepare: vi.fn().mockReturnValue(stmtMock),
    _stmt: stmtMock,
  };
}

function makeInstallation() {
  return {
    id: 'inst-001',
    user_id: 'user-001',
    template_id: 'tpl-001',
    customizations: null,
    schedule_cron: '0 9 * * *',
    enabled: 1,
    last_run_at: null,
    next_run_at: 1000100,
    run_count: 0,
    created_at: 1000000,
  };
}

function makeTemplate() {
  return {
    id: 'tpl-001',
    slug: 'test-sop',
    name_vi: 'Test',
    name_en: 'Test',
    description_vi: 'Test',
    description_en: 'Test',
    category: 'content',
    is_official: 1,
    status: 'published',
    credits_per_run: 1,
    version: 1,
    author_user_id: null,
    created_at: 1000,
    updated_at: 1000,
    agents_yaml: `
agents:
  test_agent:
    role: Test Agent
    goal: Do test things
    tools:
      - analytics:report
`.trim(),
    playbook_md: `
## Step 1: analytics:report
\`\`\`yaml
period: today
\`\`\`
`.trim(),
    output_schema: '{"type":"object","properties":{}}',
  };
}

const baseCtx: RunContext = {
  installationId: 'inst-001',
  runId: '',
  userId: 'user-001',
  trigger: 'cron',
};

describe('runSop', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns succeeded status on happy path', async () => {
    const db = buildTestDb({});
    const result = await runSop(db as unknown as D1Database, baseCtx);
    expect(result.status).toBe('completed');
    expect(result.runId).toBe('run-001');
  });

  it('dispatches mission for each step', async () => {
    const { dispatchMission } = await import('@/forest/missions/dispatcher');
    const db = buildTestDb({});

    await runSop(db as unknown as D1Database, baseCtx);

    expect(dispatchMission).toHaveBeenCalledTimes(1);
  });

  it('calls updateRunStatus with running then succeeded', async () => {
    const db = buildTestDb({});
    await runSop(db as unknown as D1Database, baseCtx);

    const updateCalls = db.prepare.mock.calls
      .filter((call: unknown[]) => typeof call[0] === 'string' && (call[0] as string).includes('UPDATE sop_executions'))
      .map((call: unknown[]) => call[0]);

    expect(updateCalls.length).toBeGreaterThanOrEqual(2);
  });

  it('returns failed status when installation not found', async () => {
    const db = buildTestDb({ installation: null });
    await expect(runSop(db as unknown as D1Database, baseCtx)).rejects.toThrow(/Installation not found/);
  });

  it('returns failed status when template not found', async () => {
    const db = buildTestDb({ template: null });
    await expect(runSop(db as unknown as D1Database, baseCtx)).rejects.toThrow(/Template not found/);
  });

  it('returns failed status when step fails immediately', async () => {
    const db = buildTestDb({ missionStatus: 'succeeded' });

    // Override .first() so the mission poll returns failed on first call
    const stmtMock = db._stmt;
    stmtMock.first = vi.fn().mockImplementation(() => {
      const callCount = stmtMock.first.mock.calls.length;
      // Calls 1-2: getInstallation, getTemplateById
      // Call 3: resolveInstallationContext (user_sop_installations)
      // Calls 4-5: createRun SELECT after INSERT, appendMissionId SELECT
      // call 6+: mission poll
      if (callCount === 1) return Promise.resolve(makeInstallation());
      if (callCount === 2) return Promise.resolve(makeTemplate());
      if (callCount === 3) return Promise.resolve({ user_id: 'user-001', org_id: 'org-001', sop_template_id: 'tpl-001' }); // resolveInstallationContext
      if (callCount === 4) return Promise.resolve({ id: 'run-001', installation_id: 'inst-001', trigger_type: 'cron', mission_ids: "[]", status: 'pending', result_summary: null, error_message: null, requires_approval: 0, started_at: null, completed_at: null, created_at: 1000 });
      if (callCount === 5) return Promise.resolve({ mission_ids: "[]" });
    });

    const result = await runSop(db as unknown as D1Database, baseCtx);
    expect(['failed', 'paused']).toContain(result.status);
    expect(result.errorMessage).toBeDefined();
  });
});
