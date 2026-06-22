/**
 * Tests for GET /api/admin/payouts/queue
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/seed/utils/logger-utility', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock('@/seed/utils/to-error', () => ({
  toError: (e: unknown) => (e instanceof Error ? e : new Error(String(e))),
}));

// Mock session-based auth
vi.mock('@/seed/auth/better-auth-session', () => ({
  getCurrentUserFromHeaders: vi.fn(),
}));

vi.mock('@/seed/auth/is-user-admin', () => ({
  isUserAdmin: vi.fn(),
}));

import { GET } from './route';
import { getCurrentUserFromHeaders } from '@/seed/auth/better-auth-session';
import { isUserAdmin } from '@/seed/auth/is-user-admin';
import { NextRequest } from 'next/server';

const mockGetCurrentUserFromHeaders = vi.mocked(getCurrentUserFromHeaders);
const mockIsUserAdmin = vi.mocked(isUserAdmin);

type SessionUser = NonNullable<Awaited<ReturnType<typeof getCurrentUserFromHeaders>>>

const adminUser = { id: 'admin-user-id', email: 'admin@test.com', role: 'admin' } as unknown as SessionUser;

const mockAll = vi.fn();
const mockBind = vi.fn(() => ({ all: mockAll }));
const mockPrepare = vi.fn(() => ({ bind: mockBind }));
const mockDb = { prepare: mockPrepare };

function makeRequest(params = ''): NextRequest {
  return new NextRequest(`https://sophia.agencyos.network/api/admin/payouts/queue${params}`, {
    headers: { cookie: 'session=test' },
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  (globalThis as unknown as { __env: Record<string, unknown> }).__env = { DB: mockDb };
  mockAll.mockResolvedValue({ results: [] });
  mockGetCurrentUserFromHeaders.mockResolvedValue(adminUser);
  mockIsUserAdmin.mockResolvedValue(true);
});

describe('GET /api/admin/payouts/queue', () => {
  it('returns 401 when user is not authenticated', async () => {
    mockGetCurrentUserFromHeaders.mockResolvedValue(null);

    const res = await GET(makeRequest());
    expect(res.status).toBe(401);
  });

  it('returns 403 when user is not admin', async () => {
    mockGetCurrentUserFromHeaders.mockResolvedValue({ id: 'user-1', email: 'user@test.com', role: 'user' } as unknown as SessionUser);
    mockIsUserAdmin.mockResolvedValue(false);

    const res = await GET(makeRequest());
    expect(res.status).toBe(403);
  });

  it('returns empty items array when no users are ready', async () => {
    mockAll.mockResolvedValue({ results: [] });

    const res = await GET(makeRequest());
    const data = await res.json() as Record<string, unknown>;

    expect(res.status).toBe(200);
    expect(data.items).toEqual([]);
    expect(data.next_cursor).toBeNull();
    expect(data.min_payout_usd).toBe(50);
  });

  it('returns users ordered by balance_available desc', async () => {
    mockAll.mockResolvedValue({
      results: [
        { user_id: 'user-a', balance_available: 500, balance_pending: 0, currency: 'USD', last_rebuilt_at: null },
        { user_id: 'user-b', balance_available: 100, balance_pending: 50, currency: 'USD', last_rebuilt_at: null },
      ],
    });

    const res = await GET(makeRequest());
    const data = await res.json() as { items: { user_id: string }[] };

    expect(data.items.length).toBe(2);
    expect(data.items[0]?.user_id).toBe('user-a');
  });

  it('respects custom limit param', async () => {
    mockAll.mockResolvedValue({ results: [] });

    await GET(makeRequest('?limit=10'));

    const bindArgs = (mockBind as ReturnType<typeof vi.fn>).mock.calls.flat();
    expect(bindArgs).toContain(10);
  });

  it('returns 400 for invalid limit (> 100)', async () => {
    const res = await GET(makeRequest('?limit=999'));
    expect(res.status).toBe(400);
  });

  it('returns 500 on D1 error', async () => {
    mockAll.mockRejectedValue(new Error('D1 error'));

    const res = await GET(makeRequest());
    expect(res.status).toBe(500);
  });
});
