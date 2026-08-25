/**
 * Unit tests for src/tree/content-graph/types.ts
 * Mirrors src/tree/ip-graph/__tests__/types.test.ts pattern (mocked D1).
 */
import { describe, it, expect, vi } from 'vitest';
import { getD1 } from '@/seed/db/client';
import type { ContentProject, ContentAsset, DerivativeAsset } from '@/seed/types/creative-domain';

vi.mock('@/seed/db/client', () => ({
  getD1: vi.fn(),
}));

import {
  createProject,
  getProject,
  listProjects,
  updateProjectStatus,
  createAsset,
  getAsset,
  listAssets,
  updateAssetStatus,
  createDerivative,
  getDerivativesOf,
  newProjectId,
  newAssetId,
  ContentGraphError,
} from '../types';

const mockGetD1 = vi.mocked(getD1);

interface CapturedCall {
  sql: string;
  params: unknown[];
}

function mockDb(options?: { failRun?: boolean }) {
  const rows: Record<string, unknown>[] = [];
  const calls: CapturedCall[] = [];
  const db = {
    prepare: vi.fn((sql: string) => {
      const stmt = {
        bind: vi.fn(),
        first: vi.fn(),
        all: vi.fn(),
        run: vi.fn(),
      };
      stmt.bind.mockImplementation((...params: unknown[]) => {
        calls.push({ sql, params });
        return stmt;
      });
      stmt.first.mockImplementation(async () => rows[0] ?? null);
      stmt.all.mockImplementation(async () => ({ results: rows }));
      stmt.run.mockImplementation(async () => {
        if (options?.failRun) throw new Error('UNIQUE constraint failed');
        return { changes: rows.length };
      });
      return stmt;
    }),
    _setRows: (r: Record<string, unknown>[]) => {
      rows.length = 0;
      rows.push(...r);
    },
    _calls: calls,
  };
  mockGetD1.mockReturnValue(db as never);
  return db;
}

const baseProject: ContentProject = {
  id: 'prj_test1',
  workspaceId: 'ws_1',
  creatorId: 'creator_1',
  title: 'June Launch',
  description: 'Campaign',
  format: 'video_long',
  status: 'draft',
  budgetCents: 10000,
  actualCostCents: 0,
  metadata: {},
  createdAt: 0,
  updatedAt: 0,
};

const projectRow = {
  id: 'prj_1',
  workspace_id: 'ws_1',
  mission_id: 'mis_1',
  creator_id: 'cr_1',
  brand_id: 'br_1',
  title: 'Launch',
  description: 'Desc',
  format: 'video_short',
  status: 'published',
  budget_cents: 5000,
  actual_cost_cents: 1200,
  metadata: '{"k":"v"}',
  created_at: 111,
  updated_at: 222,
};

const assetRow = {
  id: 'ast_1',
  workspace_id: 'ws_1',
  project_id: 'prj_1',
  type: 'video',
  storage_key: 'r2/key.mp4',
  mime_type: 'video/mp4',
  size_bytes: 2048,
  duration_seconds: 60,
  status: 'approved',
  metadata: '{"fps":30}',
  created_at: 333,
  updated_at: 444,
};

const derivativeRow = {
  id: 'ast_d1',
  workspace_id: 'ws_1',
  source_asset_id: 'ast_1',
  parent_asset_id: 'ast_1',
  type: 'clip',
  storage_key: 'r2/clip.mp4',
  metadata: '{}',
  created_at: 555,
};

