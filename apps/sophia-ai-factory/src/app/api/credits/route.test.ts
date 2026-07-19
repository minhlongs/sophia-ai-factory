/**
 * Tests for GET /api/credits
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';

const mocks = vi.hoisted(() => ({
  getCurrentUser: vi.fn(),
  getBalance: vi.fn(),
  tierHasFeature: vi.fn(),
  loggerError: vi.fn(),
  resolveUserTier: vi.fn().mockResolvedValue('PREMIUM' as const),
}));

vi.mock('@/seed/auth/better-auth-session', () => ({
  getCurrentUser: mocks.getCurrentUser,
}));

vi.mock('@/tree/mcu/credits-repo', () => ({
  getBalance: mocks.getBalance,
}));

vi.mock('@/seed/utils/logger-utility', () => ({
  logger: { error: mocks.loggerError },
}));

vi.mock('@/seed/config/tiers', async () => {
  const actual = await vi.importActual('@/seed/config/tiers');
  return { ...actual, tierHasFeature: mocks.tierHasFeature };
});

vi.mock('@/seed/db/resolve-user-tier', () => ({
  resolveUserTier: mocks.resolveUserTier,
}));

// Module-level variable so we can re-patch between tests
let currentPackResult: unknown = null;

function makeDbMock() {
  return {
    prepare: vi.fn(() => ({
      bind: vi.fn(() => ({
        first: vi.fn(async () => currentPackResult),
      })),
    })),
  };
}

vi.mock('@/seed/db/client', () => ({
  createServerClient: vi.fn(() => makeDbMock()),
}));

import { GET } from './route';

function cast(data: unknown): Record<string, unknown> {
  return data as Record<string, unknown>;
}

const mockUser = { id: 'user-123', email: 't@t.com', createdAt: new Date() };
function makeReq(headers: Record<string, string> = {}): NextRequest {
  return new NextRequest('https://sophia.agencyos.network/api/credits', { headers });
}

describe('GET /api/credits', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv('CRON_SECRET', 'test-secret');
    currentPackResult = {
      pack_credits_remaining: 0,
      pack_credits_total: 0,
      active_packs: 0,
    };
    mocks.getCurrentUser.mockResolvedValue(mockUser);
    mocks.tierHasFeature.mockReturnValue(true);
    mocks.getBalance.mockResolvedValue({
      credits_remaining: 50,
      credits_total_purchased: 100,
      credits_total_used: 50,
    });
    mocks.resolveUserTier.mockResolvedValue('PREMIUM' as const);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('returns 401 when not logged in', async () => {
    mocks.getCurrentUser.mockResolvedValue(null);
    const res = await GET(makeReq());
    expect(res.status).toBe(401);
  });

  it('returns 403 when user lacks enable_credit_topup', async () => {
    mocks.tierHasFeature.mockReturnValue(false);
    const res = await GET(makeReq());
    expect(res.status).toBe(403);
    const data = cast(await res.json());
    expect(data.requiredTier).toBe('PREMIUM');
  });

  it('returns 200 with unified balance', async () => {
    const res = await GET(makeReq());
    const data = cast(await res.json());
    expect(res.status).toBe(200);
    expect(data.tier).toBe('PREMIUM');
    expect((data.mcu as Record<string, number>).credits_remaining).toBe(50);
    expect((data.packs as Record<string, number>).credits_remaining).toBe(0);
    expect(data.total_credits_remaining).toBe(50);
    expect(data.can_use_credit_topup).toBe(true);
  });

  it('aggregates MCU + pack credits', async () => {
    mocks.getBalance.mockResolvedValue({
      credits_remaining: 30,
      credits_total_purchased: 100,
      credits_total_used: 70,
    });
    currentPackResult = {
      pack_credits_remaining: 20,
      pack_credits_total: 50,
      active_packs: 2,
    };

    const res = await GET(makeReq());
    const data = cast(await res.json());
    expect(res.status).toBe(200);
    expect((data.packs as Record<string, number>).credits_remaining).toBe(20);
    expect((data.packs as Record<string, number>).active_packs).toBe(2);
    expect(data.total_credits_remaining).toBe(50); // 30+20
  });

  it('verifies expiry filter in SQL', async () => {
    let capturedSql = '';
    const { createServerClient } = await import('@/seed/db/client');
    // Use a fresh mock to intercept prepare without recursion
    const freshDb = makeDbMock();
    vi.mocked(createServerClient).mockReturnValue(
      freshDb as unknown as ReturnType<typeof createServerClient>,
    );
    const prepFn = freshDb.prepare as ReturnType<typeof vi.fn>;
    prepFn.mockImplementation((sql: string) => {
      capturedSql = sql;
      return { bind: vi.fn(() => ({ first: vi.fn(async () => null) })) };
    });

    await GET(makeReq());
    expect(capturedSql).toContain('expires_at IS NULL');
    expect(capturedSql).toContain('expires_at >');
  });

  it('falls back to zero when DB returns null', async () => {
    currentPackResult = null;
    const { createServerClient } = await import('@/seed/db/client');
    vi.mocked(createServerClient).mockReturnValue(makeDbMock() as unknown as ReturnType<typeof createServerClient>);

    const res = await GET(makeReq());
    const data = cast(await res.json());
    expect(res.status).toBe(200);
    expect((data.packs as Record<string, number>).credits_remaining).toBe(0);
    expect(data.total_credits_remaining).toBe(50);
  });

  it('returns 500 on MCU error', async () => {
    mocks.getBalance.mockRejectedValue(new Error('DB down'));
    const res = await GET(makeReq());
    expect(res.status).toBe(500);
    const data = cast(await res.json());
    expect(data.error).toBe('Failed to fetch credit balance');
  });
});
