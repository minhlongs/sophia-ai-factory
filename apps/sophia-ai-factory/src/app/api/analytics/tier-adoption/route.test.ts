/**
 * Tests for GET /api/analytics/tier-adoption
 *
 * Covers:
 * - 401 when unauthenticated
 * - 403 when non-admin
 * - 400 when date params missing or invalid
 * - 400 when from > to
 * - 200 with valid admin request
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// ── Mocks ───────────────────────────────────────────────────────────────────

vi.mock('@/seed/auth/better-auth-session', () => ({
  getCurrentUser: vi.fn(),
}));

vi.mock('@/lib/analytics/rbac', () => ({
  checkAdmin: vi.fn(),
}));

vi.mock('@/seed/db/client', () => ({
  createServerClient: vi.fn(),
}));

vi.mock('@/seed/utils/logger-utility', () => ({
  logger: { info: vi.fn(), error: vi.fn() },
}));

import { GET } from './route';
import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { checkAdmin } from '@/lib/analytics/rbac';
import { createServerClient } from '@/seed/db/client';

const mockGetCurrentUser = vi.mocked(getCurrentUser);
const mockCheckAdmin = vi.mocked(checkAdmin);
const mockCreateServerClient = vi.mocked(createServerClient);

// ── DB stub ──────────────────────────────────────────────────────────────────

function buildDbStub(rows: { tier: string; created_at: string }[] = []) {
  const chainable = {
    from: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    gte: vi.fn().mockReturnThis(),
    lte: vi.fn().mockReturnThis(),
    eq: vi.fn().mockResolvedValue({ data: rows, error: null }),
  };
  return chainable;
}

// ── URL helper ───────────────────────────────────────────────────────────────

function makeReq(params: Record<string, string>): NextRequest {
  const url = new URL('http://localhost/api/analytics/tier-adoption');
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  return new NextRequest(url);
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('GET /api/analytics/tier-adoption', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 401 when unauthenticated', async () => {
    mockGetCurrentUser.mockResolvedValue(null);

    const res = await GET(makeReq({ from: '2026-01-01', to: '2026-01-31' }));
    expect(res.status).toBe(401);
    const body = await res.json() as { error: string };
    expect(body.error).toMatch(/unauthorized/i);
  });

  it('returns 403 when authenticated but not admin', async () => {
    mockGetCurrentUser.mockResolvedValue({ id: 'user-1', email: 'u@e.com' } as Parameters<typeof mockGetCurrentUser.mockResolvedValue>[0]);
    mockCheckAdmin.mockResolvedValue(false);

    const res = await GET(makeReq({ from: '2026-01-01', to: '2026-01-31' }));
    expect(res.status).toBe(403);
    const body = await res.json() as { error: string };
    expect(body.error).toMatch(/forbidden/i);
  });

  it('returns 400 when date params missing', async () => {
    mockGetCurrentUser.mockResolvedValue({ id: 'admin-1', email: 'a@e.com' } as Parameters<typeof mockGetCurrentUser.mockResolvedValue>[0]);
    mockCheckAdmin.mockResolvedValue(true);

    const res = await GET(makeReq({}));
    expect(res.status).toBe(400);
    const body = await res.json() as { error: string };
    expect(body.error).toMatch(/invalid query params/i);
  });

  it('returns 400 when date format invalid', async () => {
    mockGetCurrentUser.mockResolvedValue({ id: 'admin-1', email: 'a@e.com' } as Parameters<typeof mockGetCurrentUser.mockResolvedValue>[0]);
    mockCheckAdmin.mockResolvedValue(true);

    const res = await GET(makeReq({ from: 'not-a-date', to: '2026-01-31' }));
    expect(res.status).toBe(400);
  });

  it('returns 400 when from > to', async () => {
    mockGetCurrentUser.mockResolvedValue({ id: 'admin-1', email: 'a@e.com' } as Parameters<typeof mockGetCurrentUser.mockResolvedValue>[0]);
    mockCheckAdmin.mockResolvedValue(true);
    mockCreateServerClient.mockReturnValue(buildDbStub() as unknown as ReturnType<typeof createServerClient>);

    const res = await GET(makeReq({ from: '2026-02-01', to: '2026-01-01' }));
    expect(res.status).toBe(400);
    const body = await res.json() as { error: string };
    expect(body.error).toMatch(/invalid date range/i);
  });

  it('returns 200 with valid admin request and empty data', async () => {
    mockGetCurrentUser.mockResolvedValue({ id: 'admin-1', email: 'a@e.com' } as Parameters<typeof mockGetCurrentUser.mockResolvedValue>[0]);
    mockCheckAdmin.mockResolvedValue(true);
    mockCreateServerClient.mockReturnValue(buildDbStub([]) as unknown as ReturnType<typeof createServerClient>);

    const res = await GET(makeReq({ from: '2026-01-01', to: '2026-01-07' }));
    expect(res.status).toBe(200);

    const body = await res.json() as { period: { from: string; to: string }; points: unknown[]; chartRows: unknown[] };
    expect(body.period.from).toBe('2026-01-01');
    expect(body.period.to).toBe('2026-01-07');
    expect(Array.isArray(body.points)).toBe(true);
    expect(Array.isArray(body.chartRows)).toBe(true);
  });

  it('returns 200 and counts new subscriptions correctly', async () => {
    mockGetCurrentUser.mockResolvedValue({ id: 'admin-1', email: 'a@e.com' } as Parameters<typeof mockGetCurrentUser.mockResolvedValue>[0]);
    mockCheckAdmin.mockResolvedValue(true);

    const sampleRows = [
      { tier: 'BASIC', created_at: '2026-01-02T10:00:00Z' },
      { tier: 'PREMIUM', created_at: '2026-01-03T12:00:00Z' },
      { tier: 'BASIC', created_at: '2026-01-03T15:00:00Z' },
    ];
    mockCreateServerClient.mockReturnValue(buildDbStub(sampleRows) as unknown as ReturnType<typeof createServerClient>);

    const res = await GET(makeReq({ from: '2026-01-01', to: '2026-01-05' }));
    expect(res.status).toBe(200);

    const body = await res.json() as { points: { tier: string; date: string; totalActive: number }[] };
    // BASIC on 2026-01-02 should have 1 new, BASIC on 2026-01-03 should have 1 new (cumulative 2)
    const basicPoints = body.points.filter(p => p.tier === 'BASIC');
    expect(basicPoints.length).toBeGreaterThan(0);
    // Cumulative total on 2026-01-03 for BASIC should be 2
    const basicJan3 = basicPoints.find(p => p.date === '2026-01-03');
    expect(basicJan3?.totalActive).toBe(2);
  });
});
