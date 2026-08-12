/**
 * /api/admin/crons — admin auth + delegation + 500 on error.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';

vi.mock('@/seed/auth/require-admin', () => ({ requireAdmin: vi.fn() }));

vi.mock('@/land/observability/cron-run-stats', () => ({
  listCronRunSummaries: vi.fn(),
}));

import { GET } from '../route';
import { requireAdmin } from '@/seed/auth/require-admin';
import { listCronRunSummaries } from '@/land/observability/cron-run-stats';

const mockReq = new NextRequest('http://localhost:3000/api/admin/crons');

beforeEach(() => vi.clearAllMocks());

describe('GET /api/admin/crons', () => {
  it('returns 401 if requireAdmin rejects with 401', async () => {
    vi.mocked(requireAdmin).mockResolvedValue(
      NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    );
    const resp = await GET(mockReq);
    expect(resp.status).toBe(401);
  });

  it('returns 403 if requireAdmin rejects with 403', async () => {
    vi.mocked(requireAdmin).mockResolvedValue(
      NextResponse.json({ error: 'Forbidden: admin role required' }, { status: 403 })
    );
    const resp = await GET(mockReq);
    expect(resp.status).toBe(403);
  });

  it('returns 200 with cron summaries for admin user', async () => {
    vi.mocked(requireAdmin).mockResolvedValue({ user: { id: 'u1', role: 'admin' } } as never);
    vi.mocked(listCronRunSummaries).mockResolvedValue([
      {
        cronName: 'email-drip',
        lastRunAt: 1785628800,
        lastStatus: 'success' as const,
        lastError: null, runCount: 5, ageSec: 100,
      },
    ]);
    const resp = await GET(mockReq);
    expect(resp.status).toBe(200);
    const body = await resp.json() as { count: number; crons: Array<{ cronName: string }> };
    expect(body.count).toBe(1);
    expect(body.crons[0].cronName).toBe('email-drip');
  });

  it('returns 500 if primitive throws', async () => {
    vi.mocked(requireAdmin).mockResolvedValue({ user: { id: 'u1', role: 'admin' } } as never);
    vi.mocked(listCronRunSummaries).mockRejectedValue(new Error('boom'));
    const resp = await GET(mockReq);
    expect(resp.status).toBe(500);
  });
});
