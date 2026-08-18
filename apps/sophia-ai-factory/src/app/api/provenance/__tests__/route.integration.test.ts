/**
 * Integration tests for GET /api/provenance
 */
import { describe, it, expect, vi } from 'vitest';
import { GET } from '../route';

// Hoist all mock refs used inside vi.mock factories
const {
  mockGetCurrentUser,
  mockGetProvenanceChain,
  mockGetDerivatives,
} = vi.hoisted(() => {
  const mockGetCurrentUser = vi.fn();
  const mockGetProvenanceChain = vi.fn();
  const mockGetDerivatives = vi.fn();
  return { mockGetCurrentUser, mockGetProvenanceChain, mockGetDerivatives };
});

vi.mock('@/seed/auth/better-auth-session', () => ({
  getCurrentUser: mockGetCurrentUser,
}));

vi.mock('@/seed/db/client', () => {
  const mockPrepare = vi.fn().mockReturnValue({
    bind: vi.fn().mockReturnThis(),
    first: vi.fn().mockResolvedValue(null),
  });
  const mockD1 = {
    prepare: mockPrepare,
  };
  return {
    createServerClient: vi.fn().mockReturnValue(mockD1),
  };
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const castMock = (m: any) => m;

vi.mock('@/tree/provenance', () => ({
  getProvenanceChain: mockGetProvenanceChain,
  getDerivatives: mockGetDerivatives,
}));

function createRequest(url: string) {
  return new Request(url);
}

describe('GET /api/provenance', () => {
  it('returns 401 when unauthenticated', async () => {
    mockGetCurrentUser.mockResolvedValueOnce(null);
    const res = await GET(createRequest('http://localhost/api/provenance'));
    expect(res.status).toBe(401);
  });

  it('returns 400 when assetId missing', async () => {
    mockGetCurrentUser.mockResolvedValueOnce({ id: 'user1' } as never);
    const res = await GET(createRequest('http://localhost/api/provenance'));
    expect(res.status).toBe(400);
  });

  it('returns 403 when workspace access denied', async () => {
    mockGetCurrentUser.mockResolvedValueOnce({ id: 'user1' } as never);
    // Return a chain so we exercise the workspace check
    mockGetProvenanceChain.mockResolvedValueOnce([
      { id: 'prov_1', workspaceId: 'ws_1', assetId: 'asset_ws1', action: 'created', actorType: 'agent', actorId: 'a1', metadata: '{}', createdAt: 1000 },
    ]);
    // org_members query returns null → access denied
    const res = await GET(createRequest('http://localhost/api/provenance?assetId=asset_ws1'));
    expect(res.status).toBe(403);
    // cleanup mock for next tests
    mockGetProvenanceChain.mockClear();
  });

  it('returns provenance chain for valid assetId', async () => {
    mockGetCurrentUser.mockResolvedValueOnce({ id: 'user1' } as never);
    // Access granted: mock org_members first() to return truthy
    // We need the mockPrepare to track bind calls and return truthy on first call
    const { createServerClient } = await import('@/seed/db/client');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mockClient = createServerClient() as any;
    const mockFirst = castMock(mockClient.prepare().first);
    mockFirst.mockResolvedValueOnce({}); // org_members exists
    mockFirst.mockResolvedValueOnce(null); // subsequent calls return null

    mockGetProvenanceChain.mockResolvedValueOnce([
      {
        id: 'prov_1',
        workspaceId: 'ws_1',
        assetId: 'asset_ws1',
        action: 'created',
        actorType: 'agent',
        actorId: 'agent_1',
        metadata: '{}',
        createdAt: 1000,
      },
    ]);

    const res = await GET(createRequest('http://localhost/api/provenance?assetId=asset_ws1'));
    expect(res.status).toBe(200);
    const data = (await res.json()) as { chain: { action: string }[] };
    expect(data.chain).toHaveLength(1);
    expect(data.chain[0].action).toBe('created');
  });

  it('includes derivatives when includeDerivatives=true', async () => {
    mockGetCurrentUser.mockResolvedValueOnce({ id: 'user1' } as never);
    const { createServerClient } = await import('@/seed/db/client');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mockClient = createServerClient() as any;
    const mockFirst = castMock(mockClient.prepare().first);
    mockFirst.mockResolvedValueOnce({});

    mockGetProvenanceChain.mockResolvedValueOnce([]);
    mockGetDerivatives.mockResolvedValueOnce([
      {
        id: 'prov_2',
        workspaceId: 'ws_1',
        assetId: 'asset_456',
        action: 'derived',
        actorType: 'user',
        actorId: 'user_1',
        derivativeOf: 'asset_ws1',
        metadata: '{}',
        createdAt: 2000,
      },
    ]);

    const res = await GET(createRequest('http://localhost/api/provenance?assetId=asset_ws1&includeDerivatives=true'));
    expect(res.status).toBe(200);
    const data = (await res.json()) as { derivatives: { action: string }[] };
    expect(data.derivatives).toHaveLength(1);
    expect(data.derivatives[0].action).toBe('derived');
  });
});