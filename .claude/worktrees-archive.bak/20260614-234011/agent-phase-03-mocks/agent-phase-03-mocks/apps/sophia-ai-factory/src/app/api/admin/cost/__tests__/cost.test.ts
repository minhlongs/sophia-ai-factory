/**
 * /api/admin/cost — admin auth + query parsing + delegation.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/seed/auth/better-auth-session', () => ({
  getCurrentUser: vi.fn(),
}));

vi.mock('@/land/observability/cost-snapshot', () => ({
  getCostSnapshot: vi.fn(),
}));

import { getCurrentUser } from '@/seed/auth/better-auth-session';
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
  monthlyProjectionUsd: 0,
};

describe('GET /api/admin/cost', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 401 anon', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(null);
    const resp = await GET(buildRequest());
    expect(resp.status).toBe(401);
  });

  it('returns 403 for non-admin', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue({ id: 'u', role: 'user' } as Awaited<ReturnType<typeof getCurrentUser>>);
    const resp = await GET(buildRequest());
    expect(resp.status).toBe(403);
  });

  it('returns 400 when from > to', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue({ id: 'u', role: 'admin' } as Awaited<ReturnType<typeof getCurrentUser>>);
    const resp = await GET(buildRequest({ from: '2000', to: '1000' }));
    expect(resp.status).toBe(400);
  });

  it('returns 400 for limit < 1', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue({ id: 'u', role: 'admin' } as Awaited<ReturnType<typeof getCurrentUser>>);
    const resp = await GET(buildRequest({ limit: '0' }));
    expect(resp.status).toBe(400);
  });

  it('admin sees snapshot', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue({ id: 'u', role: 'admin' } as Awaited<ReturnType<typeof getCurrentUser>>);
    vi.mocked(getCostSnapshot).mockResolvedValue(STUB);
    const resp = await GET(buildRequest());
    expect(resp.status).toBe(200);
    const body = await resp.json() as typeof STUB;
    expect(body.global.totalCostUsd).toBe(12.5);
  });

  it('passes parsed from/to/limit', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue({ id: 'u', role: 'admin' } as Awaited<ReturnType<typeof getCurrentUser>>);
    vi.mocked(getCostSnapshot).mockResolvedValue(STUB);
    await GET(buildRequest({ from: '100', to: '200', limit: '50' }));
    expect(getCostSnapshot).toHaveBeenCalledWith(100, 200, 50);
  });

  it('returns 500 if primitive throws', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue({ id: 'u', role: 'admin' } as Awaited<ReturnType<typeof getCurrentUser>>);
    vi.mocked(getCostSnapshot).mockRejectedValue(new Error('boom'));
    const resp = await GET(buildRequest());
    expect(resp.status).toBe(500);
  });
});
