import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { CSRF_COOKIE_NAME, CSRF_HEADER_NAME } from '@/seed/security/csrf';

const mocks = vi.hoisted(() => ({
  getCurrentUserFromHeaders: vi.fn(),
  getD1Raw: vi.fn(),
  addCredits: vi.fn(),
}));

vi.mock('@/seed/auth/better-auth-session', () => ({
  getCurrentUserFromHeaders: mocks.getCurrentUserFromHeaders,
}));

vi.mock('@/seed/db/client', () => ({
  getD1Raw: mocks.getD1Raw,
}));

vi.mock('@/land/mcu/credits-repo', () => ({
  addCredits: mocks.addCredits,
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

function d1Mock() {
  const first = vi.fn()
    .mockResolvedValueOnce({ org_id: 'org-1' })
    .mockResolvedValueOnce({ id: 'sub-1' });
  const run = vi.fn().mockResolvedValue({ meta: { changes: 1 } });
  const bind = vi.fn().mockReturnValue({ first, run });
  const prepare = vi.fn().mockReturnValue({ bind });
  return { prepare, bind, first, run };
}

describe('POST /api/coupons/activate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getCurrentUserFromHeaders.mockResolvedValue({ id: 'user-1', email: 'u@example.com' });
    mocks.addCredits.mockResolvedValue(undefined);
  });

  it('rejects missing CSRF before auth or DB work', async () => {
    const res = await POST(new NextRequest('http://localhost/api/coupons/activate', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ coupon: 'FREE50', tier: 'MASTER' }),
    }));

    expect(res.status).toBe(403);
    expect(mocks.getCurrentUserFromHeaders).not.toHaveBeenCalled();
    expect(mocks.getD1Raw).not.toHaveBeenCalled();
  });

  it('activates a valid coupon with canonical raw D1 binding', async () => {
    const d1 = d1Mock();
    mocks.getD1Raw.mockResolvedValue(d1);

    const res = await POST(request({ coupon: 'FREE50', tier: 'MASTER' }));
    const body = await res.json() as { success: boolean; tier: string; mcuBonus: number };

    expect(res.status).toBe(200);
    expect(body).toMatchObject({ success: true, tier: 'MASTER', mcuBonus: 1000 });
    expect(mocks.getD1Raw).toHaveBeenCalledTimes(1);
    expect(mocks.addCredits).toHaveBeenCalledWith('user-1', 1000, 'Coupon Activation', { coupon: 'FREE50' });
  });
});