describe('content-graph types', () => {
  describe('ContentGraphError', () => {
    it('carries code, message, and name', () => {
      const err = new ContentGraphError('TEST_CODE', 'boom');
      expect(err).toBeInstanceOf(Error);
      expect(err.name).toBe('ContentGraphError');
      expect(err.code).toBe('TEST_CODE');
      expect(err.message).toBe('boom');
    });
  });

  describe('id generators', () => {
    it('newProjectId generates prj_ prefix with 32 hex chars', () => {
      expect(newProjectId()).toMatch(/^prj_[0-9a-f]{32}$/);
    });

    it('newAssetId generates ast_ prefix with 32 hex chars', () => {
      expect(newAssetId()).toMatch(/^ast_[0-9a-f]{32}$/);
    });

    it('generates unique ids', () => {
      expect(newProjectId()).not.toBe(newProjectId());
      expect(newAssetId()).not.toBe(newAssetId());
    });
  });

  describe('createProject', () => {
    it('creates project, stamps timestamps, returns it', async () => {
      mockDb();
      const result = await createProject({ ...baseProject });
      expect(result.id).toBe('prj_test1');
      expect(result.title).toBe('June Launch');
      expect(result.createdAt).toBeGreaterThan(0);
      expect(result.updatedAt).toBe(result.createdAt);
    });

    it('generates id when empty', async () => {
      mockDb();
      const result = await createProject({ ...baseProject, id: '' });
      expect(result.id).toMatch(/^prj_[0-9a-f]{32}$/);
    });

    it('throws D1_UNAVAILABLE when D1 missing', async () => {
      mockGetD1.mockReturnValue(null as never);
      await expect(createProject({ ...baseProject })).rejects.toMatchObject({
        name: 'ContentGraphError',
        code: 'D1_UNAVAILABLE',
      });
    });

    it('wraps insert failures as INSERT_FAILED', async () => {
      mockDb({ failRun: true });
      await expect(createProject({ ...baseProject })).rejects.toMatchObject({
        code: 'INSERT_FAILED',
        message: 'UNIQUE constraint failed',
      });
    });
  });

  describe('getProject', () => {
    it('maps row to domain with camelCase fields and parsed metadata', async () => {
      const db = mockDb();
      db._setRows([projectRow]);
      const result = await getProject('prj_1');
      expect(result).toEqual({
        id: 'prj_1',
        workspaceId: 'ws_1',
        missionId: 'mis_1',
        creatorId: 'cr_1',
        brandId: 'br_1',
        title: 'Launch',
        description: 'Desc',
        format: 'video_short',
        status: 'published',
        budgetCents: 5000,
        actualCostCents: 1200,
        metadata: { k: 'v' },
        createdAt: 111,
        updatedAt: 222,
      });
    });

    it('returns null when not found', async () => {
      mockDb();
      expect(await getProject('ghost')).toBeNull();
    });
  });

  describe('listProjects', () => {
    it('lists by workspace ordered DESC', async () => {
      const db = mockDb();
      db._setRows([projectRow, { ...projectRow, id: 'prj_2' }]);
      const result = await listProjects('ws_1');
      expect(result).toHaveLength(2);
      const call = db._calls[0];
      expect(call.sql).toContain('workspace_id = ?1');
      expect(call.sql).toContain('ORDER BY created_at DESC');
      expect(call.params).toEqual(['ws_1']);
    });

    it('appends mission filter when missionId provided', async () => {
      const db = mockDb();
      db._setRows([projectRow]);
      const result = await listProjects('ws_1', 'mis_1');
      expect(result).toHaveLength(1);
      const call = db._calls[0];
      expect(call.sql).toContain('mission_id = ?2');
      expect(call.params).toEqual(['ws_1', 'mis_1']);
    });
  });

  describe('updateProjectStatus', () => {
    it('updates then re-reads the row', async () => {
      const db = mockDb();
      db._setRows([{ ...projectRow, status: 'archived' }]);
      const result = await updateProjectStatus('prj_1', 'archived');
      expect(result?.status).toBe('archived');
      const updateCall = db._calls.find((c) => c.sql.startsWith('UPDATE content_projects'));
      expect(updateCall?.params[0]).toBe('archived');
      expect(updateCall?.params[2]).toBe('prj_1');
    });
  });

  describe('createAsset', () => {
    it('creates asset and returns it', async () => {
      mockDb();
      const asset: ContentAsset = {
        id: 'ast_test1',
        workspaceId: 'ws_1',
        projectId: 'prj_1',
        type: 'video',
        status: 'draft',
        metadata: {},
        createdAt: 0,
        updatedAt: 0,
      };
      const result = await createAsset(asset);
      expect(result.id).toBe('ast_test1');
      expect(result.createdAt).toBeGreaterThan(0);
    });

    it('wraps insert failures as INSERT_FAILED', async () => {
      mockDb({ failRun: true });
      await expect(
        createAsset({
          id: 'ast_x',
          workspaceId: 'ws_1',
          projectId: 'prj_1',
          type: 'image',
          status: 'draft',
          metadata: {},
          createdAt: 0,
          updatedAt: 0,
        }),
      ).rejects.toMatchObject({ code: 'INSERT_FAILED' });
    });
  });

  describe('getAsset', () => {
    it('maps row including optional fields', async () => {
      const db = mockDb();
      db._setRows([assetRow]);
      const result = await getAsset('ast_1');
      expect(result).toEqual({
        id: 'ast_1',
        workspaceId: 'ws_1',
        projectId: 'prj_1',
        type: 'video',
        storageKey: 'r2/key.mp4',
        mimeType: 'video/mp4',
        sizeBytes: 2048,
        durationSeconds: 60,
        status: 'approved',
        metadata: { fps: 30 },
        createdAt: 333,
        updatedAt: 444,
      });
    });

    it('coerces empty optional columns to undefined', async () => {
      const db = mockDb();
      db._setRows([{ ...assetRow, storage_key: '', mime_type: '', size_bytes: 0, duration_seconds: 0 }]);
      const result = await getAsset('ast_1');
      expect(result?.storageKey).toBeUndefined();
      expect(result?.mimeType).toBeUndefined();
      expect(result?.sizeBytes).toBeUndefined();
      expect(result?.durationSeconds).toBeUndefined();
    });

    it('returns null when not found', async () => {
      mockDb();
      expect(await getAsset('ghost')).toBeNull();
    });
  });

  describe('listAssets', () => {
    it('lists by project ordered ASC', async () => {
      const db = mockDb();
      db._setRows([assetRow]);
      const result = await listAssets('prj_1');
      expect(result).toHaveLength(1);
      expect(db._calls[0].sql).toContain('ORDER BY created_at ASC');
      expect(db._calls[0].params).toEqual(['prj_1']);
    });
  });

  describe('updateAssetStatus', () => {
    it('updates status and returns mapped asset', async () => {
      const db = mockDb();
      db._setRows([{ ...assetRow, status: 'published' }]);
      const result = await updateAssetStatus('ast_1', 'published');
      expect(result?.status).toBe('published');
    });
  });

  describe('createDerivative', () => {
    it('creates derivative and returns it', async () => {
      mockDb();
      const derivative: DerivativeAsset = {
        id: 'ast_d1',
        workspaceId: 'ws_1',
        sourceAssetId: 'ast_1',
        parentAssetId: 'ast_1',
        type: 'clip',
        metadata: {},
        createdAt: 0,
      };
      const result = await createDerivative(derivative);
      expect(result.id).toBe('ast_d1');
      expect(result.createdAt).toBeGreaterThan(0);
    });

    it('wraps insert failures as INSERT_FAILED', async () => {
      mockDb({ failRun: true });
      await expect(
        createDerivative({
          id: 'ast_d2',
          workspaceId: 'ws_1',
          sourceAssetId: 'ast_1',
          parentAssetId: 'ast_1',
          type: 'thumbnail',
          metadata: {},
          createdAt: 0,
        }),
      ).rejects.toMatchObject({ code: 'INSERT_FAILED' });
    });
  });

  describe('getDerivativesOf', () => {
    it('queries by source OR parent and maps rows', async () => {
      const db = mockDb();
      db._setRows([derivativeRow]);
      const result = await getDerivativesOf('ast_1');
      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        id: 'ast_d1',
        sourceAssetId: 'ast_1',
        parentAssetId: 'ast_1',
        type: 'clip',
        createdAt: 555,
      });
      expect(db._calls[0].sql).toContain('source_asset_id = ?1 OR parent_asset_id = ?1');
    });
  });
});
