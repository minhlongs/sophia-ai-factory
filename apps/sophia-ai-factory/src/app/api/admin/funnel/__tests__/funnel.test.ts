/**
 * /api/admin/funnel — admin auth + window resolution + delegation.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/seed/auth/better-auth-session', () => ({
  getCurrentUserFromHeaders: vi.fn(),
}));
vi.mock('@/seed/auth/is-user-admin', () => ({
  isUserAdmin: vi.fn(),
}));

vi.mock('@/land/analytics/funnel-stats', () => ({
  getActivationFunnel: vi.fn(),
}));

import { getCurrentUserFromHeaders } from '@/seed/auth/better-auth-session';
import { isUserAdmin } from '@/seed/auth/is-user-admin';
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

describe('GET /api/admin/funnel', () => {
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

  it('admin sees funnel JSON', async () => {
    vi.mocked(getCurrentUserFromHeaders).mockResolvedValue({ id: 'u1', role: 'admin' } as Awaited<ReturnType<typeof getCurrentUserFromHeaders>>);
    vi.mocked(isUserAdmin).mockResolvedValue(true);
    vi.mocked(getActivationFunnel).mockResolvedValue(STUB_FUNNEL);
    const resp = await GET(buildRequest());
    expect(resp.status).toBe(200);
    const body = await resp.json() as typeof STUB_FUNNEL;
    expect(body.signups).toBe(10);
    expect(body.firstConversion).toBe(1);
  });

  it('passes custom from/to', async () => {
    vi.mocked(getCurrentUserFromHeaders).mockResolvedValue({ id: 'u1', role: 'admin' } as Awaited<ReturnType<typeof getCurrentUserFromHeaders>>);
    vi.mocked(isUserAdmin).mockResolvedValue(true);
    vi.mocked(getActivationFunnel).mockResolvedValue(STUB_FUNNEL);
    await GET(buildRequest({ from: '500', to: '1500' }));
    expect(getActivationFunnel).toHaveBeenCalledWith(500, 1500);
  });

  it('returns 500 if primitive throws', async () => {
    vi.mocked(getCurrentUserFromHeaders).mockResolvedValue({ id: 'u1', role: 'admin' } as Awaited<ReturnType<typeof getCurrentUserFromHeaders>>);
    vi.mocked(isUserAdmin).mockResolvedValue(true);
    vi.mocked(getActivationFunnel).mockRejectedValue(new Error('boom'));
    const resp = await GET(buildRequest());
    expect(resp.status).toBe(500);
  });
});
