/**
 * Tests for GET /api/user/wallet
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/seed/auth/better-auth-session', () => ({
  getCurrentUser: vi.fn(),
}));

vi.mock('@/seed/utils/logger-utility', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock('@/seed/utils/to-error', () => ({
  toError: (e: unknown) => (e instanceof Error ? e : new Error(String(e))),
}));

import { GET } from './route';
import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { NextRequest } from 'next/server';

const mockAll = vi.fn();
const mockFirst = vi.fn();
const mockBind = vi.fn(() => ({ all: mockAll, first: mockFirst }));
const mockPrepare = vi.fn(() => ({ bind: mockBind }));
const mockDb = { prepare: mockPrepare };

function makeRequest(): NextRequest {
  return new NextRequest('https://sophia.agencyos.network/api/user/wallet');
}

beforeEach(() => {
  vi.clearAllMocks();
  (globalThis as unknown as { __env: Record<string, unknown> }).__env = { DB: mockDb };
  mockAll.mockResolvedValue({ results: [] });
  mockFirst.mockResolvedValue(null);
});

describe('GET /api/user/wallet', () => {
  it('returns 401 when not authenticated', async () => {
    (getCurrentUser as ReturnType<typeof vi.fn>).mockResolvedValue(null);

    const res = await GET(makeRequest());
    expect(res.status).toBe(401);
  });

  it('returns zero balances when wallet does not exist yet', async () => {
    (getCurrentUser as ReturnType<typeof vi.fn>).mockResolvedValue({ id: 'user-1' });
    mockFirst.mockResolvedValue(null);

    const res = await GET(makeRequest());
    const data = await res.json() as Record<string, unknown>;

    expect(res.status).toBe(200);
    expect(data.balance_pending).toBe(0);
    expect(data.balance_available).toBe(0);
    expect(data.balance_paid_out).toBe(0);
    expect(data.currency).toBe('USD');
    expect(data.recent_conversions).toEqual([]);
  });

  it('returns wallet balances and recent conversions', async () => {
    (getCurrentUser as ReturnType<typeof vi.fn>).mockResolvedValue({ id: 'user-2' });
    mockFirst.mockResolvedValue({
      user_id: 'user-2',
      balance_pending: 50,
      balance_available: 100,
      balance_paid_out: 200,
      currency: 'USD',
      last_rebuilt_at: 1700000000,
      updated_at: '2024-01-01 00:00:00',
    });
    mockAll.mockResolvedValue({
      results: [
        {
          id: 'conv-1', event_type: 'SALE', gross_amount: 50,
          commission_user: 35, currency: 'USD',
          payout_status: 'available', offer_id: 'phenq', created_at: '2024-01-01',
        },
      ],
    });

    const res = await GET(makeRequest());
    const data = await res.json() as Record<string, unknown>;

    expect(res.status).toBe(200);
    expect(data.balance_pending).toBe(50);
    expect(data.balance_available).toBe(100);
    expect(data.balance_paid_out).toBe(200);
    expect((data.recent_conversions as unknown[]).length).toBe(1);
  });

  it('returns 500 on D1 error', async () => {
    (getCurrentUser as ReturnType<typeof vi.fn>).mockResolvedValue({ id: 'user-3' });
    mockFirst.mockRejectedValue(new Error('D1 error'));

    const res = await GET(makeRequest());
    expect(res.status).toBe(500);
  });
});
