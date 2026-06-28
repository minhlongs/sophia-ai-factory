/**
 * /api/admin/storage — admin auth + delegation + 500 fallback.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/seed/auth/better-auth-session', () => ({
  getCurrentUser: vi.fn(),
}));

vi.mock('@/land/observability/storage-usage-stats', () => ({
  getStorageSnapshot: vi.fn(),
}));

import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { getStorageSnapshot } from '@/land/observability/storage-usage-stats';
import { GET } from '../route';

function buildRequest(query: Record<string, string> = {}): NextRequest {
  const url = new URL('http://localhost/api/admin/storage');
  for (const [k, v] of Object.entries(query)) url.searchParams.set(k, v);
  return new NextRequest(url);
}

const STUB = {
  global: { tenantCount: 5, totalBytes: 1024, totalVideos: 10, staleTenantCount: 0 },
  topTenants: [],
};

describe('GET /api/admin/storage', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 401 anon', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(null);
    const resp = await GET(buildRequest());
    expect(resp.status).toBe(401);
  });

  it('returns 403 for non-admin', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue({ id: 'u1', role: 'user' } as Awaited<ReturnType<typeof getCurrentUser>>);
    const resp = await GET(buildRequest());
    expect(resp.status).toBe(403);
  });

  it('returns 400 for invalid limit', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue({ id: 'u1', role: 'admin' } as Awaited<ReturnType<typeof getCurrentUser>>);
    const resp = await GET(buildRequest({ limit: '0' }));
    expect(resp.status).toBe(400);
  });

  it('admin sees snapshot', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue({ id: 'u1', role: 'admin' } as Awaited<ReturnType<typeof getCurrentUser>>);
    vi.mocked(getStorageSnapshot).mockResolvedValue(STUB);
    const resp = await GET(buildRequest());
    expect(resp.status).toBe(200);
    const body = await resp.json() as typeof STUB;
    expect(body.global.tenantCount).toBe(5);
  });

  it('passes custom limit', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue({ id: 'u1', role: 'admin' } as Awaited<ReturnType<typeof getCurrentUser>>);
    vi.mocked(getStorageSnapshot).mockResolvedValue(STUB);
    await GET(buildRequest({ limit: '50' }));
    expect(getStorageSnapshot).toHaveBeenCalledWith(50);
  });

  it('returns 500 if primitive throws', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue({ id: 'u1', role: 'admin' } as Awaited<ReturnType<typeof getCurrentUser>>);
    vi.mocked(getStorageSnapshot).mockRejectedValue(new Error('boom'));
    const resp = await GET(buildRequest());
    expect(resp.status).toBe(500);
  });
});
