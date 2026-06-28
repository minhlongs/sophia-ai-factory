/**
 * /api/admin/email-outbox — admin auth + delegation + 500 fallback.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/seed/auth/better-auth-session', () => ({
  getCurrentUser: vi.fn(),
}));

vi.mock('@/land/observability/email-outbox-stats', () => ({
  getEmailOutboxSnapshot: vi.fn(),
}));

import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { getEmailOutboxSnapshot } from '@/land/observability/email-outbox-stats';
import { GET } from '../route';

const STUB = {
  totals: [{ status: 'sent' as const, count: 10 }],
  pendingDue: 0,
  pendingFuture: 0,
  recentFailures: [],
  recentSends: [],
};

describe('GET /api/admin/email-outbox', () => {
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

  it('admin sees outbox snapshot', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue({ id: 'u1', role: 'admin' } as Awaited<ReturnType<typeof getCurrentUser>>);
    vi.mocked(getEmailOutboxSnapshot).mockResolvedValue(STUB);
    const resp = await GET();
    expect(resp.status).toBe(200);
    const body = await resp.json() as typeof STUB;
    expect(body.totals[0].count).toBe(10);
  });

  it('returns 500 if primitive throws', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue({ id: 'u1', role: 'admin' } as Awaited<ReturnType<typeof getCurrentUser>>);
    vi.mocked(getEmailOutboxSnapshot).mockRejectedValue(new Error('boom'));
    const resp = await GET();
    expect(resp.status).toBe(500);
  });
});
