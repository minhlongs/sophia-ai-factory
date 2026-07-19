/**
 * /api/admin/crons — admin auth + delegation + 500 on error.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/seed/auth/better-auth-session', () => ({
  getCurrentUserFromHeaders: vi.fn(),
}));

vi.mock('@/seed/auth/is-user-admin', () => ({
  isUserAdmin: vi.fn(),
}));

vi.mock('@/land/observability/cron-run-stats', () => ({
  listCronRunSummaries: vi.fn(),
}));

import { getCurrentUserFromHeaders } from '@/seed/auth/better-auth-session';
import { isUserAdmin } from '@/seed/auth/is-user-admin';
import { listCronRunSummaries } from '@/land/observability/cron-run-stats';
import { GET } from '../route';

type MockUser = Awaited<ReturnType<typeof getCurrentUserFromHeaders>>;
const mockReq = new NextRequest('http://localhost/api/admin/crons');

describe('GET /api/admin/crons', () => {
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

  it('admin sees crons + count', async () => {
    vi.mocked(getCurrentUserFromHeaders).mockResolvedValue({ id: 'u1', role: 'admin' } as MockUser);
    vi.mocked(isUserAdmin).mockResolvedValue(true);
    vi.mocked(listCronRunSummaries).mockResolvedValue([
      {
        cronName: 'email-drip', lastRunAt: 1700000000, lastStatus: 'success',
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
    vi.mocked(getCurrentUserFromHeaders).mockResolvedValue({ id: 'u1', role: 'admin' } as MockUser);
    vi.mocked(isUserAdmin).mockResolvedValue(true);
    vi.mocked(listCronRunSummaries).mockRejectedValue(new Error('boom'));
    const resp = await GET(mockReq);
    expect(resp.status).toBe(500);
  });
});
