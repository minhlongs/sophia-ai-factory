/**
 * /api/admin/storage — admin auth + delegation + 500 fallback.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/seed/auth/better-auth-session', () => ({
  getCurrentUserFromHeaders: vi.fn(),
}));
vi.mock('@/seed/auth/is-user-admin', () => ({
  isUserAdmin: vi.fn(),
}));

vi.mock('@/land/observability/storage-usage-stats', () => ({
  getStorageSnapshot: vi.fn(),
}));

import { getCurrentUserFromHeaders } from '@/seed/auth/better-auth-session';
import { isUserAdmin } from '@/seed/auth/is-user-admin';
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

  it('admin sees snapshot', async () => {
    vi.mocked(getCurrentUserFromHeaders).mockResolvedValue({ id: 'u1', role: 'admin' } as Awaited<ReturnType<typeof getCurrentUserFromHeaders>>);
    vi.mocked(isUserAdmin).mockResolvedValue(true);
    vi.mocked(getStorageSnapshot).mockResolvedValue(STUB);
    const resp = await GET(buildRequest());
    expect(resp.status).toBe(200);
    const body = await resp.json() as typeof STUB;
    expect(body.global.tenantCount).toBe(5);
  });

  it('passes custom limit', async () => {
    vi.mocked(getCurrentUserFromHeaders).mockResolvedValue({ id: 'u1', role: 'admin' } as Awaited<ReturnType<typeof getCurrentUserFromHeaders>>);
    vi.mocked(isUserAdmin).mockResolvedValue(true);
    vi.mocked(getStorageSnapshot).mockResolvedValue(STUB);
    await GET(buildRequest({ limit: '50' }));
    expect(getStorageSnapshot).toHaveBeenCalledWith(50);
  });

  it('returns 500 if primitive throws', async () => {
    vi.mocked(getCurrentUserFromHeaders).mockResolvedValue({ id: 'u1', role: 'admin' } as Awaited<ReturnType<typeof getCurrentUserFromHeaders>>);
    vi.mocked(isUserAdmin).mockResolvedValue(true);
    vi.mocked(getStorageSnapshot).mockRejectedValue(new Error('boom'));
    const resp = await GET(buildRequest());
    expect(resp.status).toBe(500);
  });
});
