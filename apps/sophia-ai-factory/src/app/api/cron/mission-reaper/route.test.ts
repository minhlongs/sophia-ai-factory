import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';

const mocks = vi.hoisted(() => ({ getD1Safe: vi.fn(), verifyCronAuth: vi.fn() }));
vi.mock('@/seed/db/client', () => ({ getD1Safe: mocks.getD1Safe }));
vi.mock('@/seed/security/cron-auth', () => ({ verifyCronAuth: mocks.verifyCronAuth }));
vi.mock('@/seed/utils/logger-utility', () => ({ logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn() } }));

import { GET } from './route';

function request() {
  return new NextRequest('http://localhost/api/cron/mission-reaper', {
    headers: { authorization: 'Bearer test-cron' },
  });
}

function dbWithOneStuckMission() {
  const first = vi.fn().mockResolvedValue({ outcome: 'compensated', restored: 5 });
  const claimBind = vi.fn(() => ({ first }));
  const all = vi.fn().mockResolvedValue({ results: [{ id: 'mission-1', user_id: 'user-1' }] });
  const prepare = vi.fn().mockReturnValueOnce({ bind: () => ({ all }) }).mockReturnValueOnce({ bind: claimBind });
  return { first, prepare, claimBind };
}

describe('GET /api/cron/mission-reaper', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.verifyCronAuth.mockReturnValue(null);
  });

  it('forwards cron auth rejection', async () => {
    mocks.verifyCronAuth.mockReturnValue(NextResponse.json({ error: 'Unauthorized' }, { status: 401 }));
    expect((await GET(request())).status).toBe(401);
    expect(mocks.getD1Safe).not.toHaveBeenCalled();
  });

  it('returns 503 when D1 binding is unavailable', async () => {
    mocks.getD1Safe.mockReturnValue(null);
    expect((await GET(request())).status).toBe(503);
  });

  it('returns 500 when the candidate query fails', async () => {
    mocks.getD1Safe.mockReturnValue({ prepare: vi.fn().mockImplementation(() => { throw new Error('query failed'); }) });
    expect((await GET(request())).status).toBe(500);
  });

  it('counts only credits the compensation claim actually restored', async () => {
    const db = dbWithOneStuckMission();
    mocks.getD1Safe.mockReturnValue(db);
    const res = await GET(request());
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, reaped: 1, credits_refunded: 5 });
    expect(db.claimBind).toHaveBeenCalledWith(expect.any(String), 'mission-1', 'user-1', 900);
  });

  it('returns a retryable error without counting an uncommitted claim', async () => {
    const db = dbWithOneStuckMission();
    db.first.mockRejectedValue(new Error('claim rolled back'));
    mocks.getD1Safe.mockReturnValue(db);
    const res = await GET(request());
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ ok: false, reaped: 0, credits_refunded: 0, failed: 1 });
  });

  it('does not count or refund a mission that was already resolved', async () => {
    const db = dbWithOneStuckMission();
    db.first.mockResolvedValue(null);
    mocks.getD1Safe.mockReturnValue(db);
    const res = await GET(request());
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, reaped: 0, credits_refunded: 0 });
  });
});
