/**
 * Integration tests for POST/GET /api/ip-graph
 */
import { describe, it, expect, vi } from 'vitest';
import { POST, GET } from '../route';

const {
  mockGetCurrentUser,
  mockCreateIP,
  mockListIP,
  mockNewIpId,
} = vi.hoisted(() => {
  const mockGetCurrentUser = vi.fn();
  const mockCreateIP = vi.fn();
  const mockListIP = vi.fn();
  const mockNewIpId = vi.fn().mockReturnValue('ip_newid123');
  return { mockGetCurrentUser, mockCreateIP, mockListIP, mockNewIpId };
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
  return {
    createServerClient: vi.fn().mockReturnValue(mockD1),
  };
});

vi.mock('@/tree/ip-graph', () => ({
  createIP: mockCreateIP,
  listIP: mockListIP,
  newIpId: mockNewIpId,
}));

describe('POST /api/ip-graph', () => {
  it('returns 401 when unauthenticated', async () => {
    mockGetCurrentUser.mockResolvedValueOnce(null);
    const res = await POST(
      new Request('http://localhost/api/ip-graph', {
        method: 'POST',
        body: JSON.stringify({ workspaceId: 'ws_1', type: 'universe', name: 'Test' }),
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    expect(res.status).toBe(401);
  });

  it('returns 400 when missing required fields', async () => {
    mockGetCurrentUser.mockResolvedValueOnce({ id: 'user1' } as never);
    const res = await POST(
      new Request('http://localhost/api/ip-graph', {
        method: 'POST',
        body: JSON.stringify({ name: 'Test' }),
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    expect(res.status).toBe(400);
  });

  it('returns 403 when workspace access denied', async () => {
    mockGetCurrentUser.mockResolvedValueOnce({ id: 'user1' } as never);
    // No access: org_members returns null (mock default)
    const res = await POST(
      new Request('http://localhost/api/ip-graph', {
        method: 'POST',
        body: JSON.stringify({ workspaceId: 'ws_1', type: 'universe', name: 'Test' }),
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    expect(res.status).toBe(403);
  });

  it('creates IP entity and returns 201', async () => {
    mockGetCurrentUser.mockResolvedValueOnce({ id: 'user1' } as never);
    // Grant access: override first() to return truthy
    const { createServerClient } = await import('@/seed/db/client');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mockClient = createServerClient() as any;
    mockClient.prepare().first.mockResolvedValueOnce({}); // org_members exists

    mockCreateIP.mockResolvedValueOnce({
      id: 'ip_newid123',
      workspaceId: 'ws_1',
      type: 'universe',
      name: 'My Universe',
      description: '',
      metadata: {},
      status: 'draft',
      createdAt: 1000,
      updatedAt: 1000,
    });

    const res = await POST(
      new Request('http://localhost/api/ip-graph', {
        method: 'POST',
        body: JSON.stringify({ workspaceId: 'ws_1', type: 'universe', name: 'My Universe' }),
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    expect(res.status).toBe(201);
    const data = (await res.json()) as Record<string, unknown>;
    expect(data.name).toBe('My Universe');
    expect(data.type).toBe('universe');
  });
});

describe('GET /api/ip-graph', () => {
  it('returns 401 when unauthenticated', async () => {
    mockGetCurrentUser.mockResolvedValueOnce(null);
    const res = await GET(new Request('http://localhost/api/ip-graph'));
    expect(res.status).toBe(401);
  });

  it('returns 400 when workspaceId missing', async () => {
    mockGetCurrentUser.mockResolvedValueOnce({ id: 'user1' } as never);
    const res = await GET(new Request('http://localhost/api/ip-graph'));
    expect(res.status).toBe(400);
  });

  it('returns list of IP entities', async () => {
    mockGetCurrentUser.mockResolvedValueOnce({ id: 'user1' } as never);
    const { createServerClient } = await import('@/seed/db/client');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mockClient = createServerClient() as any;
    mockClient.prepare().first.mockResolvedValueOnce({});
    mockListIP.mockResolvedValueOnce([
      { id: 'ip_1', workspaceId: 'ws_1', type: 'universe', name: 'U1', description: '', metadata: {}, status: 'draft', parentId: null, createdAt: 1, updatedAt: 1 },
    ]);

    const res = await GET(new Request('http://localhost/api/ip-graph?workspaceId=ws_1'));
    expect(res.status).toBe(200);
    const data = (await res.json()) as { entities: unknown[] };
    expect(data.entities).toHaveLength(1);
  });
});