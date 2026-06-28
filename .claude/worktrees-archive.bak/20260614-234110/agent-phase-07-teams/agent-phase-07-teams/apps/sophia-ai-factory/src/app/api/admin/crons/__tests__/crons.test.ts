/**
 * /api/admin/crons — admin auth + delegation + 500 on error.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/seed/auth/better-auth-session', () => ({
  getCurrentUser: vi.fn(),
}));

vi.mock('@/land/observability/cron-run-stats', () => ({
  listCronRunSummaries: vi.fn(),
}));

import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { listCronRunSummaries } from '@/land/observability/cron-run-stats';
import { GET } from '../route';

describe('GET /api/admin/crons', () => {
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

  it('admin sees crons + count', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue({ id: 'u1', role: 'admin' } as Awaited<ReturnType<typeof getCurrentUser>>);
    vi.mocked(listCronRunSummaries).mockResolvedValue([
      {
        cronName: 'email-drip', lastRunAt: 1700000000, lastStatus: 'success',
        lastError: null, runCount: 5, ageSec: 100,
      },
    ]);
    const resp = await GET();
    expect(resp.status).toBe(200);
    const body = await resp.json() as { count: number; crons: Array<{ cronName: string }> };
    expect(body.count).toBe(1);
    expect(body.crons[0].cronName).toBe('email-drip');
  });

  it('returns 500 if primitive throws', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue({ id: 'u1', role: 'admin' } as Awaited<ReturnType<typeof getCurrentUser>>);
    vi.mocked(listCronRunSummaries).mockRejectedValue(new Error('boom'));
    const resp = await GET();
    expect(resp.status).toBe(500);
  });
});
