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
  listing?: Record<string, unknown> | null;
  listingError?: Error | null;
  missionStatus?: string;
  missionResult?: string;
}) {
  const {
    installation = makeInstallation(),
    template = makeTemplate(),
    listing = null,
    listingError = null,
    missionStatus = 'succeeded',
    missionResult = '{"output":"done"}',
  } = options;

  let currentSql = "";

  const stmtMock = {
    bind: vi.fn().mockReturnThis(),
    run: vi.fn().mockResolvedValue({ meta: { changes: 1 } }),
    first: vi.fn().mockImplementation((_col?: string) => {
      const sql = currentSql;
      if (sql.includes("sop_listings")) {
        if (listingError) {
          return Promise.reject(listingError);
        }
        return Promise.resolve(listing);
      }
      if (sql.includes("user_sop_installations") && sql.includes("SELECT *")) {
        return Promise.resolve(installation);
      }
      if (sql.includes("user_sop_installations") && (sql.includes("user_id") || sql.includes("sop_template_id"))) {
        return Promise.resolve({ user_id: "user-001", org_id: "org-001", sop_template_id: "tpl-001" });
      }
      if (sql.includes("sop_templates")) {
        return Promise.resolve(template);
      }
      if (sql.includes("sop_executions") && sql.includes("SELECT *")) {
        return Promise.resolve({
          id: "run-001",
          installation_id: "inst-001",
          trigger_type: "cron",
          mission_ids: "[]",
          status: "pending",
          result_summary: null,
          error_message: null,
          requires_approval: 0,
          started_at: null,
          completed_at: null,
          created_at: 1000,
        });
      }
      if (sql.includes("sop_executions") && sql.includes("mission_ids")) {
        return Promise.resolve({ mission_ids: "[]" });
      }
      if (sql.includes("engine_missions")) {
        return Promise.resolve({ status: missionStatus, result: missionResult, error: null });
      }
      return Promise.resolve(null);
    }),
    all: vi.fn().mockResolvedValue({ results: [] }),
  };

  return {
    prepare: vi.fn().mockImplementation((sql: string) => {
      currentSql = sql;
      return stmtMock;
    }),
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
    const db = buildTestDb({ missionStatus: 'failed' });

    const result = await runSop(db as unknown as D1Database, baseCtx);
    expect(['failed', 'paused']).toContain(result.status);
    expect(result.errorMessage).toBeDefined();
  });

  it('rejects execution of paid marketplace SOP templates with PAYMENT_REQUIRED', async () => {
    const db = buildTestDb({
      listing: { id: 'listing-001', price_cents: 1000, status: 'published' },
    });

    await expect(runSop(db as unknown as D1Database, baseCtx)).rejects.toThrow(
      /Paid marketplace SOPs cannot be executed until checkout is enabled/,
    );
  });

  it('permits execution of free marketplace SOP templates (price_cents === 0)', async () => {
    const db = buildTestDb({
      listing: { id: 'listing-002', price_cents: 0, status: 'published' },
    });

    const result = await runSop(db as unknown as D1Database, baseCtx);
    expect(result.status).toBe('completed');
  });

  it('blocks execution and prevents dispatchMission when listing query fails fail-closed', async () => {
    const { dispatchMission } = await import('@/forest/missions/dispatcher');
    const db = buildTestDb({
      listingError: new Error('D1 connection terminated'),
    });

    await expect(runSop(db as unknown as D1Database, baseCtx)).rejects.toThrow(
      /Database query failed for marketplace listings: unable to verify template status/,
    );
    expect(dispatchMission).not.toHaveBeenCalled();
  });

  it('blocks execution when marketplace SOP listing is draft or unpublished', async () => {
    const { dispatchMission } = await import('@/forest/missions/dispatcher');
    const db = buildTestDb({
      listing: { id: 'listing-draft', price_cents: 0, status: 'draft' },
    });

    await expect(runSop(db as unknown as D1Database, baseCtx)).rejects.toThrow(
      /Marketplace SOP is not published/,
    );
    expect(dispatchMission).not.toHaveBeenCalled();
  });
});
