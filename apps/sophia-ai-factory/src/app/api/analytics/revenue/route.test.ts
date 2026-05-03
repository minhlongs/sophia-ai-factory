/**
 * Tests for GET /api/analytics/revenue
 *
 * Covers:
 * - Auth 401 (unauthenticated)
 * - RBAC 403 (BASIC/PREMIUM tier)
 * - MRR calculation correctness
 * - ARR = MRR × 12
 * - Invalid period param → 400
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// ── Mocks ───────────────────────────────────────────────────────────────────

vi.mock('@/seed/auth/better-auth-session', () => ({
  getCurrentUser: vi.fn(),
}));

vi.mock('@/seed/db/get-user-tier', () => ({
  getUserTier: vi.fn(),
}));

vi.mock('@/lib/analytics/rbac', () => ({
  checkAdmin: vi.fn(),
  canAccessRevenue: vi.fn(),
}));

vi.mock('@/lib/analytics/queries/revenue-nowpayments', () => ({
  fetchRevenueSnapshot: vi.fn(),
}));

vi.mock('@/seed/utils/logger-utility', () => ({
  logger: { info: vi.fn(), error: vi.fn() },
}));

import { GET } from './route';
import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { getUserTier } from '@/seed/db/get-user-tier';
import { checkAdmin, canAccessRevenue } from '@/lib/analytics/rbac';
import { fetchRevenueSnapshot } from '@/lib/analytics/queries/revenue-nowpayments';
import type { RevenueSnapshot } from '@/seed/types/analytics-revenue';

// ── Helpers ─────────────────────────────────────────────────────────────────

function makeRequest(params: Record<string, string> = {}): NextRequest {
  const url = new URL('http://localhost/api/analytics/revenue');
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  return new NextRequest(url);
}

const mockSnapshot: RevenueSnapshot = {
  arr: 57_588,
  mrr: 4_799,
  mrrGrowthPct: 12.5,
  byTier: [
    { tier: 'BASIC', customers: 10, mrr: 1_990, arr: 23_880 },
    { tier: 'ENTERPRISE', customers: 1, mrr: 799, arr: 9_588 },
  ],
  trend30d: [
    { date: '2026-04-01', mrr: 4_200, arr: 50_400 },
    { date: '2026-04-15', mrr: 4_799, arr: 57_588 },
  ],
  periodStart: '2026-03-26T00:00:00.000Z',
  periodEnd: '2026-04-25T00:00:00.000Z',
};

// ── Tests ───────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
});

describe('GET /api/analytics/revenue', () => {
  it('returns 401 when unauthenticated', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(null);
    const res = await GET(makeRequest());
    expect(res.status).toBe(401);
    const body = await res.json() as { error: string };
    expect(body.error).toMatch(/Unauthorized/i);
  });

  it('returns 400 for invalid period param', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue({ id: 'u1', email: 'a@b.com' });
    vi.mocked(getUserTier).mockResolvedValue('ENTERPRISE');
    vi.mocked(checkAdmin).mockResolvedValue(false);
    vi.mocked(canAccessRevenue).mockReturnValue(true);
    const res = await GET(makeRequest({ period: 'invalid' }));
    expect(res.status).toBe(400);
  });

  it('returns 403 for BASIC tier', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue({ id: 'u1', email: 'a@b.com' });
    vi.mocked(getUserTier).mockResolvedValue('BASIC');
    vi.mocked(checkAdmin).mockResolvedValue(false);
    vi.mocked(canAccessRevenue).mockReturnValue(false);
    const res = await GET(makeRequest());
    expect(res.status).toBe(403);
  });

  it('returns 403 for PREMIUM tier', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue({ id: 'u1', email: 'a@b.com' });
    vi.mocked(getUserTier).mockResolvedValue('PREMIUM');
    vi.mocked(checkAdmin).mockResolvedValue(false);
    vi.mocked(canAccessRevenue).mockReturnValue(false);
    const res = await GET(makeRequest());
    expect(res.status).toBe(403);
  });

  it('returns 403 when non-admin provides org_id', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue({ id: 'u1', email: 'a@b.com' });
    vi.mocked(getUserTier).mockResolvedValue('ENTERPRISE');
    vi.mocked(checkAdmin).mockResolvedValue(false);
    vi.mocked(canAccessRevenue).mockReturnValue(true);
    const res = await GET(makeRequest({ org_id: 'other-org' }));
    expect(res.status).toBe(403);
  });

  it('returns 200 with RevenueSnapshot for ENTERPRISE user', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue({ id: 'u1', email: 'a@b.com' });
    vi.mocked(getUserTier).mockResolvedValue('ENTERPRISE');
    vi.mocked(checkAdmin).mockResolvedValue(false);
    vi.mocked(canAccessRevenue).mockReturnValue(true);
    vi.mocked(fetchRevenueSnapshot).mockResolvedValue(mockSnapshot);

    const res = await GET(makeRequest({ period: '30d' }));
    expect(res.status).toBe(200);
    const body = await res.json() as RevenueSnapshot & { metadata: unknown };
    expect(body.mrr).toBe(4_799);
    expect(body.arr).toBe(57_588);
    expect(body.metadata).toBeDefined();
  });

  it('ARR equals MRR × 12', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue({ id: 'u1', email: 'a@b.com' });
    vi.mocked(getUserTier).mockResolvedValue('MASTER');
    vi.mocked(checkAdmin).mockResolvedValue(true);
    vi.mocked(canAccessRevenue).mockReturnValue(true);
    vi.mocked(fetchRevenueSnapshot).mockResolvedValue(mockSnapshot);

    const res = await GET(makeRequest());
    const body = await res.json() as RevenueSnapshot;
    expect(body.arr).toBe(body.mrr * 12);
  });

  it('admin can request with org_id and receives 200', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue({ id: 'admin1', email: 'admin@b.com' });
    vi.mocked(getUserTier).mockResolvedValue('MASTER');
    vi.mocked(checkAdmin).mockResolvedValue(true);
    vi.mocked(canAccessRevenue).mockReturnValue(true);
    vi.mocked(fetchRevenueSnapshot).mockResolvedValue(mockSnapshot);

    const res = await GET(makeRequest({ org_id: 'org-xyz' }));
    expect(res.status).toBe(200);
    expect(vi.mocked(fetchRevenueSnapshot)).toHaveBeenCalledWith('30d', 'org-xyz');
  });
});
