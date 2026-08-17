/**
 * Distribution Plan CRUD tests.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { DistributionPlan } from '@/tree/distribution/types';
import {
  createDistributionPlan, getDistributionPlan, listDistributionPlans,
  updateDistributionPlanStatus, isValidPlanTransition,
} from '@/tree/distribution/plans';
import { DistributionError } from '@/tree/distribution/errors';

const { mockStore, resetMockStore, mockBind, mockRun, mockAll, mockFirst, mockPrepare } = vi.hoisted(() => {
  const mockStore = new Map<string, { row: Record<string, unknown>; ws: string }>();
  function resetMockStore() { mockStore.clear(); }
  const mockBind = vi.fn().mockReturnThis();
  const mockRun = vi.fn().mockResolvedValue({ success: true, meta: { changes: 1 } });
  const mockFirst = vi.fn().mockResolvedValue(null);
  const mockAll = vi.fn().mockResolvedValue({ results: [] });
  const mockPrepare = vi.fn().mockReturnValue({ bind: mockBind, all: mockAll, run: mockRun, first: mockFirst });
  return { mockStore, resetMockStore, mockBind, mockRun, mockAll, mockFirst, mockPrepare };
});

let lastBound: unknown[] = [];
let lastSql = '';

mockPrepare.mockImplementation((sql: string) => {
  lastSql = sql;
  return {
    bind(...args: unknown[]) { lastBound = args; return this; },
    first<T>() { return Promise.resolve(mockFirst() as T | null); },
    all<T>() { return Promise.resolve(mockAll() as { results: T[] }); },
    run() { return Promise.resolve(mockRun()); },
  };
});

mockRun.mockImplementation(async () => {
  if (lastSql.includes('INSERT INTO distribution_plans')) {
    const a = lastBound;
    const id = String(a[0]), ws = String(a[1]);
    mockStore.set(id, { row: { id, workspace_id: ws, project_id: a[2], channels: a[3], schedule_at: a[4], status: a[5], created_at: a[6], updated_at: a[7] }, ws });
  } else if (lastSql.includes('UPDATE distribution_plans')) {
    const a = lastBound;
    const id = String(a[2]), ws = String(a[3]);
    const e = mockStore.get(id);
    if (e?.ws === ws) {
      e.row.status = a[0];
      e.row.updated_at = a[1];
    }
  }
  return { success: true, meta: { changes: 1 } };
});

mockFirst.mockImplementation(async () => {
  if (lastSql.includes('id = ?1 AND workspace_id = ?2')) {
    const a = lastBound;
    const e = mockStore.get(String(a[0]));
    return e?.ws === String(a[1]) ? e.row : null;
  }
  if (lastSql.includes('id = ?1')) return mockStore.get(String(lastBound[0]))?.row ?? null;
  return null;
});

mockAll.mockImplementation(async () => {
  const ws = String(lastBound[0]);
  return { results: [...mockStore.values()].filter((e) => e.ws === ws).map((e) => e.row) };
});

vi.mock('@/seed/db/client', () => ({
  getD1: vi.fn(() => ({ prepare: mockPrepare })),
}));

const WORKSPACE_ID = 'ws_test_001';
const CHANNEL_YOUTUBE = { channel: 'youtube', assetId: 'asset_001', settings: {} } as const;
const CHANNEL_TIKTOK = { channel: 'tiktok', assetId: 'asset_002', settings: {} } as const;

function makePlan(overrides: Partial<DistributionPlan> = {}): Omit<DistributionPlan, 'id' | 'createdAt' | 'updatedAt'> {
  return {
    workspaceId: WORKSPACE_ID,
    projectId: 'proj_001',
    channels: [CHANNEL_YOUTUBE, CHANNEL_TIKTOK],
    status: 'draft',
    scheduleAt: Date.now(),
    ...overrides,
  };
}

describe('Distribution Plan CRUD', () => {
  beforeEach(() => {
    resetMockStore();
    lastBound = [];
    lastSql = '';
    vi.clearAllMocks();
  });

  describe('createDistributionPlan', () => {
    it('creates and retrieves a plan', async () => {
      const plan = makePlan();
      const created = await createDistributionPlan(plan);
      expect(created.id).toBeTruthy();
      expect(created.workspaceId).toBe(WORKSPACE_ID);
      expect(created.channels).toHaveLength(2);
      expect(created.status).toBe('draft');
      const retrieved = await getDistributionPlan(created.id, WORKSPACE_ID);
      expect(retrieved.id).toBe(created.id);
    });

    it('lists plans by workspace', async () => {
      await createDistributionPlan(makePlan({ channels: [CHANNEL_YOUTUBE] }));
      await createDistributionPlan(makePlan({ channels: [CHANNEL_TIKTOK] }));
      const all = await listDistributionPlans(WORKSPACE_ID);
      expect(all).toHaveLength(2);
    });

    it('updates plan status with valid transition', async () => {
      const plan = await createDistributionPlan(makePlan());
      const updated = await updateDistributionPlanStatus(plan.id, 'scheduled', WORKSPACE_ID);
      expect(updated.status).toBe('scheduled');
    });
  });

  describe('IDOR prevention', () => {
    it('rejects cross-workspace access', async () => {
      const plan = await createDistributionPlan(makePlan());
      await expect(getDistributionPlan(plan.id, 'ws_other_999')).rejects.toMatchObject({ code: 'NOT_FOUND' });
    });

    it('rejects update from wrong workspace', async () => {
      const plan = await createDistributionPlan(makePlan());
      await expect(updateDistributionPlanStatus(plan.id, 'scheduled', 'ws_other_999')).rejects.toMatchObject({ code: 'NOT_FOUND' });
    });
  });

  describe('status transitions', () => {
    it('rejects invalid transition', async () => {
      const plan = await createDistributionPlan(makePlan());
      await expect(updateDistributionPlanStatus(plan.id, 'published', WORKSPACE_ID)).rejects.toMatchObject({ code: 'INVALID_TRANSITION' });
    });

    it('allows draft -> failed transition', async () => {
      const plan = await createDistributionPlan(makePlan());
      const updated = await updateDistributionPlanStatus(plan.id, 'failed', WORKSPACE_ID);
      expect(updated.status).toBe('failed');
    });
  });

  describe('isValidPlanTransition', () => {
    it('accepts valid transitions', () => {
      expect(isValidPlanTransition('draft', 'scheduled')).toBe(true);
      expect(isValidPlanTransition('draft', 'publishing')).toBe(true);
      expect(isValidPlanTransition('scheduled', 'publishing')).toBe(true);
      expect(isValidPlanTransition('publishing', 'published')).toBe(true);
    });

    it('rejects invalid transitions', () => {
      expect(isValidPlanTransition('published', 'draft')).toBe(false);
      expect(isValidPlanTransition('draft', 'published')).toBe(false);
      expect(isValidPlanTransition('publishing', 'draft')).toBe(false);
    });
  });
});
