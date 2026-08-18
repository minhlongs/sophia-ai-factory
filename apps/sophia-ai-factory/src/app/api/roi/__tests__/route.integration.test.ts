/**
 * GET /api/roi — Integration Tests
 * Phase 4: Creative Learning Loop
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextResponse } from 'next/server';
import { GET } from '../route';
import { getCurrentUser } from '@/seed/auth/better-auth-session';

// vi.hoisted() — all refs used inside vi.mock() factories MUST be hoisted
const {
  mockDbFirst,
  mockDbBind,
  mockDbAll,
} = vi.hoisted(() => {
  const mockDbFirst = vi.fn();
  const mockDbBind = vi.fn().mockReturnThis();
  const mockDbAll = vi.fn().mockResolvedValue({ results: [] });
  return { mockDbFirst, mockDbBind, mockDbAll };
});

const mockStatement = { bind: mockDbBind, first: mockDbFirst, all: mockDbAll };

vi.mock('@/seed/auth/better-auth-session', () => ({
  getCurrentUser: vi.fn(),
}));

vi.mock('@/seed/db/client', () => ({
  createServerClient: vi.fn().mockReturnValue({ prepare: () => mockStatement }),
  getD1: vi.fn().mockReturnValue({ prepare: () => mockStatement }),
}));

const mockUser = { id: 'user_001', email: 'test@example.com', full_name: 'Test User', role: 'owner' };

function authed() { vi.mocked(getCurrentUser).mockResolvedValue(mockUser); }
function unauthed() { vi.mocked(getCurrentUser).mockResolvedValue(null); }
function grantAccess() { mockDbFirst.mockResolvedValue({ 1: 1 }); }
function denyAccess() { mockDbFirst.mockResolvedValue(null); }

async function json<T>(res: NextResponse): Promise<T> {
  return res.json() as Promise<T>;
}

describe('GET /api/roi', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    denyAccess();
  });

  it('returns 401 when not authenticated', async () => {
    unauthed();
    const req = new Request('http://localhost/api/roi');
    const res = await GET(req as never);
    expect(res.status).toBe(401);
  });

  it('returns 400 when workspaceId is missing', async () => {
    authed();
    const req = new Request('http://localhost/api/roi');
    const res = await GET(req as never);
    expect(res.status).toBe(400);
    const body = await json<{ error: string }>(res);
    expect(body.error).toContain('workspaceId');
  });

  it('returns 403 when user has no workspace access', async () => {
    authed();
    denyAccess();
    const url = new URL('http://localhost/api/roi');
    url.searchParams.set('workspaceId', 'ws_other');
    const req = new Request(url.toString());
    const res = await GET(req as never);
    expect(res.status).toBe(403);
  });

  it('returns 200 with ROI data', async () => {
    authed();
    grantAccess();
    const url = new URL('http://localhost/api/roi');
    url.searchParams.set('workspaceId', 'ws_001');
    const req = new Request(url.toString());
    const res = await GET(req as never);
    expect(res.status).toBe(200);
    const body = await json<{ aggregate: unknown; topChannels: unknown[] }>(res);
    expect(body).toHaveProperty('aggregate');
    expect(body).toHaveProperty('topChannels');
    expect(Array.isArray(body.topChannels)).toBe(true);
  });
});