/**
 * Tests for POST /api/admin/payouts/mark-paid
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/seed/utils/logger-utility', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock('@/seed/utils/to-error', () => ({
  toError: (e: unknown) => (e instanceof Error ? e : new Error(String(e))),
}));

// Mock session-based auth
vi.mock('@/seed/auth/better-auth-session', () => ({
  getCurrentUserFromHeaders: vi.fn(),
}));

vi.mock('@/land/wallet/payout-processor', () => ({
  markUserPaid: vi.fn(),
}));

vi.mock('@/land/wallet/payout-telegram-notify', () => ({
  notifyPayoutSent: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/seed/auth/is-user-admin', () => ({
  isUserAdmin: vi.fn(),
}));

import { POST } from './route';
import { getCurrentUserFromHeaders } from '@/seed/auth/better-auth-session';
import { isUserAdmin } from '@/seed/auth/is-user-admin';
import { markUserPaid } from '@/land/wallet/payout-processor';
import { notifyPayoutSent } from '@/land/wallet/payout-telegram-notify';
import { NextRequest } from 'next/server';

const mockGetCurrentUserFromHeaders = vi.mocked(getCurrentUserFromHeaders);
const mockIsUserAdmin = vi.mocked(isUserAdmin);

type SessionUser = NonNullable<Awaited<ReturnType<typeof getCurrentUserFromHeaders>>>

const adminUser = { id: 'admin-user-abc123', email: 'admin@test.com', role: 'admin' } as unknown as SessionUser;

// userId is 32-char hex (lower(hex(randomblob(16)))) — NOT UUID format
const validBody = {
  userId: 'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4',
  amount: 100,
  method: 'usdt_trc20',
  reference: 'tx_abc123',
};

function makeRequest(body: unknown = validBody): NextRequest {
  return new NextRequest('https://sophia.agencyos.network/api/admin/payouts/mark-paid', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: {
      'content-type': 'application/json',
      cookie: 'session=test',
    },
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockGetCurrentUserFromHeaders.mockResolvedValue(adminUser);
  mockIsUserAdmin.mockResolvedValue(true);
  (markUserPaid as ReturnType<typeof vi.fn>).mockResolvedValue({ payoutId: 'payout-123' });
});

describe('POST /api/admin/payouts/mark-paid', () => {
  it('returns 401 when user is not authenticated', async () => {
    mockGetCurrentUserFromHeaders.mockResolvedValue(null);

    const res = await POST(makeRequest());
    expect(res.status).toBe(401);
  });

  it('returns 403 when user is not admin', async () => {
    mockGetCurrentUserFromHeaders.mockResolvedValue({ id: 'user-1', email: 'user@test.com', role: 'user' } as unknown as SessionUser);
    mockIsUserAdmin.mockResolvedValue(false);

    const res = await POST(makeRequest());
    expect(res.status).toBe(403);
  });

  it('returns 422 for invalid body (missing reference)', async () => {
    const res = await POST(makeRequest({ ...validBody, reference: '' }));
    expect(res.status).toBe(422);
    expect(markUserPaid).not.toHaveBeenCalled();
  });

  it('returns 422 for invalid method', async () => {
    const res = await POST(makeRequest({ ...validBody, method: 'paypal' }));
    expect(res.status).toBe(422);
  });

  it('returns 422 for empty userId', async () => {
    const res = await POST(makeRequest({ ...validBody, userId: '' }));
    expect(res.status).toBe(422);
  });

  it('returns 200 with payoutId on success', async () => {
    const res = await POST(makeRequest());
    const data = await res.json() as { ok: boolean; payoutId: string };

    expect(res.status).toBe(200);
    expect(data.ok).toBe(true);
    expect(data.payoutId).toBe('payout-123');
  });

  it('calls markUserPaid with adminId from session (not Basic Auth)', async () => {
    await POST(makeRequest());

    expect(markUserPaid).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: validBody.userId,
        amount: validBody.amount,
        method: validBody.method,
        reference: validBody.reference,
        adminId: adminUser.id,
      })
    );
  });

  it('fires notifyPayoutSent (fire-and-forget)', async () => {
    await POST(makeRequest());

    await vi.waitFor(() => expect(notifyPayoutSent).toHaveBeenCalledTimes(1));
  });

  it('returns 400 on business rule violations from markUserPaid', async () => {
    (markUserPaid as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error('Amount $100 is below minimum payout threshold $50')
    );

    const res = await POST(makeRequest());
    expect(res.status).toBe(400);
  });

  it('returns 500 on unexpected errors', async () => {
    (markUserPaid as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error('D1 connection failed')
    );

    const res = await POST(makeRequest());
    expect(res.status).toBe(500);
  });

  it('returns 400 on balance mismatch error', async () => {
    (markUserPaid as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error('Amount $150 does not match available balance $100 — whole-balance payout only')
    );

    const res = await POST(makeRequest());
    expect(res.status).toBe(400);
  });
});
