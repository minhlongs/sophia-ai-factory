/**
 * /api/admin/funnel — admin auth + window resolution + delegation.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';

vi.mock('@/seed/auth/require-admin', () => ({
  requireAdmin: vi.fn(),
}));

vi.mock('@/land/analytics/funnel-stats', () => ({
  getActivationFunnel: vi.fn(),
}));

import { requireAdmin } from '@/seed/auth/require-admin';
import { getActivationFunnel } from '@/land/analytics/funnel-stats';
import { GET } from '../route';

function buildRequest(query: Record<string, string> = {}): NextRequest {
  const url = new URL('http://localhost/api/admin/funnel');
  for (const [k, v] of Object.entries(query)) url.searchParams.set(k, v);
  return new NextRequest(url);
}

const STUB_FUNNEL = {
  fromTs: 0, toTs: 100,
  signups: 10, firstLogin: 5, firstVideo: 2, firstConversion: 1,
  conversions: { signupToLogin: 0.5, loginToVideo: 0.4, videoToConversion: 0.5 },
};

// Test-only cast: requireAdmin return type is a union; narrow to the admin-user branch.
const ADMIN_AUTH = { user: { id: 'u1', role: 'admin' } } as any;

describe('GET /api/admin/funnel', () => {
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
    vi.mocked(requireAdmin).mockResolvedValue(ADMIN_AUTH);
    const resp = await GET(buildRequest({ from: '2000', to: '1000' }));
    expect(resp.status).toBe(400);
  });

  it('admin sees funnel JSON', async () => {
    vi.mocked(requireAdmin).mockResolvedValue(ADMIN_AUTH);
    vi.mocked(getActivationFunnel).mockResolvedValue(STUB_FUNNEL);
    const resp = await GET(buildRequest());
    expect(resp.status).toBe(200);
    const body = await resp.json() as typeof STUB_FUNNEL;
    expect(body.signups).toBe(10);
    expect(body.firstConversion).toBe(1);
  });

  it('passes custom from/to', async () => {
    vi.mocked(requireAdmin).mockResolvedValue(ADMIN_AUTH);
    vi.mocked(getActivationFunnel).mockResolvedValue(STUB_FUNNEL);
    await GET(buildRequest({ from: '500', to: '1500' }));
    expect(getActivationFunnel).toHaveBeenCalledWith(500, 1500);
  });

  it('returns 500 if primitive throws', async () => {
    vi.mocked(requireAdmin).mockResolvedValue(ADMIN_AUTH);
    vi.mocked(getActivationFunnel).mockRejectedValue(new Error('boom'));
    const resp = await GET(buildRequest());
    expect(resp.status).toBe(500);
  });
});
