/**
 * Integration tests for GET/PATCH /api/ip-graph/[id]
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const {
  mockGetCurrentUser,
  mockGetIP,
  mockGetIPChildren,
  mockUpdateIPStatus,
  mockCreateServerClient,
} = vi.hoisted(() => {
  const mockGetCurrentUser = vi.fn();
  const mockGetIP = vi.fn();
  const mockGetIPChildren = vi.fn();
  const mockUpdateIPStatus = vi.fn();
  const mockFirst = vi.fn().mockResolvedValue(null);
  const mockPrepare = vi.fn().mockReturnValue({
    bind: vi.fn().mockReturnThis(),
    first: mockFirst,
  });
  const mockCreateServerClient = vi.fn().mockReturnValue({ prepare: mockPrepare });
  return { mockGetCurrentUser, mockGetIP, mockGetIPChildren, mockUpdateIPStatus, mockCreateServerClient };
});

// Expose mockFirst so tests can call .mockResolvedValueOnce on it
const mockFirst = mockCreateServerClient().prepare().first;

vi.mock('@/seed/auth/better-auth-session', () => ({
  getCurrentUser: mockGetCurrentUser,
}));

vi.mock('@/seed/db/client', () => ({
  createServerClient: mockCreateServerClient,
}));

vi.mock('@/tree/ip-graph', () => ({
  getIP: mockGetIP,
  getIPChildren: mockGetIPChildren,
  updateIPStatus: mockUpdateIPStatus,
}));

import { GET, PATCH } from './route';
import { GET as GET_children } from './children/route';

const sampleIP = {
  id: 'ip_1',
  workspaceId: 'ws_1',
  type: 'universe' as const,
  name: 'U1',
  description: '',
  metadata: {} as Record<string, unknown>,
  status: 'draft' as const,
  parentId: null as unknown as string | undefined,
  createdAt: 1,
  updatedAt: 1,
};

function grantAccess() {
  mockFirst.mockResolvedValueOnce({});
}

describe('GET /api/ip-graph/[id]', () => {
  beforeEach(() => {
    mockGetCurrentUser.mockClear();
    mockGetIP.mockClear();
    mockFirst.mockClear();
    mockFirst.mockResolvedValue(null);
  });

  it('returns 401 when unauthenticated', async () => {
    mockGetCurrentUser.mockResolvedValueOnce(null);
    const res = await GET(new Request('http://localhost/api/ip-graph/ip_1'), { params: { id: 'ip_1' } });
    expect(res.status).toBe(401);
  });

  it('returns 404 when entity not found', async () => {
    mockGetCurrentUser.mockResolvedValueOnce({ id: 'user1' } as never);
    mockGetIP.mockResolvedValueOnce(null);
    const res = await GET(new Request('http://localhost/api/ip-graph/ip_missing'), { params: { id: 'ip_missing' } });
    expect(res.status).toBe(404);
  });

  it('returns entity when found and authorized', async () => {
    mockGetCurrentUser.mockResolvedValueOnce({ id: 'user1' } as never);
    mockGetIP.mockResolvedValueOnce(sampleIP);
    grantAccess();

    const res = await GET(new Request('http://localhost/api/ip-graph/ip_1'), { params: { id: 'ip_1' } });
    expect(res.status).toBe(200);
    const data = (await res.json()) as { entity: { name: string } };
    expect(data.entity.name).toBe('U1');
  });
});

describe('PATCH /api/ip-graph/[id]', () => {
  beforeEach(() => {
    mockGetCurrentUser.mockClear();
    mockGetIP.mockClear();
    mockUpdateIPStatus.mockClear();
    mockFirst.mockClear();
    mockFirst.mockResolvedValue(null);
  });

  it('returns 403 when workspace access denied', async () => {
    mockGetCurrentUser.mockResolvedValueOnce({ id: 'user1' } as never);
    mockGetIP.mockResolvedValueOnce(sampleIP);
    // No grantAccess() → 403

    const res = await PATCH(
      new Request('http://localhost/api/ip-graph/ip_1', {
        method: 'PATCH',
        body: JSON.stringify({ status: 'approved' }),
        headers: { 'Content-Type': 'application/json' },
      }),
      { params: { id: 'ip_1' } },
    );
    expect(res.status).toBe(403);
  });

  it('updates status when authorized', async () => {
    mockGetCurrentUser.mockResolvedValueOnce({ id: 'user1' } as never);
    mockGetIP.mockResolvedValueOnce(sampleIP);
    grantAccess();
    mockUpdateIPStatus.mockResolvedValueOnce({ ...sampleIP, status: 'approved' });

    const res = await PATCH(
      new Request('http://localhost/api/ip-graph/ip_1', {
        method: 'PATCH',
        body: JSON.stringify({ status: 'approved' }),
        headers: { 'Content-Type': 'application/json' },
      }),
      { params: { id: 'ip_1' } },
    );
    expect(res.status).toBe(200);
    const data = (await res.json()) as { entity: { status: string } };
    expect(data.entity.status).toBe('approved');
  });
});

describe('GET /api/ip-graph/[id]/children', () => {
  beforeEach(() => {
    mockGetCurrentUser.mockClear();
    mockGetIP.mockClear();
    mockGetIPChildren.mockClear();
    mockFirst.mockClear();
    mockFirst.mockResolvedValue(null);
  });

  it('returns children list', async () => {
    mockGetCurrentUser.mockResolvedValueOnce({ id: 'user1' } as never);
    mockGetIP.mockResolvedValueOnce(sampleIP);
    grantAccess();
    mockGetIPChildren.mockResolvedValueOnce([
      { ...sampleIP, id: 'ip_2', name: 'S1', type: 'series', parentId: 'ip_1' },
    ]);

    const res = await GET_children(new Request('http://localhost/api/ip-graph/ip_1/children'), { params: { id: 'ip_1' } });
    expect(res.status).toBe(200);
    const data = (await res.json()) as { children: { name: string }[] };
    expect(data.children).toHaveLength(1);
    expect(data.children[0].name).toBe('S1');
  });
});