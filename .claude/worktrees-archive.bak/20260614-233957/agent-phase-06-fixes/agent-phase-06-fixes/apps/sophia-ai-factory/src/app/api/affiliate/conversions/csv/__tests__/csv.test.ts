/**
 * /api/affiliate/conversions/csv — auth + CSV body + headers.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/seed/auth/better-auth-session', () => ({
  getCurrentUser: vi.fn(),
}));

vi.mock('@/land/affiliates/dashboard-stats', () => ({
  getRecentConversions: vi.fn(),
}));

import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { getRecentConversions } from '@/land/affiliates/dashboard-stats';
import { GET } from '../route';

function buildRequest(query: Record<string, string> = {}): NextRequest {
  const url = new URL('http://localhost/api/affiliate/conversions/csv');
  for (const [k, v] of Object.entries(query)) url.searchParams.set(k, v);
  return new NextRequest(url);
}

describe('GET /api/affiliate/conversions/csv', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 401 when unauthenticated', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(null);
    const resp = await GET(buildRequest());
    expect(resp.status).toBe(401);
  });

  it('returns CSV with header even when empty', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue({ id: 'u1' } as Awaited<ReturnType<typeof getCurrentUser>>);
    vi.mocked(getRecentConversions).mockResolvedValue([]);
    const resp = await GET(buildRequest());
    expect(resp.status).toBe(200);
    expect(resp.headers.get('content-type')).toContain('text/csv');
    expect(resp.headers.get('content-disposition')).toContain('attachment');
    const body = await resp.text();
    expect(body.split('\n')[0]).toBe(
      'conversion_id,link_id,offer_id,network_transaction_id,gross_amount_usd,commission_usd,status,attributed_at_iso',
    );
  });

  it('renders rows with formatted USD and ISO date', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue({ id: 'u1' } as Awaited<ReturnType<typeof getCurrentUser>>);
    vi.mocked(getRecentConversions).mockResolvedValue([
      {
        conversionId: 'c1', linkId: 'l1', offerId: 'o1', networkTransactionId: 'tx1',
        grossAmountUsd: 100, commissionUsd: 25.5, status: 'approved',
        attributedAt: 1700000000, // 2023-11-14T22:13:20.000Z
      },
    ]);
    const resp = await GET(buildRequest());
    const body = await resp.text();
    const lines = body.split('\n');
    expect(lines.length).toBe(2);
    expect(lines[1]).toContain('c1,l1,o1,tx1,100.00,25.50,approved,2023-11-14T22:13:20.000Z');
  });

  it('caps limit at 1000', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue({ id: 'u1' } as Awaited<ReturnType<typeof getCurrentUser>>);
    vi.mocked(getRecentConversions).mockResolvedValue([]);
    await GET(buildRequest({ limit: '99999' }));
    expect(getRecentConversions).toHaveBeenCalledWith('u1', 'u1', 1000, 0);
  });

  it('escapes commas and quotes in offer_id', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue({ id: 'u1' } as Awaited<ReturnType<typeof getCurrentUser>>);
    vi.mocked(getRecentConversions).mockResolvedValue([
      {
        conversionId: 'c1', linkId: 'l1',
        offerId: 'name, with "quotes"',
        networkTransactionId: 'tx1',
        grossAmountUsd: 0, commissionUsd: 0, status: 'pending', attributedAt: 1700000000,
      },
    ]);
    const resp = await GET(buildRequest());
    const body = await resp.text();
    expect(body).toContain('"name, with ""quotes"""');
  });
});
