/**
 * Integration tests for GET/DELETE /api/creative-memory/[id]
 */
import { describe, it, expect, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { GET, DELETE } from '../route';

const { mockGetCurrentUser, mockDeleteMemory, mockMemoryRowToDomain } = vi.hoisted(() => {
  const mockGetCurrentUser = vi.fn();
  const mockDeleteMemory = vi.fn();
  const mockMemoryRowToDomain = vi.fn().mockReturnValue({
    id: 'mem_1', workspaceId: 'ws_1', category: 'identity',
    key: 'tone', value: 'warm', confidence: 'medium', source: 'human_edit',
    evidence: '[]', scope: 'global', scopeId: undefined,
    version: 0, isDeleted: false, createdAt: 1000, updatedAt: 1000,
  });
  return { mockGetCurrentUser, mockDeleteMemory, mockMemoryRowToDomain };
});

vi.mock('@/seed/auth/better-auth-session', () => ({
  getCurrentUser: mockGetCurrentUser,
}));

vi.mock('@/seed/db/client', () => {
  const mockFirst = vi.fn().mockResolvedValue(null);
  const mockBind = vi.fn().mockReturnValue({ first: mockFirst });
  const mockPrepare = vi.fn().mockReturnValue({ bind: mockBind });
  const mockD1 = { prepare: mockPrepare };
  return {
    createServerClient: vi.fn().mockReturnValue(mockD1),
  };
});

vi.mock('@/tree/creative-memory', () => ({
  deleteMemory: mockDeleteMemory,
}));

vi.mock('@/tree/creative-memory/types', () => ({
  memoryRowToDomain: mockMemoryRowToDomain,
}));

function makeReq(method: string, url: string): NextRequest {
  return new NextRequest(url, { method });
}

async function mockWorkspaceLookup(): Promise<void> {
  const { createServerClient } = await import('@/seed/db/client');
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const client = createServerClient() as any;
  // First prepare().bind().first call: getMemoryWorkspaceId → returns workspace_id
  client.prepare().bind().first.mockResolvedValueOnce({ workspace_id: 'ws_1' });
  // Second prepare().bind().first call: verifyWorkspaceAccess → returns membership
  client.prepare().bind().first.mockResolvedValueOnce({});
}

const MOCK_PARAMS = { params: Promise.resolve({ id: 'mem_1' }) };

// ---------------------------------------------------------------------------
// GET
// ---------------------------------------------------------------------------

describe('GET /api/creative-memory/[id]', () => {
  it('returns 401 when unauthenticated', async () => {
    mockGetCurrentUser.mockResolvedValueOnce(null);
    const res = await GET(makeReq('GET', 'http://localhost/api/creative-memory/mem_1'), MOCK_PARAMS);
    expect(res.status).toBe(401);
  });

  it('returns 404 when memory not found', async () => {
    mockGetCurrentUser.mockResolvedValueOnce({ id: 'user1' } as never);
    const { createServerClient } = await import('@/seed/db/client');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const client = createServerClient() as any;
    // getMemoryWorkspaceId returns null → 404
    client.prepare().bind().first.mockResolvedValueOnce(null);

    const res = await GET(makeReq('GET', 'http://localhost/api/creative-memory/mem_1'), MOCK_PARAMS);
    expect(res.status).toBe(404);
  });

  it('returns 403 when workspace access denied', async () => {
    mockGetCurrentUser.mockResolvedValueOnce({ id: 'user1' } as never);
    const { createServerClient } = await import('@/seed/db/client');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const client = createServerClient() as any;
    // getMemoryWorkspaceId → found, but access denied
    client.prepare().bind().first.mockResolvedValueOnce({ workspace_id: 'ws_1' });
    client.prepare().bind().first.mockResolvedValueOnce(null);

    const res = await GET(makeReq('GET', 'http://localhost/api/creative-memory/mem_1'), MOCK_PARAMS);
    expect(res.status).toBe(403);
  });

  it('returns memory on success', async () => {
    mockGetCurrentUser.mockResolvedValueOnce({ id: 'user1' } as never);
    await mockWorkspaceLookup();
    const { createServerClient } = await import('@/seed/db/client');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const client = createServerClient() as any;
    // Third call: the actual memory row query
    client.prepare().bind().first.mockResolvedValueOnce({
      id: 'mem_1', workspace_id: 'ws_1', category: 'identity',
      key: 'tone', value: '"warm"', confidence: 'medium', source: 'human_edit',
      evidence: '[]', scope: 'global', scope_id: null,
      version: 0, is_deleted: 0, created_at: 1000, updated_at: 1000, expires_at: null,
    });

    const res = await GET(makeReq('GET', 'http://localhost/api/creative-memory/mem_1'), MOCK_PARAMS);
    expect(res.status).toBe(200);
    const data = (await res.json()) as { memory: Record<string, unknown> };
    expect(data.memory.id).toBe('mem_1');
  });
});

// ---------------------------------------------------------------------------
// DELETE
// ---------------------------------------------------------------------------

describe('DELETE /api/creative-memory/[id]', () => {
  it('returns 401 when unauthenticated', async () => {
    mockGetCurrentUser.mockResolvedValueOnce(null);
    const res = await DELETE(
      makeReq('DELETE', 'http://localhost/api/creative-memory/mem_1'),
      MOCK_PARAMS,
    );
    expect(res.status).toBe(401);
  });

  it('returns 404 when memory not found', async () => {
    mockGetCurrentUser.mockResolvedValueOnce({ id: 'user1' } as never);
    const { createServerClient } = await import('@/seed/db/client');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const client = createServerClient() as any;
    client.prepare().bind().first.mockResolvedValueOnce(null);

    const res = await DELETE(
      makeReq('DELETE', 'http://localhost/api/creative-memory/mem_1'),
      MOCK_PARAMS,
    );
    expect(res.status).toBe(404);
  });

  it('soft-deletes memory and returns 200', async () => {
    mockGetCurrentUser.mockResolvedValueOnce({ id: 'user1' } as never);
    await mockWorkspaceLookup();
    mockDeleteMemory.mockResolvedValueOnce(undefined);

    const res = await DELETE(
      makeReq('DELETE', 'http://localhost/api/creative-memory/mem_1'),
      MOCK_PARAMS,
    );
    expect(res.status).toBe(200);
    const data = (await res.json()) as Record<string, unknown>;
    expect(data.deleted).toBe(true);
    expect(mockDeleteMemory).toHaveBeenCalledWith('mem_1');
  });
});
