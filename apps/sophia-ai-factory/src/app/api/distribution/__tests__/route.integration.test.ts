/**
 * Integration tests for POST/GET /api/distribution
 */
import { describe, it, expect, vi } from 'vitest';
import { POST, GET } from '../route';

const {
  mockGetCurrentUser,
  mockCreateDistributionPlan,
  mockListDistributionPlans,
} = vi.hoisted(() => {
  const mockGetCurrentUser = vi.fn();
  const mockCreateDistributionPlan = vi.fn();
  const mockListDistributionPlans = vi.fn();
  return { mockGetCurrentUser, mockCreateDistributionPlan, mockListDistributionPlans };
});

vi.mock('@/seed/auth/better-auth-session', () => ({
  getCurrentUser: mockGetCurrentUser,
}));

vi.mock('@/seed/db/client', () => {
  const mockPrepare = vi.fn().mockReturnValue({
    bind: vi.fn().mockReturnThis(),
    first: vi.fn().mockResolvedValue(null),
  });
  const mockD1 = { prepare: mockPrepare };
  return { createServerClient: vi.fn().mockReturnValue(mockD1) };
});

vi.mock('@/tree/distribution', () => ({
  createDistributionPlan: mockCreateDistributionPlan,
  listDistributionPlans: mockListDistributionPlans,
}));

describe('POST /api/distribution', () => {
  it('returns 401 when unauthenticated', async () => {
    mockGetCurrentUser.mockResolvedValueOnce(null);
    const res = await POST(
      new Request('http://localhost/api/distribution', {
        method: 'POST',
        body: JSON.stringify({ workspaceId: 'ws_1', contentProjectId: 'cp_1' }),
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    expect(res.status).toBe(401);
  });

  it('returns 400 when missing required fields', async () => {
    mockGetCurrentUser.mockResolvedValueOnce({ id: 'user1' } as never);
    const res = await POST(
      new Request('http://localhost/api/distribution', {
        method: 'POST',
        body: JSON.stringify({ workspaceId: 'ws_1' }),
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    expect(res.status).toBe(400);
  });

  it('returns 403 when workspace access denied', async () => {
    mockGetCurrentUser.mockResolvedValueOnce({ id: 'user1' } as never);
    const res = await POST(
      new Request('http://localhost/api/distribution', {
        method: 'POST',
        body: JSON.stringify({ workspaceId: 'ws_1', contentProjectId: 'cp_1' }),
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    expect(res.status).toBe(403);
  });

  it('creates plan and returns 201', async () => {
    mockGetCurrentUser.mockResolvedValueOnce({ id: 'user1' } as never);
    const { createServerClient } = await import('@/seed/db/client');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mockClient = createServerClient() as any;
    mockClient.prepare().first.mockResolvedValueOnce({});

    mockCreateDistributionPlan.mockResolvedValueOnce({
      id: 'dplt_abc123',
      workspaceId: 'ws_1',
      projectId: 'cp_1',
      channels: [{ channel: 'youtube', assetId: '', settings: {} }],
      scheduleAt: undefined,
      status: 'draft',
      createdAt: 1000,
      updatedAt: 1000,
    });

    const res = await POST(
      new Request('http://localhost/api/distribution', {
        method: 'POST',
        body: JSON.stringify({
          workspaceId: 'ws_1',
          contentProjectId: 'cp_1',
          platforms: ['youtube'],
        }),
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    expect(res.status).toBe(201);
    const data = (await res.json()) as { plan: { status: string } };
    expect(data.plan.status).toBe('draft');
  });

  it('returns 400 on invalid JSON body', async () => {
    mockGetCurrentUser.mockResolvedValueOnce({ id: 'user1' } as never);
    const res = await POST(
      new Request('http://localhost/api/distribution', {
        method: 'POST',
        body: 'not-json',
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    expect(res.status).toBe(400);
  });
});

describe('GET /api/distribution', () => {
  it('returns 401 when unauthenticated', async () => {
    mockGetCurrentUser.mockResolvedValueOnce(null);
    const res = await GET(new Request('http://localhost/api/distribution'));
    expect(res.status).toBe(401);
  });

  it('returns 400 when workspaceId missing', async () => {
    mockGetCurrentUser.mockResolvedValueOnce({ id: 'user1' } as never);
    const res = await GET(new Request('http://localhost/api/distribution'));
    expect(res.status).toBe(400);
  });

  it('returns 400 on invalid status filter', async () => {
    mockGetCurrentUser.mockResolvedValueOnce({ id: 'user1' } as never);
    const res = await GET(
      new Request('http://localhost/api/distribution?workspaceId=ws_1&status=bogus'),
    );
    expect(res.status).toBe(400);
  });

  it('returns 403 when workspace access denied', async () => {
    mockGetCurrentUser.mockResolvedValueOnce({ id: 'user1' } as never);
    const res = await GET(
      new Request('http://localhost/api/distribution?workspaceId=ws_1'),
    );
    expect(res.status).toBe(403);
  });

  it('returns list of plans', async () => {
    mockGetCurrentUser.mockResolvedValueOnce({ id: 'user1' } as never);
    const { createServerClient } = await import('@/seed/db/client');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mockClient = createServerClient() as any;
    mockClient.prepare().first.mockResolvedValueOnce({});

    mockListDistributionPlans.mockResolvedValueOnce([
      {
        id: 'dplt_1', workspaceId: 'ws_1', projectId: 'cp_1',
        channels: [], scheduleAt: undefined, status: 'draft',
        createdAt: 1, updatedAt: 1,
      },
    ]);

    const res = await GET(
      new Request('http://localhost/api/distribution?workspaceId=ws_1'),
    );
    expect(res.status).toBe(200);
    const data = (await res.json()) as { plans: unknown[] };
    expect(data.plans).toHaveLength(1);
  });
});
