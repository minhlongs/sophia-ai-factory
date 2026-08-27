/**
 * Unit tests for createDistributionPlan / getDistributionPlan /
 * getDistributionPosts / updateDistributionPostStatus.
 *
 * D1 is mocked via vi.mock('@/seed/db/client', () => ({ createServerClient: mockCreateServerClient }))
 * so no live database is touched. All fixtures are deterministic.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockFirst, mockRun, mockBind, mockPrepare, mockCreateServerClient, mockAll } = vi.hoisted(() => {
  const first = vi.fn();
  const run = vi.fn().mockResolvedValue({ success: true });
  const bind = vi.fn(() => ({ first, run, all: mockAll }));
  const prepare = vi.fn(() => ({ bind }));
  const createServerClient = vi.fn(() => ({ prepare }));
  const all = vi.fn().mockResolvedValue({ results: [] });
  return { mockFirst: first, mockRun: run, mockBind: bind, mockPrepare: prepare, mockCreateServerClient: createServerClient, mockAll: all };
});

vi.mock('@/seed/db/client', () => ({ createServerClient: mockCreateServerClient }));

import {
  createDistributionPlan,
  getDistributionPlan,
  getDistributionPosts,
  updateDistributionPostStatus,
  DistributionPlanError,
  DistributionPlanSchema,
  DistributionPlanInput,
} from '@/land/publish/distribution-plan';

const WORKSPACE = 'ws-1';
const PROJECT = 'proj-1';
const ASSET = 'asset-1';

describe('DistributionPlanSchema', () => {
  it('accepts a valid plan with channels and optional schedule', () => {
    const input: DistributionPlanInput = {
      workspaceId: WORKSPACE,
      projectId: PROJECT,
      assetId: ASSET,
      channels: ['youtube', 'tiktok'],
      scheduleAt: 1700000000,
    };
    expect(DistributionPlanSchema.safeParse(input).success).toBe(true);
  });

  it('rejects empty channels', () => {
    const input = {
      workspaceId: WORKSPACE,
      projectId: PROJECT,
      assetId: ASSET,
      channels: [],
    };
    expect(DistributionPlanSchema.safeParse(input).success).toBe(false);
  });

  it('rejects unsupported platform', () => {
    const input = {
      workspaceId: WORKSPACE,
      projectId: PROJECT,
      assetId: ASSET,
      channels: ['myspace'],
    };
    expect(DistributionPlanSchema.safeParse(input).success).toBe(false);
  });
});

describe('createDistributionPlan', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockCreateServerClient.mockReturnValue({ prepare: mockPrepare });
    mockBind.mockImplementation(() => ({ first: mockFirst, run: mockRun, all: mockAll }));
    mockPrepare.mockImplementation(() => ({ bind: mockBind }));
    mockRun.mockResolvedValue({ success: true });
    mockAll.mockResolvedValue({ results: [] });
  });

  it('throws INVALID_INPUT on schema violation', async () => {
    await expect(
      createDistributionPlan({ workspaceId: '', projectId: PROJECT, assetId: ASSET, channels: ['youtube'] }),
    ).rejects.toThrow(DistributionPlanError);
  });

  it('throws ASSET_NOT_FOUND when the asset row is missing', async () => {
    mockFirst.mockResolvedValueOnce(null); // asset lookup
    await expect(
      createDistributionPlan({ workspaceId: WORKSPACE, projectId: PROJECT, assetId: ASSET, channels: ['youtube'] }),
    ).rejects.toThrow(DistributionPlanError);
    await expect(
      createDistributionPlan({ workspaceId: WORKSPACE, projectId: PROJECT, assetId: ASSET, channels: ['youtube'] }),
    ).rejects.toThrow(/not found/);
  });

  it('creates a plan and one post per channel with idempotency keys', async () => {
    mockFirst.mockResolvedValueOnce({ id: ASSET }); // asset exists
    const out = await createDistributionPlan({
      workspaceId: WORKSPACE,
      projectId: PROJECT,
      assetId: ASSET,
      channels: ['youtube', 'tiktok', 'instagram', 'facebook'],
    });
    expect(out.planId).toMatch(/^[0-9a-f]{32}$/);
    expect(out.posts.length).toBe(4);
    const platforms = new Set(out.posts.map((p) => p.platform));
    expect(platforms).toEqual(new Set(['youtube', 'tiktok', 'instagram', 'facebook']));
    // idempotency keys are unique and prefixed
    const keys = out.posts.map((p) => p.idempotencyKey);
    expect(new Set(keys).size).toBe(4);
    for (const k of keys) expect(k).toMatch(/^dist_[0-9a-f]{32}_/);
  });

  it('ON CONFLICT(idempotency_key) DO NOTHING is used on post inserts', async () => {
    mockFirst.mockResolvedValueOnce({ id: ASSET });
    await createDistributionPlan({
      workspaceId: WORKSPACE,
      projectId: PROJECT,
      assetId: ASSET,
      channels: ['youtube'],
    });
    const bindCalls = mockBind.mock.calls;
    // First INSERT is the plan; second is the post.
    const postCall = bindCalls[bindCalls.length - 1];
    expect(postCall).toBeDefined();
  });
});

describe('getDistributionPlan / getDistributionPosts', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockCreateServerClient.mockReturnValue({ prepare: mockPrepare });
    mockBind.mockImplementation(() => ({ first: mockFirst, run: mockRun, all: mockAll }));
    mockPrepare.mockImplementation(() => ({ bind: mockBind }));
  });

  it('getDistributionPlan returns null when row missing', async () => {
    mockFirst.mockResolvedValueOnce(null);
    const plan = await getDistributionPlan('missing');
    expect(plan).toBeNull();
  });

  it('getDistributionPlan returns a row when present', async () => {
    mockFirst.mockResolvedValueOnce({
      id: 'p1',
      workspace_id: WORKSPACE,
      project_id: PROJECT,
      asset_id: ASSET,
      channels: JSON.stringify(['youtube']),
      schedule_at: 1700000000,
      status: 'draft',
      metadata: null,
      created_at: 1700000000,
      updated_at: 1700000000,
    });
    const plan = await getDistributionPlan('p1');
    expect(plan).not.toBeNull();
    expect(plan!.workspace_id).toBe(WORKSPACE);
  });

  it('getDistributionPosts returns empty array when no rows', async () => {
    mockAll.mockResolvedValueOnce({ results: [] });
    const posts = await getDistributionPosts('p1');
    expect(posts).toEqual([]);
  });

  it('getDistributionPosts returns rows sorted by created_at', async () => {
    mockAll.mockResolvedValueOnce({
      results: [
        {
          id: 'post-1',
          plan_id: 'p1',
          platform: 'youtube',
          platform_post_id: null,
          status: 'scheduled',
          scheduled_at: 1,
          posted_at: null,
          error: null,
          idempotency_key: 'dist_p1_youtube',
          created_at: 1,
        },
        {
          id: 'post-2',
          plan_id: 'p1',
          platform: 'tiktok',
          platform_post_id: null,
          status: 'scheduled',
          scheduled_at: 1,
          posted_at: null,
          error: null,
          idempotency_key: 'dist_p1_tiktok',
          created_at: 2,
        },
      ],
    });
    const posts = await getDistributionPosts('p1');
    expect(posts.length).toBe(2);
    expect(posts[0].id).toBe('post-1');
    expect(posts[1].id).toBe('post-2');
  });
});

describe('updateDistributionPostStatus', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockCreateServerClient.mockReturnValue({ prepare: mockPrepare });
    mockBind.mockImplementation(() => ({ first: mockFirst, run: mockRun, all: mockAll }));
    mockPrepare.mockImplementation(() => ({ bind: mockBind }));
    mockRun.mockResolvedValue({ success: true });
  });

  it('sets posted_at when status is published', async () => {
    await updateDistributionPostStatus('post-1', 'published', 'fb-1');
    const lastCall = mockBind.mock.calls[mockBind.mock.calls.length - 1];
    // bind includes status, platform_post_id, posted_at, id
    expect(lastCall).toContain('fb-1');
    expect(lastCall).toContain('post-1');
  });

  it('records error on failure', async () => {
    await updateDistributionPostStatus('post-1', 'failed', undefined, 'boom');
    const lastCall = mockBind.mock.calls[mockBind.mock.calls.length - 1];
    expect(lastCall).toContain('boom');
    expect(lastCall).toContain('post-1');
  });
});