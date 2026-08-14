/**
 * /api/admin/email-outbox — admin auth + delegation + 500 fallback.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';

vi.mock('@/seed/auth/require-admin', () => ({
  requireAdmin: vi.fn(),
}));

vi.mock('@/land/observability/email-outbox-stats', () => ({
  getEmailOutboxSnapshot: vi.fn(),
}));

import { requireAdmin } from '@/seed/auth/require-admin';
import { getEmailOutboxSnapshot } from '@/land/observability/email-outbox-stats';
import { GET } from '../route';

const STUB = {
  totals: [{ status: 'sent' as const, count: 10 }],
  pendingDue: 0,
  pendingFuture: 0,
  recentFailures: [],
  recentSends: [],
};

const mockReq = new NextRequest('http://localhost/api/admin/email-outbox');

describe('GET /api/admin/email-outbox', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 401 anon', async () => {
    vi.mocked(requireAdmin).mockResolvedValue(
      NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
    );
    const resp = await GET(mockReq);
    expect(resp.status).toBe(401);
  });

  it('returns 403 for non-admin', async () => {
    vi.mocked(requireAdmin).mockResolvedValue(
      NextResponse.json({ error: 'Forbidden: admin role required' }, { status: 403 }),
    );
    const resp = await GET(mockReq);
    expect(resp.status).toBe(403);
  });

  it('admin sees outbox snapshot', async () => {
    vi.mocked(requireAdmin).mockResolvedValue({ user: { id: 'u1', role: 'admin' } } as any);
    vi.mocked(getEmailOutboxSnapshot).mockResolvedValue(STUB);
    const resp = await GET(mockReq);
    expect(resp.status).toBe(200);
    const body = await resp.json() as typeof STUB;
    expect(body.totals[0].count).toBe(10);
  });

  it('returns 500 if primitive throws', async () => {
    vi.mocked(requireAdmin).mockResolvedValue({ user: { id: 'u1', role: 'admin' } } as any);
    vi.mocked(getEmailOutboxSnapshot).mockRejectedValue(new Error('boom'));
    const resp = await GET(mockReq);
    expect(resp.status).toBe(500);
  });
});
