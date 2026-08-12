/**
 * /api/admin/tenant-lookup — admin auth + tenantId required + delegation.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';

vi.mock('@/seed/auth/require-admin', () => ({
  requireAdmin: vi.fn(),
}));

vi.mock('@/land/observability/tenant-summary', () => ({
  getTenantSummary: vi.fn(),
}));

import { requireAdmin } from '@/seed/auth/require-admin';
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
    vi.mocked(requireAdmin).mockResolvedValue(
      NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
    );
    const resp = await GET(buildRequest({ tenantId: 't' }));
    expect(resp.status).toBe(401);
  });

  it('returns 403 for non-admin', async () => {
    vi.mocked(requireAdmin).mockResolvedValue(
      NextResponse.json({ error: 'Forbidden: admin role required' }, { status: 403 }),
    );
    const resp = await GET(buildRequest({ tenantId: 't' }));
    expect(resp.status).toBe(403);
  });

  it('returns 400 when tenantId missing', async () => {
    vi.mocked(requireAdmin).mockResolvedValue(
      { user: { id: 'u1', role: 'admin' } } as any,
    );
    const resp = await GET(buildRequest());
    expect(resp.status).toBe(400);
  });

  it('returns 404 when summary is null', async () => {
    vi.mocked(requireAdmin).mockResolvedValue(
      { user: { id: 'u1', role: 'admin' } } as any,
    );
    vi.mocked(getTenantSummary).mockResolvedValue(null);
    const resp = await GET(buildRequest({ tenantId: 'missing' }));
    expect(resp.status).toBe(404);
  });

  it('returns 200 with summary on hit', async () => {
    vi.mocked(requireAdmin).mockResolvedValue(
      { user: { id: 'u1', role: 'admin' } } as any,
    );
    vi.mocked(getTenantSummary).mockResolvedValue(STUB_SUMMARY);
    const resp = await GET(buildRequest({ tenantId: 't' }));
    expect(resp.status).toBe(200);
    const body = await resp.json() as typeof STUB_SUMMARY;
    expect(body.user.email).toBe('a@x.com');
  });

  it('returns 500 if primitive throws', async () => {
    vi.mocked(requireAdmin).mockResolvedValue(
      { user: { id: 'u1', role: 'admin' } } as any,
    );
    vi.mocked(getTenantSummary).mockRejectedValue(new Error('boom'));
    const resp = await GET(buildRequest({ tenantId: 't' }));
    expect(resp.status).toBe(500);
  });
});
