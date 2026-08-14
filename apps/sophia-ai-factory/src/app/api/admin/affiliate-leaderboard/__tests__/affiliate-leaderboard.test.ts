/**
 * /api/admin/affiliate-leaderboard — admin auth + query parsing + delegation.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';
import { GET } from '@/app/api/admin/affiliate-leaderboard/route';
import { requireAdmin } from '@/seed/auth/require-admin';
import { getTopAffiliates } from '@/land/affiliates/leaderboard';

vi.mock('@/seed/auth/require-admin', () => ({
  requireAdmin: vi.fn(),
}));

vi.mock('@/land/affiliates/leaderboard', () => ({
  getTopAffiliates: vi.fn(),
}));

const buildRequest = (query?: Record<string, string>): NextRequest => {
  const url = new URL('http://localhost/api/admin/affiliate-leaderboard');
  if (query) {
    Object.entries(query).forEach(([k, v]) => url.searchParams.set(k, v));
  }
  return new NextRequest(url) as NextRequest;
};

describe('GET /api/admin/affiliate-leaderboard', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('returns 401 if not authenticated', async () => {
    vi.mocked(requireAdmin).mockResolvedValue(
      NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
    );

    const resp = await GET(buildRequest());
    expect(resp.status).toBe(401);
  });

  it('returns 403 if authenticated but not admin', async () => {
    vi.mocked(requireAdmin).mockResolvedValue(
      NextResponse.json(
        { error: 'Forbidden: admin role required' },
        { status: 403 },
      ),
    );

    const resp = await GET(buildRequest());
    expect(resp.status).toBe(403);
  });

  it('returns 200 with leaderboard data for admin', async () => {
    vi.mocked(requireAdmin).mockResolvedValue({ user: { id: 'u1', role: 'admin' } } as any);
    vi.mocked(getTopAffiliates).mockResolvedValue([
      { affiliateId: 'a1', email: 'a@x.com', name: 'Alex', totalClicks: 10, totalConversions: 2, totalCommissionUsd: 50, epc: 5 },
    ]);

    const resp = await GET(buildRequest());
    expect(resp.status).toBe(200);
  });

  it('returns 500 if primitive throws', async () => {
    vi.mocked(requireAdmin).mockResolvedValue({ user: { id: 'u1', role: 'admin' } } as any);
    vi.mocked(getTopAffiliates).mockRejectedValue(new Error('boom'));

    const resp = await GET(buildRequest());
    expect(resp.status).toBe(500);
  });
});