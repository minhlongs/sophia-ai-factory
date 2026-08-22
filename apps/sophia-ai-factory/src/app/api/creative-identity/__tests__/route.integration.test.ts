/**
 * Integration tests for POST/GET /api/creative-identity
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { POST, GET } from '../route';

const {
  mockGetCurrentUser,
  mockGetActiveIdentity,
  mockCreateIdentity,
  mockUpdateIdentity,
  mockNewIdentityId,
} = vi.hoisted(() => {
  const mockGetCurrentUser = vi.fn();
  const mockGetActiveIdentity = vi.fn();
  const mockCreateIdentity = vi.fn();
  const mockUpdateIdentity = vi.fn();
  const mockNewIdentityId = vi.fn().mockReturnValue('id_newid123');
  return {
    mockGetCurrentUser,
    mockGetActiveIdentity,
    mockCreateIdentity,
    mockUpdateIdentity,
    mockNewIdentityId,
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

vi.mock('@/tree/creative-identity', () => ({
  getActiveIdentity: mockGetActiveIdentity,
  createIdentity: mockCreateIdentity,
  updateIdentity: mockUpdateIdentity,
  newIdentityId: mockNewIdentityId,
}));

beforeEach(() => vi.clearAllMocks());

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

describe('POST /api/creative-identity', () => {
  it('returns 401 when unauthenticated', async () => {
    mockGetCurrentUser.mockResolvedValueOnce(null);
    const res = await POST(
      makeReq('POST', 'http://localhost/api/creative-identity', { workspaceId: 'ws_1' }),
    );
    expect(res.status).toBe(401);
  });

  it('returns 400 when missing workspaceId', async () => {
    mockGetCurrentUser.mockResolvedValueOnce({ id: 'user1' } as never);
    const res = await POST(
      makeReq('POST', 'http://localhost/api/creative-identity', {}),
    );
    expect(res.status).toBe(400);
  });

  it('returns 403 when workspace access denied', async () => {
    mockGetCurrentUser.mockResolvedValueOnce({ id: 'user1' } as never);
    const res = await POST(
      makeReq('POST', 'http://localhost/api/creative-identity', { workspaceId: 'ws_1' }),
    );
    expect(res.status).toBe(403);
  });

  it('creates identity and returns 201 when no existing', async () => {
    mockGetCurrentUser.mockResolvedValueOnce({ id: 'user1' } as never);
    await grantAccess();
    mockGetActiveIdentity.mockResolvedValueOnce(null);

    mockCreateIdentity.mockResolvedValueOnce({
      id: 'id_newid123', workspaceId: 'ws_1', tone: 'warm',
      voiceDescription: '', formality: 0.5, energy: 0.5,
      beliefs: [], positioning: '', targetAudience: '',
      forbiddenPatterns: [], requiredDisclosures: [],
      preferredFormats: [], referenceWorks: [],
      version: 0, isActive: true, createdAt: 0, updatedAt: 0, updatedBy: 'user1',
    });

    const res = await POST(
      makeReq('POST', 'http://localhost/api/creative-identity', {
        workspaceId: 'ws_1', voice: 'Warm storyteller', tone: 'warm',
      }),
    );
    expect(res.status).toBe(201);
    const data = (await res.json()) as Record<string, unknown>;
    expect(data.tone).toBe('warm');
    expect(mockCreateIdentity).toHaveBeenCalled();
    expect(mockUpdateIdentity).not.toHaveBeenCalled();
  });

  it('updates identity and returns 200 when existing found', async () => {
    mockGetCurrentUser.mockResolvedValueOnce({ id: 'user1' } as never);
    await grantAccess();
    mockGetActiveIdentity.mockResolvedValueOnce({
      id: 'id_existing', workspaceId: 'ws_1', tone: 'formal', version: 2,
    });

    mockUpdateIdentity.mockResolvedValueOnce({
      id: 'id_existing', workspaceId: 'ws_1', tone: 'warm',
      voiceDescription: 'Warm storyteller', formality: 0.5, energy: 0.5,
      beliefs: [], positioning: '', targetAudience: '',
      forbiddenPatterns: [], requiredDisclosures: [],
      preferredFormats: [], referenceWorks: [],
      version: 3, isActive: true, createdAt: 0, updatedAt: 0, updatedBy: 'user1',
    });

    const res = await POST(
      makeReq('POST', 'http://localhost/api/creative-identity', {
        workspaceId: 'ws_1', voice: 'Warm storyteller', tone: 'warm',
      }),
    );
    expect(res.status).toBe(200);
    const data = (await res.json()) as Record<string, unknown>;
    expect(data.id).toBe('id_existing');
    expect(mockUpdateIdentity).toHaveBeenCalled();
    expect(mockCreateIdentity).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// GET
// ---------------------------------------------------------------------------

describe('GET /api/creative-identity', () => {
  it('returns 401 when unauthenticated', async () => {
    mockGetCurrentUser.mockResolvedValueOnce(null);
    const res = await GET(makeReq('GET', 'http://localhost/api/creative-identity'));
    expect(res.status).toBe(401);
  });

  it('returns 400 when workspaceId missing', async () => {
    mockGetCurrentUser.mockResolvedValueOnce({ id: 'user1' } as never);
    const res = await GET(makeReq('GET', 'http://localhost/api/creative-identity'));
    expect(res.status).toBe(400);
  });

  it('returns 403 when workspace access denied', async () => {
    mockGetCurrentUser.mockResolvedValueOnce({ id: 'user1' } as never);
    const res = await GET(
      makeReq('GET', 'http://localhost/api/creative-identity?workspaceId=ws_1'),
    );
    expect(res.status).toBe(403);
  });

  it('returns null identity when none exists', async () => {
    mockGetCurrentUser.mockResolvedValueOnce({ id: 'user1' } as never);
    await grantAccess();
    mockGetActiveIdentity.mockResolvedValueOnce(null);

    const res = await GET(
      makeReq('GET', 'http://localhost/api/creative-identity?workspaceId=ws_1'),
    );
    expect(res.status).toBe(200);
    const data = (await res.json()) as { identity: unknown };
    expect(data.identity).toBeNull();
  });

  it('returns active identity when found', async () => {
    mockGetCurrentUser.mockResolvedValueOnce({ id: 'user1' } as never);
    await grantAccess();
    mockGetActiveIdentity.mockResolvedValueOnce({
      id: 'id_1', workspaceId: 'ws_1', tone: 'authoritative',
    });

    const res = await GET(
      makeReq('GET', 'http://localhost/api/creative-identity?workspaceId=ws_1'),
    );
    expect(res.status).toBe(200);
    const data = (await res.json()) as { identity: Record<string, unknown> };
    expect(data.identity.id).toBe('id_1');
    expect(data.identity.tone).toBe('authoritative');
  });
});
