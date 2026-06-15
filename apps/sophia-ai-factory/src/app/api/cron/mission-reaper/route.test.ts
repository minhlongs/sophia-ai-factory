import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';

const mocks = vi.hoisted(() => ({
  getD1Safe: vi.fn(),
  verifyCronAuth: vi.fn(),
  addCredits: vi.fn(),
}));

vi.mock('@/seed/db/client', () => ({
  getD1: vi.fn(),
  getD1Safe: mocks.getD1Safe,
}));

vi.mock('@/seed/security/cron-auth', () => ({
  verifyCronAuth: mocks.verifyCronAuth,
}));

vi.mock('@/land/mcu/credits-repo', () => ({
  addCredits: mocks.addCredits,
}));

vi.mock('@/seed/utils/logger-utility', () => ({
  logger: {
    error: vi.fn(),
    info: vi.fn(),
  },
}));

import { GET } from './route';

function request() {
  return new NextRequest('http://localhost/api/cron/mission-reaper', {
    headers: { authorization: 'Bearer test-cron' },
  });
}

function dbWithOneStuckMission(updateChanges = 1) {
  const all = vi.fn().mockResolvedValue({
    results: [{
      id: 'mission-1',
      user_id: 'user-1',
      command: 'ai:write',
      status: 'running',
      credits_used: 5,
      created_at: 1,
    }],
  });
  const run = vi.fn().mockResolvedValue({ meta: { changes: updateChanges } });
  const bind = vi.fn()
    .mockReturnValueOnce({ all })
    .mockReturnValueOnce({ run });
  const prepare = vi.fn().mockReturnValue({ bind });
  return { prepare };
}

describe('GET /api/cron/mission-reaper', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.verifyCronAuth.mockReturnValue(null);
    mocks.addCredits.mockResolvedValue(true);
  });

  it('forwards cron auth rejection', async () => {
    mocks.verifyCronAuth.mockReturnValue(NextResponse.json({ error: 'Unauthorized' }, { status: 401 }));

    const res = await GET(request());

    expect(res.status).toBe(401);
    expect(mocks.getD1Safe).not.toHaveBeenCalled();
  });

  it('returns 503 when D1 binding is unavailable', async () => {
    mocks.getD1Safe.mockReturnValue(null);

    const res = await GET(request());

    expect(res.status).toBe(503);
  });

  it('marks stuck missions failed and refunds recorded credits', async () => {
    mocks.getD1Safe.mockReturnValue(dbWithOneStuckMission());

    const res = await GET(request());
    const body = await res.json() as { ok: boolean; reaped: number; credits_refunded: number };

    expect(res.status).toBe(200);
    expect(body).toEqual({ ok: true, reaped: 1, credits_refunded: 5 });
    expect(mocks.addCredits).toHaveBeenCalledWith(
      'user-1',
      5,
      'reaper_refund',
      { mission_id: 'mission-1', original_status: 'running' },
    );
  });

  it('does not count refunded credits when refund credit write fails', async () => {
    mocks.getD1Safe.mockReturnValue(dbWithOneStuckMission());
    mocks.addCredits.mockResolvedValue(false);

    const res = await GET(request());
    const body = await res.json() as { ok: boolean; reaped: number; credits_refunded: number };

    expect(res.status).toBe(200);
    expect(body).toEqual({ ok: true, reaped: 1, credits_refunded: 0 });
  });

  it('does not count or refund a mission that was resolved before the guarded update', async () => {
    mocks.getD1Safe.mockReturnValue(dbWithOneStuckMission(0));

    const res = await GET(request());
    const body = await res.json() as { ok: boolean; reaped: number; credits_refunded: number };

    expect(res.status).toBe(200);
    expect(body).toEqual({ ok: true, reaped: 0, credits_refunded: 0 });
    expect(mocks.addCredits).not.toHaveBeenCalled();
  });
});
