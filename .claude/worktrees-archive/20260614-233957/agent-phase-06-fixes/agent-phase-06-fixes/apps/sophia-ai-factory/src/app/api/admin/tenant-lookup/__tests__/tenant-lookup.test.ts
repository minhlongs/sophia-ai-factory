/**
 * /api/admin/tenant-lookup — admin auth + tenantId required + delegation.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/seed/auth/better-auth-session', () => ({
  getCurrentUser: vi.fn(),
}));

vi.mock('@/land/observability/tenant-summary', () => ({
  getTenantSummary: vi.fn(),
}));

import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { getTenantSummary } from '@/land/observability/tenant-summary';
import { GET } from '../route';

function buildRequest(query: Record<string, string> = {}): NextRequest {
  const url = new URL('http://localhost/api/admin/tenant-lookup');
  for (const [k, v] of Object.entries(query)) url.searchParams.set(k, v);
  return new NextRequest(url);
}

const STUB_SUMMARY = {
  user: { id: 't', email: 'a@x.com', name: 'Alex', role: 'user', createdAt: '2026-01-01' },
  storage: null,
  apiKeys: { active: 0, total: 0 },
  videoJobCount: 0,
  referralCodeCount: 0,
  auditLogCount: 0,
  recentAudit: [],
};

describe('GET /api/admin/tenant-lookup', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 401 anon', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(null);
    const resp = await GET(buildRequest({ tenantId: 't' }));
    expect(resp.status).toBe(401);
  });

  it('returns 403 for non-admin', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue({ id: 'u', role: 'user' } as Awaited<ReturnType<typeof getCurrentUser>>);
    const resp = await GET(buildRequest({ tenantId: 't' }));
    expect(resp.status).toBe(403);
  });

  it('returns 400 when tenantId missing', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue({ id: 'u', role: 'admin' } as Awaited<ReturnType<typeof getCurrentUser>>);
    const resp = await GET(buildRequest());
    expect(resp.status).toBe(400);
  });

  it('returns 404 when summary is null', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue({ id: 'u', role: 'admin' } as Awaited<ReturnType<typeof getCurrentUser>>);
    vi.mocked(getTenantSummary).mockResolvedValue(null);
    const resp = await GET(buildRequest({ tenantId: 'missing' }));
    expect(resp.status).toBe(404);
  });

  it('returns 200 with summary on hit', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue({ id: 'u', role: 'admin' } as Awaited<ReturnType<typeof getCurrentUser>>);
    vi.mocked(getTenantSummary).mockResolvedValue(STUB_SUMMARY);
    const resp = await GET(buildRequest({ tenantId: 't' }));
    expect(resp.status).toBe(200);
    const body = await resp.json() as typeof STUB_SUMMARY;
    expect(body.user.email).toBe('a@x.com');
  });

  it('returns 500 if primitive throws', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue({ id: 'u', role: 'admin' } as Awaited<ReturnType<typeof getCurrentUser>>);
    vi.mocked(getTenantSummary).mockRejectedValue(new Error('boom'));
    const resp = await GET(buildRequest({ tenantId: 't' }));
    expect(resp.status).toBe(500);
  });
});
