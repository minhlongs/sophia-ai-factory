/**
 * /api/admin/api-key-usage — admin auth + query parsing + delegation.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/seed/auth/better-auth-session', () => ({
  getCurrentUser: vi.fn(),
}));

vi.mock('@/land/observability/api-key-usage-stats', () => ({
  getApiKeyUsageStats: vi.fn(),
}));

import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { getApiKeyUsageStats } from '@/land/observability/api-key-usage-stats';
import { GET } from '../route';

function buildRequest(query: Record<string, string> = {}): NextRequest {
  const url = new URL('http://localhost/api/admin/api-key-usage');
  for (const [k, v] of Object.entries(query)) url.searchParams.set(k, v);
  return new NextRequest(url);
}

const STUB_ROW = {
  apiKeyId: 'k', orgId: 'o', name: 'n', keyPrefix: 'sk_x',
  isActive: true, requestCount: 100, errorCount: 1, errorRate: 0.01,
  avgLatencyMs: 50, maxLatencyMs: 200,
  lastUsedAt: '2026-05-10T00:00:00Z', createdAt: '2026-04-01T00:00:00Z',
};

describe('GET /api/admin/api-key-usage', () => {
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

  it('admin sees rows + count', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue({ id: 'u', role: 'admin' } as Awaited<ReturnType<typeof getCurrentUser>>);
    vi.mocked(getApiKeyUsageStats).mockResolvedValue([STUB_ROW]);
    const resp = await GET(buildRequest());
    expect(resp.status).toBe(200);
    const body = await resp.json() as { count: number; rows: typeof STUB_ROW[] };
    expect(body.count).toBe(1);
    expect(body.rows[0].name).toBe('n');
  });

  it('passes parsed from/to/limit', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue({ id: 'u', role: 'admin' } as Awaited<ReturnType<typeof getCurrentUser>>);
    vi.mocked(getApiKeyUsageStats).mockResolvedValue([]);
    await GET(buildRequest({ from: '100', to: '200', limit: '25' }));
    expect(getApiKeyUsageStats).toHaveBeenCalledWith(100, 200, 25);
  });

  it('returns 500 if primitive throws', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue({ id: 'u', role: 'admin' } as Awaited<ReturnType<typeof getCurrentUser>>);
    vi.mocked(getApiKeyUsageStats).mockRejectedValue(new Error('boom'));
    const resp = await GET(buildRequest());
    expect(resp.status).toBe(500);
  });
});
