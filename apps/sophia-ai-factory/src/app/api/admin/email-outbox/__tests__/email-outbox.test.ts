/**
 * /api/admin/email-outbox — admin auth + delegation + 500 fallback.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/seed/auth/better-auth-session', () => ({
  getCurrentUserFromHeaders: vi.fn(),
}));

vi.mock('@/seed/auth/is-user-admin', () => ({
  isUserAdmin: vi.fn(),
}));

vi.mock('@/land/observability/email-outbox-stats', () => ({
  getEmailOutboxSnapshot: vi.fn(),
}));

import { getCurrentUserFromHeaders } from '@/seed/auth/better-auth-session';
import { isUserAdmin } from '@/seed/auth/is-user-admin';
import { getEmailOutboxSnapshot } from '@/land/observability/email-outbox-stats';
import { GET } from '../route';

type MockUser = Awaited<ReturnType<typeof getCurrentUserFromHeaders>>;

const STUB = {
  totals: [{ status: 'sent' as const, count: 10 }],
  pendingDue: 0,
  pendingFuture: 0,
  recentFailures: [],
  recentSends: [],
};

const mockReq = new NextRequest('http://localhost/api/admin/email-outbox');

describe('GET /api/admin/email-outbox', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 401 anon', async () => {
    vi.mocked(getCurrentUserFromHeaders).mockResolvedValue(null);
    const resp = await GET(mockReq);
    expect(resp.status).toBe(401);
  });

  it('returns 403 for non-admin', async () => {
    vi.mocked(getCurrentUserFromHeaders).mockResolvedValue({ id: 'u1', role: 'user' } as MockUser);
    vi.mocked(isUserAdmin).mockResolvedValue(false);
    const resp = await GET(mockReq);
    expect(resp.status).toBe(403);
  });

  it('admin sees outbox snapshot', async () => {
    vi.mocked(getCurrentUserFromHeaders).mockResolvedValue({ id: 'u1', role: 'admin' } as MockUser);
    vi.mocked(isUserAdmin).mockResolvedValue(true);
    vi.mocked(getEmailOutboxSnapshot).mockResolvedValue(STUB);
    const resp = await GET(mockReq);
    expect(resp.status).toBe(200);
    const body = await resp.json() as typeof STUB;
    expect(body.totals[0].count).toBe(10);
  });

  it('returns 500 if primitive throws', async () => {
    vi.mocked(getCurrentUserFromHeaders).mockResolvedValue({ id: 'u1', role: 'admin' } as MockUser);
    vi.mocked(isUserAdmin).mockResolvedValue(true);
    vi.mocked(getEmailOutboxSnapshot).mockRejectedValue(new Error('boom'));
    const resp = await GET(mockReq);
    expect(resp.status).toBe(500);
  });
});
