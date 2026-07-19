/**
 * /api/admin/audit-log — admin auth + query parsing + delegation.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/seed/auth/better-auth-session', () => ({
  getCurrentUserFromHeaders: vi.fn(),
}));
vi.mock('@/seed/auth/is-user-admin', () => ({
  isUserAdmin: vi.fn(),
}));

vi.mock('@/land/observability/audit-log-stats', () => ({
  searchAuditLog: vi.fn(),
}));

import { getCurrentUserFromHeaders } from '@/seed/auth/better-auth-session';
import { isUserAdmin } from '@/seed/auth/is-user-admin';
import { searchAuditLog } from '@/land/observability/audit-log-stats';
import { GET } from '../route';

function buildRequest(query: Record<string, string> = {}): NextRequest {
  const url = new URL('http://localhost/api/admin/audit-log');
  for (const [k, v] of Object.entries(query)) url.searchParams.set(k, v);
  return new NextRequest(url);
}

const STUB_ROW = {
  id: 1, tenantId: 't', actor: 'a@x.com', action: 'login',
  resource: null, metadata: null, ts: 1700000000,
};

describe('GET /api/admin/audit-log', () => {
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

  it('returns 400 when from > to', async () => {
    vi.mocked(getCurrentUserFromHeaders).mockResolvedValue({ id: 'u1', role: 'admin' } as Awaited<ReturnType<typeof getCurrentUserFromHeaders>>);
    vi.mocked(isUserAdmin).mockResolvedValue(true);
    const resp = await GET(buildRequest({ from: '2000', to: '1000' }));
    expect(resp.status).toBe(400);
  });

  it('returns 400 for limit < 1', async () => {
    vi.mocked(getCurrentUserFromHeaders).mockResolvedValue({ id: 'u1', role: 'admin' } as Awaited<ReturnType<typeof getCurrentUserFromHeaders>>);
    vi.mocked(isUserAdmin).mockResolvedValue(true);
    const resp = await GET(buildRequest({ limit: '0' }));
    expect(resp.status).toBe(400);
  });

  it('returns 400 for negative offset', async () => {
    vi.mocked(getCurrentUserFromHeaders).mockResolvedValue({ id: 'u1', role: 'admin' } as Awaited<ReturnType<typeof getCurrentUserFromHeaders>>);
    vi.mocked(isUserAdmin).mockResolvedValue(true);
    const resp = await GET(buildRequest({ offset: '-1' }));
    expect(resp.status).toBe(400);
  });

  it('admin sees rows + filters echoed', async () => {
    vi.mocked(getCurrentUserFromHeaders).mockResolvedValue({ id: 'u1', role: 'admin' } as Awaited<ReturnType<typeof getCurrentUserFromHeaders>>);
    vi.mocked(isUserAdmin).mockResolvedValue(true);
    vi.mocked(searchAuditLog).mockResolvedValue([STUB_ROW]);
    const resp = await GET(buildRequest({ tenantId: 't1', action: 'login' }));
    expect(resp.status).toBe(200);
    const body = await resp.json() as { count: number; filters: { tenantId: string | null } };
    expect(body.count).toBe(1);
    expect(body.filters.tenantId).toBe('t1');
  });

  it('passes parsed numeric filters', async () => {
    vi.mocked(getCurrentUserFromHeaders).mockResolvedValue({ id: 'u1', role: 'admin' } as Awaited<ReturnType<typeof getCurrentUserFromHeaders>>);
    vi.mocked(isUserAdmin).mockResolvedValue(true);
    vi.mocked(searchAuditLog).mockResolvedValue([]);
    await GET(buildRequest({ from: '100', to: '200', limit: '50', offset: '10' }));
    expect(searchAuditLog).toHaveBeenCalledWith({
      tenantId: undefined,
      action: undefined,
      fromTs: 100,
      toTs: 200,
      limit: 50,
      offset: 10,
    });
  });

  it('returns 500 if primitive throws', async () => {
    vi.mocked(getCurrentUserFromHeaders).mockResolvedValue({ id: 'u1', role: 'admin' } as Awaited<ReturnType<typeof getCurrentUserFromHeaders>>);
    vi.mocked(isUserAdmin).mockResolvedValue(true);
    vi.mocked(searchAuditLog).mockRejectedValue(new Error('boom'));
    const resp = await GET(buildRequest());
    expect(resp.status).toBe(500);
  });
});
