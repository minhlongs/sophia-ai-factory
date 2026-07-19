/**
 * /api/affiliate/conversions — auth + pagination guard + JSON shape.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/seed/auth/openclaw-token', () => ({
  getCurrentUserOrOpenclawBearer: vi.fn(),
}));

vi.mock('@/land/affiliates/dashboard-stats', () => ({
  getRecentConversions: vi.fn(),
}));

import { getCurrentUserOrOpenclawBearer as getCurrentUser } from '@/seed/auth/openclaw-token';
import { getRecentConversions } from '@/land/affiliates/dashboard-stats';
import { GET } from '../route';

function buildRequest(query: Record<string, string> = {}): NextRequest {
  const url = new URL('http://localhost/api/affiliate/conversions');
  for (const [k, v] of Object.entries(query)) url.searchParams.set(k, v);
  return new NextRequest(url);
}

describe('GET /api/affiliate/conversions', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 401 when unauthenticated', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(null);
    const resp = await GET(buildRequest());
    expect(resp.status).toBe(401);
  });

  it('returns 400 for negative offset', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue({ id: 'u1' } as Awaited<ReturnType<typeof getCurrentUser>>);
    const resp = await GET(buildRequest({ offset: '-1' }));
    expect(resp.status).toBe(400);
  });

  it('returns 400 for limit < 1', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue({ id: 'u1' } as Awaited<ReturnType<typeof getCurrentUser>>);
    const resp = await GET(buildRequest({ limit: '0' }));
    expect(resp.status).toBe(400);
  });

  it('returns conversion list with default pagination', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue({ id: 'u1' } as Awaited<ReturnType<typeof getCurrentUser>>);
    vi.mocked(getRecentConversions).mockResolvedValue([
      {
        conversionId: 'c1', linkId: 'l1', offerId: 'o1', networkTransactionId: 'tx1',
        grossAmountUsd: 50, commissionUsd: 10, status: 'approved', attributedAt: 1700000000,
      },
    ]);
    const resp = await GET(buildRequest());
    expect(resp.status).toBe(200);
    const body = await resp.json() as { count: number; limit: number; offset: number };
    expect(body.count).toBe(1);
    expect(body.limit).toBe(50);
    expect(body.offset).toBe(0);
  });

  it('passes custom limit/offset to primitive', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue({ id: 'u1' } as Awaited<ReturnType<typeof getCurrentUser>>);
    vi.mocked(getRecentConversions).mockResolvedValue([]);
    await GET(buildRequest({ limit: '20', offset: '40' }));
    expect(getRecentConversions).toHaveBeenCalledWith('u1', 'u1', 20, 40);
  });
});
