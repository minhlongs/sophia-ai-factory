import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { CSRF_COOKIE_NAME, CSRF_HEADER_NAME } from '@/seed/security/csrf';
import { clearOrgIdCache } from '@/seed/auth/resolve-org-id';
import { resetCouponCache } from '@/seed/config/coupons';

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

const TEST_PROMO_ENV =
  'FREE50:100:9999:2099-12-31:sophia|mekongmind:1000,LAUNCH25:25:100:2099-12-31:sophia|mekongmind:500,EXPIRED100:100:10:2020-01-01:sophia:1000';

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
  alreadyRedeemed?: boolean;
  orgRow?: { org_id: string } | null;
  subscriptionRow?: { id: string; current_period_end?: string | null } | null;
} = {}) {
  const first = vi
    .fn()
    .mockResolvedValueOnce(options.alreadyRedeemed ? { id: 1 } : null)
    .mockResolvedValueOnce(options.orgRow === undefined ? { org_id: 'org-1' } : options.orgRow)
    .mockResolvedValueOnce(
      options.subscriptionRow === undefined ? { id: 'sub-1', current_period_end: null } : options.subscriptionRow,
    );
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
    clearOrgIdCache();
    resetCouponCache();
    vi.clearAllMocks();
    vi.stubEnv('PROMO_COUPON_CODES', TEST_PROMO_ENV);
    mocks.getCurrentUserFromHeaders.mockResolvedValue({ id: 'user-1', email: 'u@example.com' });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    resetCouponCache();
  });

  it('rejects missing CSRF before auth or DB work', async () => {
    const res = await POST(
      new NextRequest('http://localhost/api/coupons/activate', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ coupon: 'FREE50', tier: 'MASTER' }),
      }),
    );

    expect(res.status).toBe(403);
    expect(mocks.getCurrentUserFromHeaders).not.toHaveBeenCalled();
    expect(mocks.getD1).not.toHaveBeenCalled();
  });

  it('fails closed when PROMO_COUPON_CODES is unset (no hardcoded FREE50/LAUNCH25 fallback)', async () => {
    vi.stubEnv('PROMO_COUPON_CODES', '');
    resetCouponCache();

    const res = await POST(request({ coupon: 'FREE50', tier: 'MASTER' }));
    expect(res.status).toBe(404);
    expect(mocks.getD1).not.toHaveBeenCalled();
  });

  it('rejects partial-discount coupons (e.g. 25% off) from $0 tier activation', async () => {
    const res = await POST(request({ coupon: 'LAUNCH25', tier: 'MASTER' }));
    expect(res.status).toBe(400);
    const body = (await res.json()) as { success: boolean; error: string };
    expect(body.success).toBe(false);
    expect(mocks.getD1).not.toHaveBeenCalled();
  });

  it('rejects expired coupons with 410', async () => {
    const res = await POST(request({ coupon: 'EXPIRED100', tier: 'BASIC' }));
    expect(res.status).toBe(410);
    expect(mocks.getD1).not.toHaveBeenCalled();
  });

  it('activates a valid 100%-discount coupon with bounded 30-day period and redemption row', async () => {
    const d1 = d1Mock();
    mocks.getD1.mockReturnValue(d1);

    const res = await POST(request({ coupon: 'FREE50', tier: 'MASTER' }));
    const body = (await res.json()) as {
      success: boolean;
      tier: string;
      mcuBonus: number;
      currentPeriodEnd: string;
    };

    expect(res.status).toBe(200);
    expect(body).toMatchObject({ success: true, tier: 'MASTER', mcuBonus: 1000 });
    expect(typeof body.currentPeriodEnd).toBe('string');
    expect(new Date(body.currentPeriodEnd).getTime()).toBeGreaterThan(Date.now() + 29 * 86_400_000);
    expect(mocks.getD1).toHaveBeenCalledTimes(1);
    expect(d1.batch).toHaveBeenCalledTimes(1);
    expect(d1.batch.mock.calls[0][0]).toHaveLength(5);
    expect(d1.bind).toHaveBeenCalledWith('org-1', 1000);
  });

  it('returns 409 on replay when user already redeemed coupon', async () => {
    const d1 = d1Mock({ alreadyRedeemed: true });
    mocks.getD1.mockReturnValue(d1);

    const res = await POST(request({ coupon: 'FREE50', tier: 'MASTER' }));
    expect(res.status).toBe(409);
    expect(d1.batch).not.toHaveBeenCalled();
  });

  it('preserves starter org balance when auto-creating an organization', async () => {
    const d1 = d1Mock({ orgRow: null, subscriptionRow: null });
    mocks.getD1.mockReturnValue(d1);

    const res = await POST(request({ coupon: 'FREE50', tier: 'MASTER' }));

    expect(res.status).toBe(200);
    expect(d1.batch).toHaveBeenCalledTimes(1);
    expect(d1.batch.mock.calls[0][0]).toHaveLength(7);
    expect(d1.bind).toHaveBeenCalledWith(expect.any(String), 1050);
  });

  it('rejects invalid tier before DB work', async () => {
    const res = await POST(request({ coupon: 'FREE50', tier: 'INVALID' }));
    const body = (await res.json()) as { success: boolean; error: string };

    expect(res.status).toBe(400);
    expect(body).toEqual({ success: false, error: 'Invalid tier' });
    expect(mocks.getD1).not.toHaveBeenCalled();
  });

  it('returns 500 when atomic activation batch fails', async () => {
    const d1 = d1Mock({ rejectBatch: true });
    mocks.getD1.mockReturnValue(d1);

    const res = await POST(request({ coupon: 'FREE50', tier: 'MASTER' }));
    const body = (await res.json()) as { success: boolean; error: string };

    expect(res.status).toBe(500);
    expect(body).toEqual({ success: false, error: 'Failed to add MCU credits' });
    expect(d1.batch).toHaveBeenCalledTimes(1);
  });
});
