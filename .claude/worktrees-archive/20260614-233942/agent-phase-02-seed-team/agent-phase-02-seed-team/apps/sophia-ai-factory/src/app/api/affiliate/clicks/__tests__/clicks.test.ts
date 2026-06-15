/**
 * /api/affiliate/clicks — auth + window resolution + delegation to primitive.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/seed/auth/better-auth-session', () => ({
  getCurrentUser: vi.fn(),
}));

vi.mock('@/land/affiliates/dashboard-stats', () => ({
  getAffiliateClickStats: vi.fn(),
}));

import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { getAffiliateClickStats } from '@/land/affiliates/dashboard-stats';
import { GET } from '../route';

function buildRequest(query: Record<string, string> = {}): NextRequest {
  const url = new URL('http://localhost/api/affiliate/clicks');
  for (const [k, v] of Object.entries(query)) url.searchParams.set(k, v);
  return new NextRequest(url);
}

describe('GET /api/affiliate/clicks', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 401 when unauthenticated', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(null);
    const resp = await GET(buildRequest());
    expect(resp.status).toBe(401);
  });

  it('returns 400 when from > to', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue({ id: 'u1' } as Awaited<ReturnType<typeof getCurrentUser>>);
    const resp = await GET(buildRequest({ from: '2000', to: '1000' }));
    expect(resp.status).toBe(400);
  });

  it('returns 400 when from is non-numeric', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue({ id: 'u1' } as Awaited<ReturnType<typeof getCurrentUser>>);
    const resp = await GET(buildRequest({ from: 'abc', to: '1000' }));
    expect(resp.status).toBe(400);
  });

  it('delegates to primitive with default 30-day window when params omitted', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue({ id: 'u1' } as Awaited<ReturnType<typeof getCurrentUser>>);
    vi.mocked(getAffiliateClickStats).mockResolvedValue({
      totalClicks: 10, totalConversions: 1, totalCommissionUsd: 5, epc: 0.5,
    });
    const resp = await GET(buildRequest());
    expect(resp.status).toBe(200);
    const body = await resp.json() as { totalClicks: number; epc: number; from: number; to: number };
    expect(body.totalClicks).toBe(10);
    expect(body.epc).toBe(0.5);
    expect(body.to - body.from).toBeGreaterThanOrEqual(30 * 86400 - 1);
  });

  it('passes through caller from/to', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue({ id: 'u1' } as Awaited<ReturnType<typeof getCurrentUser>>);
    vi.mocked(getAffiliateClickStats).mockResolvedValue({
      totalClicks: 0, totalConversions: 0, totalCommissionUsd: 0, epc: 0,
    });
    await GET(buildRequest({ from: '1000', to: '2000' }));
    expect(getAffiliateClickStats).toHaveBeenCalledWith('u1', 'u1', 1000, 2000);
  });
});
