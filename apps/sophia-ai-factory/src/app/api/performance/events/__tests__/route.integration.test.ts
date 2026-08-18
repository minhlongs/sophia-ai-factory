/**
 * POST /api/performance/events — Integration Tests
 * Phase 4: Creative Learning Loop
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextResponse } from 'next/server';
import { POST } from '../route';
import { getCurrentUser } from '@/seed/auth/better-auth-session';

// vi.hoisted() for shared mock refs
const {
  mockDbFirst,
  mockDbBind,
  mockDbAll,
  mockRecord,
  mockNewId,
} = vi.hoisted(() => {
  const mockDbFirst = vi.fn();
  const mockDbBind = vi.fn().mockReturnThis();
  const mockDbAll = vi.fn().mockResolvedValue({ results: [] });
  const mockRecord = vi.fn().mockResolvedValue(undefined);
  const mockNewId = vi.fn(() => 'evt_test_001');
  return { mockDbFirst, mockDbBind, mockDbAll, mockRecord, mockNewId };
});

const mockStatement = { bind: mockDbBind, first: mockDbFirst, all: mockDbAll };

vi.mock('@/seed/auth/better-auth-session', () => ({
  getCurrentUser: vi.fn(),
}));

vi.mock('@/tree/performance', () => ({
  recordPerformanceEvent: mockRecord,
  newPerformanceEventId: mockNewId,
}));

vi.mock('@/seed/db/client', () => ({
  createServerClient: vi.fn().mockReturnValue({ prepare: () => mockStatement }),
}));

const mockUser = { id: 'user_001', email: 'test@example.com', full_name: 'Test User', role: 'owner' };

function authed() { vi.mocked(getCurrentUser).mockResolvedValue(mockUser); }
function unauthed() { vi.mocked(getCurrentUser).mockResolvedValue(null); }
function grantAccess() { mockDbFirst.mockResolvedValue({ 1: 1 }); }
function denyAccess() { mockDbFirst.mockResolvedValue(null); }

async function json<T>(res: NextResponse): Promise<T> {
  return res.json() as Promise<T>;
}

describe('POST /api/performance/events', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRecord.mockResolvedValue(undefined);
    denyAccess();
  });

  it('returns 401 when not authenticated', async () => {
    unauthed();
    const req = new Request('http://localhost/api/performance/events', { method: 'POST', body: JSON.stringify({}) });
    const res = await POST(req as never);
    expect(res.status).toBe(401);
  });

  it('returns 400 when body is invalid', async () => {
    authed();
    const req = new Request('http://localhost/api/performance/events', { method: 'POST', body: JSON.stringify({}) });
    const res = await POST(req as never);
    expect(res.status).toBe(400);
    const body = await json<{ error: string }>(res);
    expect(body.error).toBeDefined();
  });

  it('returns 403 when user has no workspace access', async () => {
    authed();
    denyAccess();
    const body = {
      workspaceId: 'ws_other',
      assetId: 'asset_001',
      projectId: 'proj_001',
      entityType: 'asset',
      entityId: 'asset_001',
      eventType: 'view',
      count: 1,
      valueCents: 0,
      channel: 'youtube',
    };
    const req = new Request('http://localhost/api/performance/events', { method: 'POST', body: JSON.stringify(body) });
    const res = await POST(req as never);
    expect(res.status).toBe(403);
  });

  it('returns 201 when event is recorded', async () => {
    authed();
    grantAccess();
    const body = {
      workspaceId: 'ws_001',
      assetId: 'asset_001',
      projectId: 'proj_001',
      entityType: 'asset',
      entityId: 'asset_001',
      eventType: 'view',
      count: 1,
      valueCents: 0,
      channel: 'youtube',
    };
    const req = new Request('http://localhost/api/performance/events', { method: 'POST', body: JSON.stringify(body) });
    const res = await POST(req as never);
    expect(res.status).toBe(201);
    const data = await json<{ id: string; status: string }>(res);
    expect(data).toHaveProperty('id');
    expect(data.status).toBe('recorded');
  });
});