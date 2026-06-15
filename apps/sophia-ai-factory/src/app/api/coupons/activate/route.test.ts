import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { CSRF_COOKIE_NAME, CSRF_HEADER_NAME } from '@/seed/security/csrf';

const mocks = vi.hoisted(() => ({
  getCurrentUserFromHeaders: vi.fn(),
  getD1: vi.fn(),
}));

vi.mock('@/seed/auth/better-auth-session', () => ({
  getCurrentUserFromHeaders: mocks.getCurrentUserFromHeaders,
}));

vi.mock('@/seed/db/client', () => ({
  getD1: mocks.getD1,
}));

import { POST } from './route';

function request(body: unknown, csrf = 'csrf-1') {
  return new NextRequest('http://localhost/api/coupons/activate', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      [CSRF_HEADER_NAME]: csrf,
      cookie: `${CSRF_COOKIE_NAME}=${csrf}`,
    },
    body: JSON.stringify(body),
  });
}

function d1Mock(options: {
  rejectBatch?: boolean;
  orgRow?: { org_id: string } | null;
  subscriptionRow?: { id: string } | null;
} = {}) {
  const first = vi.fn()
    .mockResolvedValueOnce(options.orgRow === undefined ? { org_id: 'org-1' } : options.orgRow)
    .mockResolvedValueOnce(options.subscriptionRow === undefined ? { id: 'sub-1' } : options.subscriptionRow);
  const run = vi.fn().mockResolvedValue({ meta: { changes: 1 } });
  const bind = vi.fn().mockReturnValue({ first, run });
  const prepare = vi.fn().mockReturnValue({ bind });
  const batch = options.rejectBatch
    ? vi.fn().mockRejectedValue(new Error('batch failed'))
    : vi.fn().mockResolvedValue([]);
  return { prepare, bind, first, run, batch };
}

describe('POST /api/coupons/activate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getCurrentUserFromHeaders.mockResolvedValue({ id: 'user-1', email: 'u@example.com' });
  });

  it('rejects missing CSRF before auth or DB work', async () => {
    const res = await POST(new NextRequest('http://localhost/api/coupons/activate', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ coupon: 'FREE50', tier: 'MASTER' }),
    }));

    expect(res.status).toBe(403);
    expect(mocks.getCurrentUserFromHeaders).not.toHaveBeenCalled();
    expect(mocks.getD1).not.toHaveBeenCalled();
  });

  it('activates a valid coupon with canonical raw D1 binding', async () => {
    const d1 = d1Mock();
    mocks.getD1.mockReturnValue(d1);

    const res = await POST(request({ coupon: 'FREE50', tier: 'MASTER' }));
    const body = await res.json() as { success: boolean; tier: string; mcuBonus: number };

    expect(res.status).toBe(200);
    expect(body).toMatchObject({ success: true, tier: 'MASTER', mcuBonus: 1000 });
    expect(mocks.getD1).toHaveBeenCalledTimes(1);
    expect(d1.batch).toHaveBeenCalledTimes(1);
    expect(d1.batch.mock.calls[0][0]).toHaveLength(4);
    expect(d1.bind).toHaveBeenCalledWith('org-1', 1000);
  });

  it('preserves starter org balance when auto-creating an organization', async () => {
    const d1 = d1Mock({ orgRow: null, subscriptionRow: null });
    mocks.getD1.mockReturnValue(d1);

    const res = await POST(request({ coupon: 'FREE50', tier: 'MASTER' }));

    expect(res.status).toBe(200);
    expect(d1.batch).toHaveBeenCalledTimes(1);
    expect(d1.batch.mock.calls[0][0]).toHaveLength(6);
    expect(d1.bind).toHaveBeenCalledWith(expect.any(String), 1050);
  });

  it('rejects invalid tier before DB work', async () => {
    const res = await POST(request({ coupon: 'FREE50', tier: 'INVALID' }));
    const body = await res.json() as { success: boolean; error: string };

    expect(res.status).toBe(400);
    expect(body).toEqual({ success: false, error: 'Invalid tier' });
    expect(mocks.getD1).not.toHaveBeenCalled();
  });

  it('returns 500 when atomic activation batch fails', async () => {
    const d1 = d1Mock({ rejectBatch: true });
    mocks.getD1.mockReturnValue(d1);

    const res = await POST(request({ coupon: 'FREE50', tier: 'MASTER' }));
    const body = await res.json() as { success: boolean; error: string };

    expect(res.status).toBe(500);
    expect(body).toEqual({ success: false, error: 'Failed to add MCU credits' });
    expect(d1.batch).toHaveBeenCalledTimes(1);
  });
});
