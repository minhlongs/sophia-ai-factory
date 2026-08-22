/**
 * Integration tests for GET/PATCH /api/distribution/[id]
 */
import { describe, it, expect, vi } from 'vitest';
import { GET, PATCH } from '../route';

const {
  mockGetCurrentUser,
  mockGetDistributionPlan,
  mockUpdateDistributionPlanStatus,
  mockIsValidPlanTransition,
} = vi.hoisted(() => {
  const mockGetCurrentUser = vi.fn();
  const mockGetDistributionPlan = vi.fn();
  const mockUpdateDistributionPlanStatus = vi.fn();
  const mockIsValidPlanTransition = vi.fn();
  return {
    mockGetCurrentUser,
    mockGetDistributionPlan,
    mockUpdateDistributionPlanStatus,
    mockIsValidPlanTransition,
  };
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
  getDistributionPlan: mockGetDistributionPlan,
  updateDistributionPlanStatus: mockUpdateDistributionPlanStatus,
  isValidPlanTransition: mockIsValidPlanTransition,
}));

const MOCK_PARAMS = { params: Promise.resolve({ id: 'dplt_1' }) };

async function mockDbAccess() {
  const { createServerClient } = await import('@/seed/db/client');
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mockClient = createServerClient() as any;
  mockClient.prepare.mockReturnValue({
    bind: vi.fn().mockReturnThis(),
    first: vi.fn()
      .mockResolvedValueOnce({ workspace_id: 'ws_test_001' })
      .mockResolvedValueOnce({}),
  });
}

describe('GET /api/distribution/[id]', () => {
  it('returns 401 when unauthenticated', async () => {
    mockGetCurrentUser.mockResolvedValueOnce(null);
    const res = await GET(new Request('http://localhost/api/distribution/dplt_1'), MOCK_PARAMS);
    expect(res.status).toBe(401);
  });

  it('returns 404 when plan not found', async () => {
    mockGetCurrentUser.mockResolvedValueOnce({ id: 'user1' } as never);
    // prepare().first() returns null for plan lookup
    const res = await GET(new Request('http://localhost/api/distribution/dplt_1'), MOCK_PARAMS);
    expect(res.status).toBe(404);
  });

  it('returns 403 when workspace access denied', async () => {
    mockGetCurrentUser.mockResolvedValueOnce({ id: 'user1' } as never);
    const { createServerClient } = await import('@/seed/db/client');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mockClient = createServerClient() as any;
    // Plan lookup succeeds but org_members returns null (no access)
    mockClient.prepare.mockReturnValue({
      bind: vi.fn().mockReturnThis(),
      first: vi.fn()
        .mockResolvedValueOnce({ workspace_id: 'ws_test_001' }) // plan lookup (lookupWorkspaceId)
        .mockResolvedValueOnce(null), // org_members null → forbidden (verifyWorkspaceAccess)
    });

    const res = await GET(new Request('http://localhost/api/distribution/dplt_1'), MOCK_PARAMS);
    expect(res.status).toBe(403);
  });

  it('returns plan on success', async () => {
    mockGetCurrentUser.mockResolvedValueOnce({ id: 'user1' } as never);
    await await mockDbAccess();

    mockGetDistributionPlan.mockResolvedValueOnce({
      id: 'dplt_1', workspaceId: 'ws_test_001', projectId: 'cp_1',
      channels: [], scheduleAt: undefined, status: 'draft',
      createdAt: 1, updatedAt: 1,
    });

    const res = await GET(new Request('http://localhost/api/distribution/dplt_1'), MOCK_PARAMS);
    expect(res.status).toBe(200);
    const data = (await res.json()) as { plan: { id: string } };
    expect(data.plan.id).toBe('dplt_1');
  });
});

describe('PATCH /api/distribution/[id]', () => {
  it('returns 401 when unauthenticated', async () => {
    mockGetCurrentUser.mockResolvedValueOnce(null);
    const res = await PATCH(
      new Request('http://localhost/api/distribution/dplt_1', {
        method: 'PATCH',
        body: JSON.stringify({ status: 'scheduled' }),
        headers: { 'Content-Type': 'application/json' },
      }),
      MOCK_PARAMS,
    );
    expect(res.status).toBe(401);
  });

  it('returns 400 on invalid JSON body', async () => {
    mockGetCurrentUser.mockResolvedValueOnce({ id: 'user1' } as never);
    const res = await PATCH(
      new Request('http://localhost/api/distribution/dplt_1', {
        method: 'PATCH',
        body: 'not-json',
        headers: { 'Content-Type': 'application/json' },
      }),
      MOCK_PARAMS,
    );
    expect(res.status).toBe(400);
  });

  it('returns 400 on invalid status value', async () => {
    mockGetCurrentUser.mockResolvedValueOnce({ id: 'user1' } as never);
    const res = await PATCH(
      new Request('http://localhost/api/distribution/dplt_1', {
        method: 'PATCH',
        body: JSON.stringify({ status: 'bogus' }),
        headers: { 'Content-Type': 'application/json' },
      }),
      MOCK_PARAMS,
    );
    expect(res.status).toBe(400);
  });

  it('returns 400 on invalid status transition', async () => {
    mockGetCurrentUser.mockResolvedValueOnce({ id: 'user1' } as never);
    await mockDbAccess();

    mockGetDistributionPlan.mockResolvedValueOnce({
      id: 'dplt_1', workspaceId: 'ws_test_001', projectId: 'cp_1',
      channels: [], scheduleAt: undefined, status: 'published',
      createdAt: 1, updatedAt: 1,
    });
    mockIsValidPlanTransition.mockReturnValueOnce(false);

    const res = await PATCH(
      new Request('http://localhost/api/distribution/dplt_1', {
        method: 'PATCH',
        body: JSON.stringify({ status: 'draft' }),
        headers: { 'Content-Type': 'application/json' },
      }),
      MOCK_PARAMS,
    );
    expect(res.status).toBe(400);
    const data = (await res.json()) as { error: string };
    expect(data.error).toContain('Invalid transition');
  });

  it('updates plan status and returns 200', async () => {
    mockGetCurrentUser.mockResolvedValueOnce({ id: 'user1' } as never);
    await mockDbAccess();

    mockGetDistributionPlan.mockResolvedValueOnce({
      id: 'dplt_1', workspaceId: 'ws_test_001', projectId: 'cp_1',
      channels: [], scheduleAt: undefined, status: 'draft',
      createdAt: 1, updatedAt: 1,
    });
    mockIsValidPlanTransition.mockReturnValueOnce(true);
    mockUpdateDistributionPlanStatus.mockResolvedValueOnce({
      id: 'dplt_1', workspaceId: 'ws_test_001', projectId: 'cp_1',
      channels: [], scheduleAt: undefined, status: 'scheduled',
      createdAt: 1, updatedAt: 2,
    });

    const res = await PATCH(
      new Request('http://localhost/api/distribution/dplt_1', {
        method: 'PATCH',
        body: JSON.stringify({ status: 'scheduled' }),
        headers: { 'Content-Type': 'application/json' },
      }),
      MOCK_PARAMS,
    );
    expect(res.status).toBe(200);
    const data = (await res.json()) as { plan: { status: string } };
    expect(data.plan.status).toBe('scheduled');
  });
});
