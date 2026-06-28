/**
 * /api/admin/webhook-deliveries — admin auth + delegation + 500 fallback.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/seed/auth/better-auth-session', () => ({
  getCurrentUser: vi.fn(),
}));

vi.mock('@/land/observability/webhook-delivery-stats', () => ({
  getWebhookDeliverySnapshot: vi.fn(),
}));

import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { getWebhookDeliverySnapshot } from '@/land/observability/webhook-delivery-stats';
import { GET } from '../route';

const STUB = {
  endpoints: { totalEndpoints: 5, activeEndpoints: 4, unhealthyEndpoints: 1 },
  attemptTotals: [{ status: 'success' as const, count: 100 }],
  recentFailures: [],
  recentSuccesses: [],
};

describe('GET /api/admin/webhook-deliveries', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 401 anon', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(null);
    const resp = await GET();
    expect(resp.status).toBe(401);
  });

  it('returns 403 for non-admin', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue({ id: 'u1', role: 'user' } as Awaited<ReturnType<typeof getCurrentUser>>);
    const resp = await GET();
    expect(resp.status).toBe(403);
  });

  it('admin sees snapshot', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue({ id: 'u1', role: 'admin' } as Awaited<ReturnType<typeof getCurrentUser>>);
    vi.mocked(getWebhookDeliverySnapshot).mockResolvedValue(STUB);
    const resp = await GET();
    expect(resp.status).toBe(200);
    const body = await resp.json() as typeof STUB;
    expect(body.endpoints.totalEndpoints).toBe(5);
  });

  it('returns 500 if primitive throws', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue({ id: 'u1', role: 'admin' } as Awaited<ReturnType<typeof getCurrentUser>>);
    vi.mocked(getWebhookDeliverySnapshot).mockRejectedValue(new Error('boom'));
    const resp = await GET();
    expect(resp.status).toBe(500);
  });
});
