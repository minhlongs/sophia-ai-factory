/**
 * Unit tests for POST /api/openclaw/exchange (route.ts)
 *
 * Coverage:
 *   - unauthenticated → 401
 *   - missing BETTER_AUTH_SECRET → 500
 *   - default TTL = 24h (86400s)
 *   - ttlSeconds > 86400 without extended flag → 400
 *   - ttlSeconds > 7 days (604800s) → 400 (hard ceiling)
 *   - ttlSeconds > 86400 with extended=true but non-service role → 400
 *   - 11th mint per user in 1h → 429 with Retry-After
 *   - 31st mint per IP in 1h → 429 with Retry-After
 *   - within rate limits → 200
 *   - response shape: token, expiresAt, userId, jti
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// ── Mocks ─────────────────────────────────────────────────────────────────────
// vi.mock factories are hoisted — do NOT reference outer consts here.

vi.mock('@/seed/auth/better-auth-session', () => ({
  getCurrentUserFromHeaders: vi.fn(),
}));

vi.mock('@/seed/db/client', () => ({
  getD1: vi.fn(),
}));

vi.mock('@/seed/utils/logger-utility', () => ({
  logger: { error: vi.fn(), warn: vi.fn() },
}));

vi.mock('@/seed/utils/to-error', () => ({
  toError: (e: unknown) => (e instanceof Error ? e : new Error(String(e))),
}));

import { POST } from '@/app/api/openclaw/exchange/route';
import { getCurrentUserFromHeaders } from '@/seed/auth/better-auth-session';
import { getD1 } from '@/seed/db/client';

const mockGetUser = vi.mocked(getCurrentUserFromHeaders);
const mockGetD1 = vi.mocked(getD1);

const baseUser = { id: 'user-123', email: 'test@example.com', name: 'Test', role: 'user', emailVerified: true };

// Per-test mint counts: key = userId or IP string
let mintCounts: Record<string, number>;

function makeD1Mock() {
  return {
    prepare: vi.fn().mockImplementation((sql: string) => {
      const stmt = {
        _sql: sql,
        _args: [] as unknown[],
        bind(...args: unknown[]) {
          this._args = args;
          return this;
        },
        async first() {
          if (this._sql.includes('COUNT(*)')) {
            const key = String(this._args[0]);
            return { cnt: mintCounts[key] ?? 0 };
          }
          return null;
        },
        run: vi.fn().mockResolvedValue(undefined),
      };
      return stmt;
    }),
  };
}

function makeRequest(body?: unknown): NextRequest {
  return new NextRequest('http://localhost/api/openclaw/exchange', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: body != null ? JSON.stringify(body) : undefined,
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mintCounts = {};
  process.env.BETTER_AUTH_SECRET = 'test-secret-route';
  mockGetUser.mockResolvedValue(baseUser as never);
  mockGetD1.mockResolvedValue(makeD1Mock() as unknown as D1Database);
});

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('authentication', () => {
  it('returns 401 when not authenticated', async () => {
    mockGetUser.mockResolvedValue(null);
    const res = await POST(makeRequest());
    expect(res.status).toBe(401);
  });

  it('returns 500 when BETTER_AUTH_SECRET missing', async () => {
    delete process.env.BETTER_AUTH_SECRET;
    delete process.env.JWT_SECRET;
    const res = await POST(makeRequest());
    expect(res.status).toBe(500);
  });
});

describe('default TTL', () => {
  it('returns 200 with expiresAt = now + 24h when no ttlSeconds provided', async () => {
    const before = Math.floor(Date.now() / 1000);
    const res = await POST(makeRequest());
    const after = Math.floor(Date.now() / 1000);

    expect(res.status).toBe(200);
    const body = await res.json() as { token: string; expiresAt: number; userId: string; jti: string };
    expect(body.expiresAt).toBeGreaterThanOrEqual(before + 86_400);
    expect(body.expiresAt).toBeLessThanOrEqual(after + 86_400 + 1);
    expect(body.jti).toBeTruthy();
    expect(body.userId).toBe(baseUser.id);
  });
});

describe('TTL validation', () => {
  it('rejects ttlSeconds > 86400 without extended flag (400)', async () => {
    const res = await POST(makeRequest({ ttlSeconds: 90_000 }));
    expect(res.status).toBe(400);
    const body = await res.json() as { error: string };
    expect(body.error).toMatch(/extended/);
  });

  it('hard-rejects ttlSeconds > 604800 (7 days) regardless of flags (400)', async () => {
    const res = await POST(makeRequest({ ttlSeconds: 700_000, extended: true }));
    expect(res.status).toBe(400);
  });

  it('rejects extended=true but non-service role → 400', async () => {
    const res = await POST(makeRequest({ ttlSeconds: 200_000, extended: true }));
    expect(res.status).toBe(400);
    const body = await res.json() as { error: string };
    expect(body.error).toMatch(/service/i);
  });

  it('accepts ttlSeconds within 24h', async () => {
    const res = await POST(makeRequest({ ttlSeconds: 3600 }));
    expect(res.status).toBe(200);
  });
});

describe('rate limiting', () => {
  it('returns 429 + Retry-After when user exceeds 10 mints/hour', async () => {
    mintCounts['user-123'] = 10; // at limit (>= RATE_MAX_USER)

    const res = await POST(makeRequest());
    expect(res.status).toBe(429);
    expect(res.headers.get('Retry-After')).toBeTruthy();
    const body = await res.json() as { error: string; detail: string };
    expect(body.error).toBe('rate_limited');
    expect(body.detail).toMatch(/user/);
  });

  it('returns 429 + Retry-After when IP exceeds 30 mints/hour', async () => {
    // user count OK, IP at limit
    mintCounts['user-123'] = 5;
    mintCounts['unknown'] = 30;

    const res = await POST(makeRequest());
    expect(res.status).toBe(429);
    expect(res.headers.get('Retry-After')).toBeTruthy();
    const body = await res.json() as { error: string; detail: string };
    expect(body.error).toBe('rate_limited');
    expect(body.detail).toMatch(/ip/i);
  });

  it('returns 200 when within rate limits', async () => {
    mintCounts['user-123'] = 9;
    mintCounts['unknown'] = 29;

    const res = await POST(makeRequest());
    expect(res.status).toBe(200);
  });
});

describe('response shape', () => {
  it('includes token (4-part v2), expiresAt, userId, jti', async () => {
    const res = await POST(makeRequest());
    const body = await res.json() as Record<string, unknown>;
    expect(body).toHaveProperty('token');
    expect(body).toHaveProperty('expiresAt');
    expect(body).toHaveProperty('userId', baseUser.id);
    expect(body).toHaveProperty('jti');
    // v2 token: userId.expiresAt.jti.sig = 4 dot-separated parts
    expect(String(body.token).split('.').length).toBe(4);
  });
});
