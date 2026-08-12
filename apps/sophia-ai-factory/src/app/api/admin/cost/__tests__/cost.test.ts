/**
 * /api/admin/cost — admin auth + query parsing + delegation.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';

vi.mock('@/seed/auth/require-admin', () => ({ requireAdmin: vi.fn() }));

vi.mock('@/land/observability/cost-snapshot', () => ({
  getCostSnapshot: vi.fn(),
}));

import { requireAdmin } from '@/seed/auth/require-admin';
import { getCostSnapshot } from '@/land/observability/cost-snapshot';
import { GET } from '../route';

function buildRequest(query: Record<string, string> = {}): NextRequest {
  const url = new URL('http://localhost/api/admin/cost');
  for (const [k, v] of Object.entries(query)) url.searchParams.set(k, v);
  return new NextRequest(url);
}

const STUB = {
  fromTs: 0,
  toTs: 100,
  global: { totalCostUsd: 12.5, totalUnits: 100, lineCount: 5, jobCount: 2 },
  byStage: [],
  byProvider: [],
  topTenants: [],
  monthlyProjectionUsd: 375,
};

describe('GET /api/admin/cost', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 401 anon', async () => {
    vi.mocked(requireAdmin).mockResolvedValue(NextResponse.json({ error: 'Unauthorized' }, { status: 401 }));
    const resp = await GET(buildRequest());
    expect(resp.status).toBe(401);
  });

  it('returns 403 for non-admin', async () => {
    vi.mocked(requireAdmin).mockResolvedValue(NextResponse.json({ error: 'Forbidden: admin role required' }, { status: 403 }));
    const resp = await GET(buildRequest());
    expect(resp.status).toBe(403);
  });

  it('returns 400 when from > to', async () => {
    vi.mocked(requireAdmin).mockResolvedValue({ user: { id: 'u1', role: 'admin' } } as any);
    const resp = await GET(buildRequest({ from: '2000', to: '1000' }));
    expect(resp.status).toBe(400);
  });

  it('returns 400 for limit < 1', async () => {
    vi.mocked(requireAdmin).mockResolvedValue({ user: { id: 'u1', role: 'admin' } } as any);
    const resp = await GET(buildRequest({ limit: '0' }));
    expect(resp.status).toBe(400);
  });

  it('returns 400 for non-numeric from', async () => {
    vi.mocked(requireAdmin).mockResolvedValue({ user: { id: 'u1', role: 'admin' } } as any);
    const resp = await GET(buildRequest({ from: 'abc' }));
    expect(resp.status).toBe(400);
  });

  it('admin gets snapshot (200)', async () => {
    vi.mocked(requireAdmin).mockResolvedValue({ user: { id: 'u1', role: 'admin' } } as any);
    vi.mocked(getCostSnapshot).mockResolvedValue(STUB);
    const resp = await GET(buildRequest());
    expect(resp.status).toBe(200);
    const body = await resp.json();
    expect(body).toEqual(STUB);
  });

  it('passes parsed numeric params', async () => {
    vi.mocked(requireAdmin).mockResolvedValue({ user: { id: 'u1', role: 'admin' } } as any);
    vi.mocked(getCostSnapshot).mockResolvedValue(STUB);
    await GET(buildRequest({ from: '100', to: '200', limit: '50' }));
    expect(getCostSnapshot).toHaveBeenCalledWith(100, 200, 50);
  });

  it('returns 500 if primitive throws', async () => {
    vi.mocked(requireAdmin).mockResolvedValue({ user: { id: 'u1', role: 'admin' } } as any);
    vi.mocked(getCostSnapshot).mockRejectedValue(new Error('boom'));
    const resp = await GET(buildRequest());
    expect(resp.status).toBe(500);
  });
});