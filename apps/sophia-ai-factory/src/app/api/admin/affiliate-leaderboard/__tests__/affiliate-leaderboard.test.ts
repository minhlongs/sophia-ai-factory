/**
 * /api/admin/affiliate-leaderboard — admin auth + query parsing + delegation.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/seed/auth/better-auth-session', () => ({
  getCurrentUserFromHeaders: vi.fn(),
}));
vi.mock('@/seed/auth/is-user-admin', () => ({
  isUserAdmin: vi.fn(),
}));

vi.mock('@/land/affiliates/leaderboard', () => ({
  getTopAffiliates: vi.fn(),
}));

import { getCurrentUserFromHeaders } from '@/seed/auth/better-auth-session';
import { isUserAdmin } from '@/seed/auth/is-user-admin';
import { getTopAffiliates } from '@/land/affiliates/leaderboard';
import { GET } from '../route';

function buildRequest(query: Record<string, string> = {}): NextRequest {
  const url = new URL('http://localhost/api/admin/affiliate-leaderboard');
  for (const [k, v] of Object.entries(query)) url.searchParams.set(k, v);
  return new NextRequest(url);
}

const STUB_ROW = {
  affiliateId: 'aff-1', email: 'a@x.com', name: 'Alex',
  totalClicks: 100, totalConversions: 5, totalCommissionUsd: 50, epc: 0.5,
};

describe('GET /api/admin/affiliate-leaderboard', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 401 anon', async () => {
    vi.mocked(getCurrentUserFromHeaders).mockResolvedValue(null);
    const resp = await GET(buildRequest());
    expect(resp.status).toBe(401);
  });

  it('returns 403 for non-admin', async () => {
    vi.mocked(getCurrentUserFromHeaders).mockResolvedValue({ id: 'u1', role: 'user' } as Awaited<ReturnType<typeof getCurrentUserFromHeaders>>);
    vi.mocked(isUserAdmin).mockResolvedValue(false);
    const resp = await GET(buildRequest());
    expect(resp.status).toBe(403);
  });

  it('returns 400 for invalid limit', async () => {
    vi.mocked(getCurrentUserFromHeaders).mockResolvedValue({ id: 'u1', role: 'admin' } as Awaited<ReturnType<typeof getCurrentUserFromHeaders>>);
    vi.mocked(isUserAdmin).mockResolvedValue(true);
    const resp = await GET(buildRequest({ limit: '0' }));
    expect(resp.status).toBe(400);
  });

  it('returns 400 when from > to', async () => {
    vi.mocked(getCurrentUserFromHeaders).mockResolvedValue({ id: 'u1', role: 'admin' } as Awaited<ReturnType<typeof getCurrentUserFromHeaders>>);
    vi.mocked(isUserAdmin).mockResolvedValue(true);
    const resp = await GET(buildRequest({ from: '2000', to: '1000' }));
    expect(resp.status).toBe(400);
  });

  it('admin sees rows with default sortBy=epc', async () => {
    vi.mocked(getCurrentUserFromHeaders).mockResolvedValue({ id: 'u1', role: 'admin' } as Awaited<ReturnType<typeof getCurrentUserFromHeaders>>);
    vi.mocked(isUserAdmin).mockResolvedValue(true);
    vi.mocked(getTopAffiliates).mockResolvedValue([STUB_ROW]);
    const resp = await GET(buildRequest());
    expect(resp.status).toBe(200);
    const body = await resp.json() as { sortBy: string; count: number };
    expect(body.sortBy).toBe('epc');
    expect(body.count).toBe(1);
  });

  it('passes valid sortBy through', async () => {
    vi.mocked(getCurrentUserFromHeaders).mockResolvedValue({ id: 'u1', role: 'admin' } as Awaited<ReturnType<typeof getCurrentUserFromHeaders>>);
    vi.mocked(isUserAdmin).mockResolvedValue(true);
    vi.mocked(getTopAffiliates).mockResolvedValue([]);
    await GET(buildRequest({ sortBy: 'commission' }));
    expect(getTopAffiliates).toHaveBeenCalledWith(
      expect.any(Number), expect.any(Number), 25, 'commission',
    );
  });

  it('falls back to epc when sortBy invalid', async () => {
    vi.mocked(getCurrentUserFromHeaders).mockResolvedValue({ id: 'u1', role: 'admin' } as Awaited<ReturnType<typeof getCurrentUserFromHeaders>>);
    vi.mocked(isUserAdmin).mockResolvedValue(true);
    vi.mocked(getTopAffiliates).mockResolvedValue([]);
    await GET(buildRequest({ sortBy: 'bogus' }));
    expect(getTopAffiliates).toHaveBeenCalledWith(
      expect.any(Number), expect.any(Number), 25, 'epc',
    );
  });

  it('returns 500 if primitive throws', async () => {
    vi.mocked(getCurrentUserFromHeaders).mockResolvedValue({ id: 'u1', role: 'admin' } as Awaited<ReturnType<typeof getCurrentUserFromHeaders>>);
    vi.mocked(isUserAdmin).mockResolvedValue(true);
    vi.mocked(getTopAffiliates).mockRejectedValue(new Error('boom'));
    const resp = await GET(buildRequest());
    expect(resp.status).toBe(500);
  });
});
