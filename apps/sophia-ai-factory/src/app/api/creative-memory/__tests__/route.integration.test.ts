/**
 * Integration tests for POST/GET/DELETE /api/creative-memory
 */
import { describe, it, expect, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { POST, GET, DELETE } from '../route';

const {
  mockGetCurrentUser,
  mockUpsertMemory,
  mockListMemoryKeys,
  mockDeleteMemory,
  mockNewMemoryId,
} = vi.hoisted(() => {
  const mockGetCurrentUser = vi.fn();
  const mockUpsertMemory = vi.fn();
  const mockListMemoryKeys = vi.fn();
  const mockDeleteMemory = vi.fn();
  const mockNewMemoryId = vi.fn().mockReturnValue('mem_newid123');
  return {
    mockGetCurrentUser,
    mockUpsertMemory,
    mockListMemoryKeys,
    mockDeleteMemory,
    mockNewMemoryId,
  };
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
  upsertMemory: mockUpsertMemory,
  listMemoryKeys: mockListMemoryKeys,
  deleteMemory: mockDeleteMemory,
  newMemoryId: mockNewMemoryId,
}));

function makeReq(method: string, url: string, body?: Record<string, unknown>): NextRequest {
  const opts: { method: string; body?: string; headers?: Record<string, string> } = { method };
  if (body) {
    opts.body = JSON.stringify(body);
    opts.headers = { 'Content-Type': 'application/json' };
  }
  return new NextRequest(url, opts);
}

async function grantAccess(): Promise<void> {
  const { createServerClient } = await import('@/seed/db/client');
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const client = createServerClient() as any;
  client.prepare().bind().first.mockResolvedValueOnce({});
}

// ---------------------------------------------------------------------------
// POST
// ---------------------------------------------------------------------------

describe('POST /api/creative-memory', () => {
  it('returns 401 when unauthenticated', async () => {
    mockGetCurrentUser.mockResolvedValueOnce(null);
    const res = await POST(
      makeReq('POST', 'http://localhost/api/creative-memory', {
        workspaceId: 'ws_1', category: 'identity', key: 'tone', value: 'warm',
      }),
    );
    expect(res.status).toBe(401);
  });

  it('returns 400 when missing required fields', async () => {
    mockGetCurrentUser.mockResolvedValueOnce({ id: 'user1' } as never);
    const res = await POST(
      makeReq('POST', 'http://localhost/api/creative-memory', { key: 'tone' }),
    );
    expect(res.status).toBe(400);
  });

  it('returns 403 when workspace access denied', async () => {
    mockGetCurrentUser.mockResolvedValueOnce({ id: 'user1' } as never);
    const res = await POST(
      makeReq('POST', 'http://localhost/api/creative-memory', {
        workspaceId: 'ws_1', category: 'identity', key: 'tone', value: 'warm',
      }),
    );
    expect(res.status).toBe(403);
  });

  it('creates memory and returns 201', async () => {
    mockGetCurrentUser.mockResolvedValueOnce({ id: 'user1' } as never);
    await grantAccess();

    mockUpsertMemory.mockResolvedValueOnce({
      id: 'mem_newid123', workspaceId: 'ws_1', category: 'identity',
      key: 'tone', value: 'warm', confidence: 'medium', source: 'human_edit',
      evidence: '[]', scope: 'global', scopeId: undefined,
      version: 0, isDeleted: false, createdAt: 0, updatedAt: 0,
    });

    const res = await POST(
      makeReq('POST', 'http://localhost/api/creative-memory', {
        workspaceId: 'ws_1', category: 'identity', key: 'tone', value: 'warm',
      }),
    );
    expect(res.status).toBe(201);
    const data = (await res.json()) as Record<string, unknown>;
    expect(data.key).toBe('tone');
    expect(data.category).toBe('identity');
  });
});

// ---------------------------------------------------------------------------
// GET
// ---------------------------------------------------------------------------

describe('GET /api/creative-memory', () => {
  it('returns 401 when unauthenticated', async () => {
    mockGetCurrentUser.mockResolvedValueOnce(null);
    const res = await GET(makeReq('GET', 'http://localhost/api/creative-memory'));
    expect(res.status).toBe(401);
  });

  it('returns 400 when workspaceId missing', async () => {
    mockGetCurrentUser.mockResolvedValueOnce({ id: 'user1' } as never);
    const res = await GET(makeReq('GET', 'http://localhost/api/creative-memory'));
    expect(res.status).toBe(400);
  });

  it('returns 403 when workspace access denied', async () => {
    mockGetCurrentUser.mockResolvedValueOnce({ id: 'user1' } as never);
    const res = await GET(
      makeReq('GET', 'http://localhost/api/creative-memory?workspaceId=ws_1'),
    );
    expect(res.status).toBe(403);
  });

  it('returns list of memory keys', async () => {
    mockGetCurrentUser.mockResolvedValueOnce({ id: 'user1' } as never);
    await grantAccess();
    mockListMemoryKeys.mockResolvedValueOnce([
      { key: 'tone', category: 'identity' },
      { key: 'audience', category: 'audience' },
    ]);

    const res = await GET(
      makeReq('GET', 'http://localhost/api/creative-memory?workspaceId=ws_1'),
    );
    expect(res.status).toBe(200);
    const data = (await res.json()) as { keys: unknown[] };
    expect(data.keys).toHaveLength(2);
  });
});

// ---------------------------------------------------------------------------
// DELETE (query param id)
// ---------------------------------------------------------------------------

describe('DELETE /api/creative-memory', () => {
  it('returns 401 when unauthenticated', async () => {
    mockGetCurrentUser.mockResolvedValueOnce(null);
    const res = await DELETE(
      makeReq('DELETE', 'http://localhost/api/creative-memory?id=mem_1'),
    );
    expect(res.status).toBe(401);
  });

  it('returns 400 when id missing', async () => {
    mockGetCurrentUser.mockResolvedValueOnce({ id: 'user1' } as never);
    const res = await DELETE(
      makeReq('DELETE', 'http://localhost/api/creative-memory'),
    );
    expect(res.status).toBe(400);
  });

  it('soft-deletes memory and returns 200', async () => {
    mockGetCurrentUser.mockResolvedValueOnce({ id: 'user1' } as never);
    mockDeleteMemory.mockResolvedValueOnce(undefined);

    const res = await DELETE(
      makeReq('DELETE', 'http://localhost/api/creative-memory?id=mem_1'),
    );
    expect(res.status).toBe(200);
    const data = (await res.json()) as Record<string, unknown>;
    expect(data.deleted).toBe(true);
  });
});
