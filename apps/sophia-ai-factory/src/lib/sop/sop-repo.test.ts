/**
 * SOP Repository Tests
 *
 * Tests type contracts, query logic, and behavioral guarantees.
 * D1 database mocked inline (no real binding required).
 *
 * Coverage: ≥10 cases including claimDueInstallations, run lifecycle,
 * installation round-trip, and template lookups.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type {
  SopTemplateRow,
  SopInstallationRow,
  SopRunRow,
} from './sop-types';

// ---------------------------------------------------------------------------
// D1 Mock builder
// ---------------------------------------------------------------------------

interface MockD1Statement {
  bind: ReturnType<typeof vi.fn>;
  run: ReturnType<typeof vi.fn>;
  first: ReturnType<typeof vi.fn>;
  all: ReturnType<typeof vi.fn>;
}

type MockD1 = {
  prepare: ReturnType<typeof vi.fn>;
  _stmt: MockD1Statement;
};

function buildMockD1(overrides?: {
  firstResult?: unknown;
  allResults?: unknown[];
  runChanges?: number;
}): MockD1 {
  const runMock = vi.fn().mockResolvedValue({ meta: { changes: overrides?.runChanges ?? 1 } });
  const firstMock = vi.fn().mockResolvedValue(overrides?.firstResult ?? null);
  const allMock = vi.fn().mockResolvedValue({ results: overrides?.allResults ?? [] });

  const stmt: MockD1Statement = {
    bind: vi.fn().mockReturnThis(),
    run: runMock,
    first: firstMock,
    all: allMock,
  };

  const db: MockD1 = {
    prepare: vi.fn().mockReturnValue(stmt),
    _stmt: stmt,
  };

  return db;
}

// ---------------------------------------------------------------------------
// Template fixtures
// ---------------------------------------------------------------------------

function makeTemplate(overrides?: Partial<SopTemplateRow>): SopTemplateRow {
  return {
    id: 'sop_official_daily_content_factory',
    slug: 'daily-content-factory',
    name_vi: 'Nhà Máy Nội Dung',
    name_en: 'Daily Content Factory',
    description_vi: 'desc vi',
    description_en: 'desc en',
    category: 'content',
    agents_yaml: 'agents:\n  test:\n    role: Test',
    playbook_md: '## Step 1: analytics:report\n```yaml\nperiod: today\n```',
    output_schema: '{"type":"object"}',
    credits_per_run: 10,
    version: 1,
    is_official: 1,
    author_user_id: null,
    status: 'published',
    created_at: 1000000,
    updated_at: 1000000,
    config_schema: null,
    config_defaults: null,
    setup_time_minutes: 5,
    is_featured: 0,
    ...overrides,
  };
}

function makeInstallation(overrides?: Partial<SopInstallationRow>): SopInstallationRow {
  return {
    id: 'inst-001',
    user_id: 'user-001',
    template_id: 'sop_official_daily_content_factory',
    customizations: null,
    schedule_cron: '0 9 * * *',
    enabled: 1,
    last_run_at: null,
    next_run_at: 1000100,
    run_count: 0,
    created_at: 1000000,
    config_values: null,
    ...overrides,
  };
}

function makeRun(overrides?: Partial<SopRunRow>): SopRunRow {
  return {
    id: 'run-001',
    installation_id: 'inst-001',
    trigger_type: 'cron',
    mission_ids: '[]',
    status: 'queued',
    result_summary: null,
    error_message: null,
    requires_approval: 0,
    started_at: null,
    completed_at: null,
    created_at: 1000000,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests: Template Repo
// ---------------------------------------------------------------------------

describe('SopTemplateRow type contract', () => {
  it('has required fields with correct types', () => {
    const tpl = makeTemplate();
    expect(tpl.id).toBeTypeOf('string');
    expect(tpl.slug).toBe('daily-content-factory');
    expect(tpl.is_official).toBe(1);
    expect(tpl.category).toBe('content');
    expect(tpl.credits_per_run).toBeTypeOf('number');
    expect(JSON.parse(tpl.output_schema)).toEqual({ type: 'object' });
  });
});

describe('listOfficialTemplates', () => {
  it('queries with is_official=1 and status=published', async () => {
    const templates = [makeTemplate()];
    const db = buildMockD1({ allResults: templates });

    const { listOfficialTemplates } = await import('./sop-repo-templates');
    const results = await listOfficialTemplates(db as unknown as D1Database);

    expect(db.prepare).toHaveBeenCalledWith(
      expect.stringContaining('is_official = 1'),
    );
    expect(results).toHaveLength(1);
    expect(results[0].slug).toBe('daily-content-factory');
  });
});

describe('getTemplateBySlug', () => {
  it('returns template when found', async () => {
    const template = makeTemplate();
    const db = buildMockD1({ firstResult: template });

    const { getTemplateBySlug } = await import('./sop-repo-templates');
    const result = await getTemplateBySlug(db as unknown as D1Database, 'daily-content-factory');

    expect(db._stmt.bind).toHaveBeenCalledWith('daily-content-factory');
    expect(result?.slug).toBe('daily-content-factory');
  });

  it('returns null when not found', async () => {
    const db = buildMockD1({ firstResult: null });
    const { getTemplateBySlug } = await import('./sop-repo-templates');

    const result = await getTemplateBySlug(db as unknown as D1Database, 'non-existent');
    expect(result).toBeNull();
  });
});

describe('getTemplateById', () => {
  it('returns template by id', async () => {
    const template = makeTemplate();
    const db = buildMockD1({ firstResult: template });

    const { getTemplateById } = await import('./sop-repo-templates');
    const result = await getTemplateById(db as unknown as D1Database, 'sop_official_daily_content_factory');

    expect(result?.id).toBe('sop_official_daily_content_factory');
  });
});

// ---------------------------------------------------------------------------
// Tests: Installation Repo
// ---------------------------------------------------------------------------

describe('SopInstallationRow type contract', () => {
  it('has required fields', () => {
    const inst = makeInstallation();
    expect(inst.user_id).toBeTypeOf('string');
    expect(inst.template_id).toBeTypeOf('string');
    expect(inst.enabled).toBe(1);
    expect(inst.run_count).toBe(0);
  });
});

describe('listInstallationsForUser', () => {
  it('queries by user_id', async () => {
    const installations = [makeInstallation()];
    const db = buildMockD1({ allResults: installations });

    const { listInstallationsForUser } = await import('./sop-repo-installations');
    const results = await listInstallationsForUser(db as unknown as D1Database, 'user-001');

    expect(db.prepare).toHaveBeenCalledWith(expect.stringContaining('user_id'));
    expect(db._stmt.bind).toHaveBeenCalledWith('user-001');
    expect(results).toHaveLength(1);
  });
});

describe('setEnabled', () => {
  it('disables an installation', async () => {
    const db = buildMockD1();

    const { setEnabled } = await import('./sop-repo-installations');
    await setEnabled(db as unknown as D1Database, 'inst-001', false);

    expect(db._stmt.bind).toHaveBeenCalledWith(0, 'inst-001');
  });

  it('enables an installation', async () => {
    const db = buildMockD1();

    const { setEnabled } = await import('./sop-repo-installations');
    await setEnabled(db as unknown as D1Database, 'inst-001', true);

    expect(db._stmt.bind).toHaveBeenCalledWith(1, 'inst-001');
  });
});

describe('claimDueInstallations', () => {
  it('returns empty array when no due installations', async () => {
    const db = buildMockD1({ allResults: [] });

    const { claimDueInstallations } = await import('./sop-repo-installations');
    const results = await claimDueInstallations(db as unknown as D1Database, 1000200, 20);

    expect(results).toHaveLength(0);
    // Should only prepare once (the SELECT, no UPDATE needed)
    expect(db.prepare).toHaveBeenCalledTimes(1);
  });

  it('claims due installations and advances next_run_at', async () => {
    const due = [makeInstallation({ id: 'inst-due', next_run_at: 999000 })];
    const db = buildMockD1({ allResults: due });

    const { claimDueInstallations } = await import('./sop-repo-installations');
    const now = 1000200;
    const results = await claimDueInstallations(db as unknown as D1Database, now, 20);

    expect(results).toHaveLength(1);
    expect(results[0].id).toBe('inst-due');

    // SELECT + UPDATE per claimed row
    expect(db.prepare).toHaveBeenCalledTimes(2);
    // The UPDATE bind call should set next_run_at = now + 300 (5 min)
    const updateBindCalls = db._stmt.bind.mock.calls;
    const lastCall = updateBindCalls[updateBindCalls.length - 1];
    expect(lastCall).toContain(now + 300);
    expect(lastCall).toContain('inst-due');
  });

  it('respects limit parameter', async () => {
    const db = buildMockD1({ allResults: [] });

    const { claimDueInstallations } = await import('./sop-repo-installations');
    await claimDueInstallations(db as unknown as D1Database, Date.now(), 20);

    // SELECT bind includes limit value 20
    const selectBindCalls = db._stmt.bind.mock.calls;
    expect(selectBindCalls[0]).toContain(20);
  });
});

describe('advanceSchedule', () => {
  it('updates last_run_at and next_run_at and increments run_count', async () => {
    const db = buildMockD1();

    const { advanceSchedule } = await import('./sop-repo-installations');
    await advanceSchedule(db as unknown as D1Database, 'inst-001', 1001000, 1001300);

    expect(db._stmt.bind).toHaveBeenCalledWith(1001000, 1001300, 'inst-001');
  });
});

// ---------------------------------------------------------------------------
// Tests: Run Repo
// ---------------------------------------------------------------------------

describe('SopRunRow type contract', () => {
  it('has required fields', () => {
    const run = makeRun();
    expect(run.installation_id).toBeTypeOf('string');
    expect(run.trigger_type).toBe('cron');
    expect(run.status).toBe('queued');
    expect(run.mission_ids).toBe('[]');
    expect(run.requires_approval).toBe(0);
  });
});

describe('updateRunStatus', () => {
  it('updates status field', async () => {
    const db = buildMockD1();

    const { updateRunStatus } = await import('./sop-repo-runs');
    await updateRunStatus(db as unknown as D1Database, 'run-001', { status: 'succeeded' });

    expect(db.prepare).toHaveBeenCalledWith(expect.stringContaining('status'));
    expect(db._stmt.bind).toHaveBeenCalledWith('succeeded', 'run-001');
  });

  it('skips update when no fields provided', async () => {
    const db = buildMockD1();

    const { updateRunStatus } = await import('./sop-repo-runs');
    await updateRunStatus(db as unknown as D1Database, 'run-001', {});

    expect(db.prepare).not.toHaveBeenCalled();
  });

  it('updates multiple fields', async () => {
    const db = buildMockD1();

    const { updateRunStatus } = await import('./sop-repo-runs');
    await updateRunStatus(db as unknown as D1Database, 'run-001', {
      status: 'failed',
      errorMessage: 'step 2 failed',
      completedAt: 1001000,
    });

    const sql = db.prepare.mock.calls[0][0] as string;
    expect(sql).toContain('status');
    expect(sql).toContain('error_message');
    expect(sql).toContain('completed_at');
  });
});

describe('appendMissionId', () => {
  it('appends mission id to existing array', async () => {
    const existingRun = { mission_ids: '["mission-1"]' };
    const db = buildMockD1({ firstResult: existingRun });

    const { appendMissionId } = await import('./sop-repo-runs');
    await appendMissionId(db as unknown as D1Database, 'run-001', 'mission-2');

    // The UPDATE bind should include updated JSON
    const updateBindCall = db._stmt.bind.mock.calls.find(
      (call: unknown[]) => typeof call[0] === 'string' && call[0].startsWith('['),
    );
    expect(updateBindCall).toBeDefined();
    const updatedIds = JSON.parse(updateBindCall![0] as string) as string[];
    expect(updatedIds).toContain('mission-1');
    expect(updatedIds).toContain('mission-2');
  });

  it('handles corrupted mission_ids gracefully', async () => {
    const db = buildMockD1({ firstResult: { mission_ids: 'INVALID_JSON' } });

    const { appendMissionId } = await import('./sop-repo-runs');
    // Should not throw
    await expect(
      appendMissionId(db as unknown as D1Database, 'run-001', 'mission-new'),
    ).resolves.toBeUndefined();

    // The update should have been called with a valid JSON array
    const updateBindCall = db._stmt.bind.mock.calls.find(
      (call: unknown[]) => typeof call[0] === 'string' && call[0].startsWith('['),
    );
    expect(updateBindCall).toBeDefined();
    const updatedIds = JSON.parse(updateBindCall![0] as string) as string[];
    expect(updatedIds).toEqual(['mission-new']);
  });

  it('does nothing when run not found', async () => {
    const db = buildMockD1({ firstResult: null });

    const { appendMissionId } = await import('./sop-repo-runs');
    await appendMissionId(db as unknown as D1Database, 'non-existent', 'mission-x');

    // Only one prepare call (the SELECT), no UPDATE
    expect(db.prepare).toHaveBeenCalledTimes(1);
  });
});
