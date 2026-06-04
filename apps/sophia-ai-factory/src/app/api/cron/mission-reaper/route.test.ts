import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';

const mocks = vi.hoisted(() => ({
  getD1Safe: vi.fn(),
  verifyCronAuth: vi.fn(),
  addCredits: vi.fn(),
}));

vi.mock('@/seed/db/client', () => ({
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

describe('GET /api/cron/mission-reaper', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.verifyCronAuth.mockReturnValue(null);
    mocks.addCredits.mockResolvedValue(undefined);
  });

  it('forwards cron auth rejection', async () => {
    mocks.verifyCronAuth.mockReturnValue(NextResponse.json({ error: 'Unauthorized' }, { status: 401 }));

    const res = await GET(request());

    expect(res.status).toBe(401);
    expect(mocks.getD1Safe).not.toHaveBeenCalled();
  });

  it('returns 503 when D1 binding is unavailable', async () => {
    mocks.getD1Safe.mockResolvedValue(null);

    const res = await GET(request());

    expect(res.status).toBe(503);
  });

  it('marks stuck missions failed and refunds recorded credits', async () => {
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
    const run = vi.fn().mockResolvedValue({ meta: { changes: 1 } });
    const bind = vi.fn()
      .mockReturnValueOnce({ all })
      .mockReturnValueOnce({ run });
    const prepare = vi.fn().mockReturnValue({ bind });
    mocks.getD1Safe.mockResolvedValue({ prepare });

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
});
