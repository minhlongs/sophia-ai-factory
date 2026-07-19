/**
 * /api/admin/webhook-deliveries — admin auth + delegation + 500 fallback.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/seed/auth/better-auth-session', () => ({
  getCurrentUserFromHeaders: vi.fn(),
}));

vi.mock('@/seed/auth/is-user-admin', () => ({
  isUserAdmin: vi.fn(),
}));

vi.mock('@/land/observability/webhook-delivery-stats', () => ({
  getWebhookDeliverySnapshot: vi.fn(),
}));

import { getCurrentUserFromHeaders } from '@/seed/auth/better-auth-session';
import { isUserAdmin } from '@/seed/auth/is-user-admin';
import { getWebhookDeliverySnapshot } from '@/land/observability/webhook-delivery-stats';
import { GET } from '../route';

type MockUser = Awaited<ReturnType<typeof getCurrentUserFromHeaders>>;

const STUB = {
  endpoints: { totalEndpoints: 5, activeEndpoints: 4, unhealthyEndpoints: 1 },
  attemptTotals: [{ status: 'success' as const, count: 100 }],
  recentFailures: [],
  recentSuccesses: [],
};

const mockReq = new NextRequest('http://localhost/api/admin/webhook-deliveries');

describe('GET /api/admin/webhook-deliveries', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 401 anon', async () => {
    vi.mocked(getCurrentUserFromHeaders).mockResolvedValue(null);
    const resp = await GET(mockReq);
    expect(resp.status).toBe(401);
  });

  it('returns 403 for non-admin', async () => {
    vi.mocked(getCurrentUserFromHeaders).mockResolvedValue({ id: 'u1', role: 'user' } as MockUser);
    vi.mocked(isUserAdmin).mockResolvedValue(false);
    const resp = await GET(mockReq);
    expect(resp.status).toBe(403);
  });

  it('admin sees snapshot', async () => {
    vi.mocked(getCurrentUserFromHeaders).mockResolvedValue({ id: 'u1', role: 'admin' } as MockUser);
    vi.mocked(isUserAdmin).mockResolvedValue(true);
    vi.mocked(getWebhookDeliverySnapshot).mockResolvedValue(STUB);
    const resp = await GET(mockReq);
    expect(resp.status).toBe(200);
    const body = await resp.json() as typeof STUB;
    expect(body.endpoints.totalEndpoints).toBe(5);
  });

  it('returns 500 if primitive throws', async () => {
    vi.mocked(getCurrentUserFromHeaders).mockResolvedValue({ id: 'u1', role: 'admin' } as MockUser);
    vi.mocked(isUserAdmin).mockResolvedValue(true);
    vi.mocked(getWebhookDeliverySnapshot).mockRejectedValue(new Error('boom'));
    const resp = await GET(mockReq);
    expect(resp.status).toBe(500);
  });
});
