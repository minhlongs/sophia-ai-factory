/**
 * Content Graph integration tests — DB-backed via node:sqlite D1 shim.
 * Mirrors src/tree/ip-graph/__tests__/integration.test.ts pattern.
 * Tests: project/asset/derivative CRUD + getContentLineage /
 *        getContentPerformance join logic against a real in-memory DB.
 *
 * @module tree/content-graph/__tests__/integration
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createRequire } from 'node:module';
import type { ContentProject } from '@/seed/types/creative-domain';

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

// value_cents is nullable here on purpose to exercise the `?? undefined`
// defensive mapping in getContentLineage (prod column is NOT NULL DEFAULT 0).
const SCHEMA = `
CREATE TABLE IF NOT EXISTS content_projects (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  mission_id TEXT,
  creator_id TEXT NOT NULL,
  brand_id TEXT,
  title TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  format TEXT NOT NULL DEFAULT 'video_long',
  status TEXT NOT NULL DEFAULT 'draft',
  budget_cents INTEGER NOT NULL DEFAULT 0,
  actual_cost_cents INTEGER NOT NULL DEFAULT 0,
  metadata TEXT NOT NULL DEFAULT '{}',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS content_assets (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  project_id TEXT NOT NULL,
  type TEXT NOT NULL,
  storage_key TEXT,
  mime_type TEXT,
  size_bytes INTEGER,
  duration_seconds INTEGER,
  status TEXT NOT NULL DEFAULT 'draft',
  metadata TEXT NOT NULL DEFAULT '{}',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS derivative_assets (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  source_asset_id TEXT NOT NULL,
  parent_asset_id TEXT,
  type TEXT NOT NULL,
  storage_key TEXT,
  metadata TEXT NOT NULL DEFAULT '{}',
  created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS performance_events (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  project_id TEXT,
  event_type TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  metrics_json TEXT NOT NULL DEFAULT '{}',
  channel TEXT,
  count INTEGER NOT NULL DEFAULT 1,
  value_cents INTEGER,
  recorded_at INTEGER NOT NULL
);
`;

const { getD1 } = await import('@/seed/db/client');
vi.mock('@/seed/db/client', () => ({
  getD1: vi.fn(),
}));

beforeEach(() => {
  vi.mocked(getD1).mockReset();
});

function setupDb() {
  const db = new DatabaseSync(':memory:');
  db.exec(SCHEMA);
  return makeD1(db);
}

async function insertProject(d1: ReturnType<typeof makeD1>, row: Record<string, unknown>) {
  await d1
    .prepare(
      `INSERT INTO content_projects (id, workspace_id, mission_id, creator_id, brand_id, title, description,
         format, status, budget_cents, actual_cost_cents, metadata, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      row.id,
      row.workspace_id,
      row.mission_id ?? null,
      row.creator_id ?? 'cr_1',
      row.brand_id ?? null,
      row.title ?? '',
      row.description ?? '',
      row.format ?? 'video_long',
      row.status ?? 'draft',
      row.budget_cents ?? 0,
      row.actual_cost_cents ?? 0,
      JSON.stringify(row.metadata ?? {}),
      row.created_at ?? 0,
      row.updated_at ?? 0,
    )
    .run();
}

async function insertAsset(d1: ReturnType<typeof makeD1>, row: Record<string, unknown>) {
  await d1
    .prepare(
      `INSERT INTO content_assets (id, workspace_id, project_id, type, storage_key, mime_type,
         size_bytes, duration_seconds, status, metadata, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      row.id,
      row.workspace_id,
      row.project_id,
      row.type,
      row.storage_key ?? null,
      row.mime_type ?? null,
      row.size_bytes ?? null,
      row.duration_seconds ?? null,
      row.status ?? 'draft',
      JSON.stringify(row.metadata ?? {}),
      row.created_at ?? 0,
      row.updated_at ?? 0,
    )
    .run();
}

async function insertDerivative(d1: ReturnType<typeof makeD1>, row: Record<string, unknown>) {
  await d1
    .prepare(
      `INSERT INTO derivative_assets (id, workspace_id, source_asset_id, parent_asset_id, type, storage_key, metadata, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      row.id,
      row.workspace_id,
      row.source_asset_id,
      row.parent_asset_id ?? null,
      row.type,
      row.storage_key ?? null,
      JSON.stringify(row.metadata ?? {}),
      row.created_at ?? 0,
    )
    .run();
}

async function insertPerfEvent(d1: ReturnType<typeof makeD1>, row: Record<string, unknown>) {
  await d1
    .prepare(
      `INSERT INTO performance_events (id, workspace_id, project_id, event_type, entity_type, entity_id,
         metrics_json, channel, count, value_cents, recorded_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      row.id,
      row.workspace_id,
      row.project_id ?? null,
      row.event_type,
      row.entity_type ?? 'project',
      row.entity_id ?? row.project_id ?? '',
      '{}',
      row.channel ?? null,
      row.count ?? 1,
      row.value_cents ?? null,
      row.recorded_at ?? 0,
    )
    .run();
}

describe('Content Graph — createProject', () => {
  it('inserts with generated id and round-trips through getProject', async () => {
    const d1 = setupDb();
    vi.mocked(getD1).mockResolvedValue(d1 as never);

    const { createProject, newProjectId, getProject } = await import('@/tree/content-graph/types');
    const id = newProjectId();

    const created = await createProject({
      id,
      workspaceId: 'ws_1',
      missionId: 'mis_9',
      creatorId: 'cr_1',
      brandId: 'br_1',
      title: 'June Launch',
      description: 'Campaign project',
      format: 'video_long',
      status: 'in_production',
      budgetCents: 25000,
      actualCostCents: 3000,
      metadata: { quarter: 'Q2' },
      createdAt: 0,
      updatedAt: 0,
    });

    expect(created.id).toBe(id);
    expect(created.createdAt).toBeGreaterThan(0);
    expect(created.updatedAt).toBe(created.createdAt);

    const fetched = await getProject(id);
    expect(fetched).not.toBeNull();
    expect(fetched!.missionId).toBe('mis_9');
    expect(fetched!.brandId).toBe('br_1');
    expect(fetched!.metadata).toEqual({ quarter: 'Q2' });
    expect(fetched!.status).toBe('in_production');
    expect(fetched!.budgetCents).toBe(25000);
  });

  it('throws D1_UNAVAILABLE when D1 missing', async () => {
    vi.mocked(getD1).mockResolvedValue(null as never);
    const { createProject, ContentGraphError } = await import('@/tree/content-graph/types');

    await expect(
      createProject({
        id: 'prj_x',
        workspaceId: 'ws',
        creatorId: 'cr',
        title: 't',
        description: '',
        format: 'video_short',
        status: 'draft',
        budgetCents: 0,
        actualCostCents: 0,
        metadata: {},
        createdAt: 0,
        updatedAt: 0,
      }),
    ).rejects.toThrow(ContentGraphError);
  });

  it('wraps duplicate-id insert failure as INSERT_FAILED', async () => {
    const d1 = setupDb();
    vi.mocked(getD1).mockResolvedValue(d1 as never);

    const { createProject } = await import('@/tree/content-graph/types');
    const base: ContentProject = {
      id: 'prj_dup',
      workspaceId: 'ws',
      creatorId: 'cr',
      title: 't',
      description: '',
      format: 'video_short',
      status: 'draft',
      budgetCents: 0,
      actualCostCents: 0,
      metadata: {},
      createdAt: 0,
      updatedAt: 0,
    };

    await createProject(base);
    await expect(createProject(base)).rejects.toMatchObject({
      code: 'INSERT_FAILED',
      message: expect.stringContaining('UNIQUE'),
    });
  });
});

describe('Content Graph — listProjects', () => {
  it('lists by workspace ordered DESC and filters by mission', async () => {
    const d1 = setupDb();
    vi.mocked(getD1).mockResolvedValue(d1 as never);

    await insertProject(d1, { id: 'p1', workspace_id: 'ws', mission_id: 'm1', title: 'Old', created_at: 100, updated_at: 100 });
    await insertProject(d1, { id: 'p2', workspace_id: 'ws', mission_id: 'm1', title: 'New', created_at: 200, updated_at: 200 });
    await insertProject(d1, { id: 'p3', workspace_id: 'other', title: 'Foreign', created_at: 999, updated_at: 999 });

    const { listProjects } = await import('@/tree/content-graph/types');

    const all = await listProjects('ws');
    expect(all.map((p) => p.id)).toEqual(['p2', 'p1']);

    const onlyM1 = await listProjects('ws', 'm1');
    expect(onlyM1).toHaveLength(2);
    expect(onlyM1.every((p) => p.missionId === 'm1')).toBe(true);
  });
});

describe('Content Graph — updateProjectStatus / updateAssetStatus', () => {
  it('updates project status and bumps updatedAt', async () => {
    const d1 = setupDb();
    vi.mocked(getD1).mockResolvedValue(d1 as never);

    await insertProject(d1, { id: 'pu', workspace_id: 'ws', status: 'draft', created_at: 100, updated_at: 100 });
    const { updateProjectStatus } = await import('@/tree/content-graph/types');

    const updated = await updateProjectStatus('pu', 'published');
    expect(updated?.status).toBe('published');
    expect(updated!.updatedAt).toBeGreaterThan(100);
    expect(await updateProjectStatus('ghost', 'published')).toBeNull();
  });

  it('updates asset status and returns mapped asset', async () => {
    const d1 = setupDb();
    vi.mocked(getD1).mockResolvedValue(d1 as never);

    await insertAsset(d1, { id: 'au', workspace_id: 'ws', project_id: 'p', type: 'video', status: 'review', created_at: 10, updated_at: 10 });
    const { updateAssetStatus } = await import('@/tree/content-graph/types');

    const updated = await updateAssetStatus('au', 'approved');
    expect(updated?.status).toBe('approved');
    expect(updated!.updatedAt).toBeGreaterThan(10);
    expect(await updateAssetStatus('ghost', 'approved')).toBeNull();
  });
});

describe('Content Graph — assets & derivatives', () => {
  it('createAsset/getAsset/listAssets round-trip with ASC ordering', async () => {
    const d1 = setupDb();
    vi.mocked(getD1).mockResolvedValue(d1 as never);

    const { createAsset, listAssets } = await import('@/tree/content-graph/types');

    const created = await createAsset({
      id: 'a_new', workspaceId: 'ws', projectId: 'pl', type: 'audio',
      mimeType: 'audio/mp3', sizeBytes: 512, durationSeconds: 30,
      status: 'draft', metadata: {}, createdAt: 0, updatedAt: 0,
    });
    expect(created.createdAt).toBeGreaterThan(0);

    // explicit timestamps (second granularity) make ASC ordering deterministic
    await insertAsset(d1, { id: 'a1', workspace_id: 'ws', project_id: 'pl', type: 'script', storage_key: 'r2/script.md', metadata: { words: 800 }, created_at: 10, updated_at: 10 });
    await insertAsset(d1, { id: 'a2', workspace_id: 'ws', project_id: 'pl', type: 'video', created_at: 20, updated_at: 20 });

    const listed = await listAssets('pl');
    expect(listed.map((x) => x.id)).toEqual(['a1', 'a2', 'a_new']);
    expect(listed[0].metadata).toEqual({ words: 800 });
    expect(listed[1].type).toBe('video');
  });

  it('createDerivative/getDerivativesOf matches source OR parent', async () => {
    const d1 = setupDb();
    vi.mocked(getD1).mockResolvedValue(d1 as never);

    const { createDerivative, getDerivativesOf } = await import('@/tree/content-graph/types');

    await insertDerivative(d1, { id: 'd_src', workspace_id: 'ws', source_asset_id: 'root', parent_asset_id: 'elsewhere', type: 'clip', created_at: 1 });
    await insertDerivative(d1, { id: 'd_parent', workspace_id: 'ws', source_asset_id: 'unrelated', parent_asset_id: 'root', type: 'thumbnail', created_at: 2 });
    await createDerivative({ id: 'd_new', workspaceId: 'ws', sourceAssetId: 'root', parentAssetId: 'root', type: 'quote_card', metadata: {}, createdAt: 0 });

    const derived = await getDerivativesOf('root');
    expect(derived).toHaveLength(3);
    expect(derived.map((x) => x.id)).toEqual(['d_src', 'd_parent', 'd_new']);
    expect(await getDerivativesOf('ghost')).toEqual([]);
  });
});

describe('Content Graph — getContentLineage join logic', () => {
  it('joins project → assets → derivatives → performance events', async () => {
    const d1 = setupDb();
    vi.mocked(getD1).mockResolvedValue(d1 as never);

    await insertProject(d1, { id: 'lp', workspace_id: 'ws', title: 'Lineage', created_at: 50, updated_at: 50 });
    await insertAsset(d1, { id: 'la1', workspace_id: 'ws', project_id: 'lp', type: 'video', created_at: 60, updated_at: 60 });
    await insertAsset(d1, { id: 'la2', workspace_id: 'ws', project_id: 'lp', type: 'thumbnail', created_at: 70, updated_at: 70 });
    // derivative whose parent belongs to lp
    await insertDerivative(d1, { id: 'ld1', workspace_id: 'ws', source_asset_id: 'la1', parent_asset_id: 'la1', type: 'clip', created_at: 80 });
    // derivative pointing at an asset of ANOTHER project — must be excluded
    await insertAsset(d1, { id: 'ox', workspace_id: 'ws', project_id: 'other_p', type: 'video', created_at: 60, updated_at: 60 });
    await insertDerivative(d1, { id: 'ld_other', workspace_id: 'ws', source_asset_id: 'ox', parent_asset_id: 'ox', type: 'clip', created_at: 90 });
    // performance events, unordered on purpose to verify DESC sort
    await insertPerfEvent(d1, { id: 'pe_old', workspace_id: 'ws', project_id: 'lp', event_type: 'view', channel: 'youtube', count: 100, recorded_at: 1000 });
    await insertPerfEvent(d1, { id: 'pe_rev', workspace_id: 'ws', project_id: 'lp', event_type: 'revenue', channel: 'youtube', count: 2, value_cents: 1500, recorded_at: 2000 });
    await insertPerfEvent(d1, { id: 'pe_nullval', workspace_id: 'ws', project_id: 'lp', event_type: 'click', channel: 'tiktok', count: 5, recorded_at: 1500 });
    await insertPerfEvent(d1, { id: 'pe_foreign', workspace_id: 'ws', project_id: 'other_p', event_type: 'view', recorded_at: 3000 });

    const { getContentLineage } = await import('@/tree/content-graph/types');
    const lineage = await getContentLineage('lp');

    expect(lineage).not.toBeNull();
    expect(lineage!.project.id).toBe('lp');
    expect(lineage!.assets.map((a) => a.id).sort()).toEqual(['la1', 'la2']);
    expect(lineage!.derivatives.map((x) => x.id)).toEqual(['ld1']);

    expect(lineage!.performance).toHaveLength(3);
    expect(lineage!.performance.map((e) => e.id)).toEqual(['pe_rev', 'pe_nullval', 'pe_old']);
    expect(lineage!.performance[0]).toEqual({
      id: 'pe_rev',
      channel: 'youtube',
      eventType: 'revenue',
      count: 2,
      valueCents: 1500,
      recordedAt: 2000,
    });
    expect(lineage!.performance[1].valueCents).toBeUndefined();
  });

  it('returns null for nonexistent project', async () => {
    const d1 = setupDb();
    vi.mocked(getD1).mockResolvedValue(d1 as never);

    const { getContentLineage } = await import('@/tree/content-graph/types');
    expect(await getContentLineage('ghost')).toBeNull();
  });

  it('getContentPerformance returns [] for ghost and events for real project', async () => {
    const d1 = setupDb();
    vi.mocked(getD1).mockResolvedValue(d1 as never);

    await insertProject(d1, { id: 'cp', workspace_id: 'ws', created_at: 1, updated_at: 1 });
    await insertPerfEvent(d1, { id: 'cpe1', workspace_id: 'ws', project_id: 'cp', event_type: 'share', channel: 'instagram', count: 7, recorded_at: 500 });

    const { getContentPerformance } = await import('@/tree/content-graph/types');
    expect(await getContentPerformance('ghost')).toEqual([]);
    const perf = await getContentPerformance('cp');
    expect(perf).toHaveLength(1);
    expect(perf[0].eventType).toBe('share');
    expect(perf[0].count).toBe(7);
  });
});
