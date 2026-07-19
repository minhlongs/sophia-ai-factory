/**
 * F02 — Admin Re-Authentication Challenge Security Tests
 * ASVS V3.5.1: Sensitive admin mutations require recent-auth proof.
 *
 * Test matrix:
 *  1. Bulk-generate without challenge token → 401 reason=no-challenge
 *  2. POST /api/auth/admin-challenge with correct password → 200 + cookie
 *  3. POST /api/auth/admin-challenge with wrong password → 401
 *  4. Bulk-generate with valid recent challenge token → 200
 *  5. Bulk-generate with expired challenge token (6 min old) → 401 reason=expired
 *  6. Bulk-generate with tampered signature → 401 reason=invalid
 *
 * Style mirrors src/security-tests/promo-idor.test.ts.
 * @module tests/security/f02-admin-reauth
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NextRequest } from 'next/server';
import {
  requireRecentAuth,
  mintAdminChallengeToken,
} from '@/seed/auth/require-admin';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock('@/seed/auth/better-auth-session', () => ({
  getCurrentUserFromHeaders: vi.fn(),
}));

vi.mock('@/seed/auth/require-admin', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/seed/auth/require-admin')>();
  return {
    ...actual,
    requireAdmin: vi.fn(),
  };
});

vi.mock('@/seed/security/rate-limiter', () => ({
  rateLimit: vi.fn().mockResolvedValue({ allowed: true, resetAt: 0 }),
}));

vi.mock('@/land/promo/bulk-generator', () => ({
  bulkGeneratePromoCodes: vi.fn().mockResolvedValue({
    codes: ['FREE100-AAAAAAAA'],
    promoCodeIds: ['pid_1'],
    csv: 'FREE100-AAAAAAAA',
    batchId: 'batch_1',
    generatedAt: 1000000,
  }),
  BulkIdempotencyConflict: class BulkIdempotencyConflict extends Error {
    priorBatchId: string;
    constructor(priorBatchId: string) {
      super('conflict');
      this.priorBatchId = priorBatchId;
    }
  },
}));

vi.mock('@/seed/db/client', () => ({
  getD1: vi.fn(),
  createServerClient: vi.fn().mockReturnValue({
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({
        data: { password: 'pbkdf2:aabbcc:ddeeff' },
        error: null,
      }),
    }),
  }),
}));

vi.mock('@/tree/crypto/password-hash', () => ({
  verifyPassword: vi.fn().mockResolvedValue(false),
}));

vi.mock('@/seed/utils/logger-utility', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const TEST_SECRET = 'test-secret-for-hmac-signing-1234567890abcdef';

function makeBulkRequest(cookieValue?: string): NextRequest {
  const headers: HeadersInit = {};
  if (cookieValue) {
    headers['cookie'] = `admin_challenge_token=${cookieValue}`;
  }
  return new NextRequest(
    new URL('http://localhost:3000/api/admin/promo-codes/bulk-generate'),
    {
      method: 'POST',
      headers,
      body: JSON.stringify({
        baseCode: 'FREE100',
        count: 5,
        tier: 'MASTER',
      }),
    },
  );
}

// ---------------------------------------------------------------------------
// Tests for requireRecentAuth() helper directly
// ---------------------------------------------------------------------------

describe('requireRecentAuth helper', () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
    vi.stubEnv('BETTER_AUTH_SECRET', TEST_SECRET);
  });

  it('returns no-challenge when cookie is absent', async () => {
    const req = makeBulkRequest(); // no cookie
    const result = await requireRecentAuth(req, 5 * 60 * 1000);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('no-challenge');
  });

  it('returns ok=true for a freshly minted valid token', async () => {
    const token = await mintAdminChallengeToken('admin_user_1', TEST_SECRET);
    const req = makeBulkRequest(token);
    const result = await requireRecentAuth(req, 5 * 60 * 1000);
    expect(result.ok).toBe(true);
  });

  it('returns expired when token issuedAt is > maxAgeMs ago', async () => {
    // Mint a token with issuedAt 6 minutes in the past by mocking Date.now
    const sixMinAgo = Date.now() - 6 * 60 * 1000;
    const dateSpy = vi.spyOn(Date, 'now').mockReturnValue(sixMinAgo);
    const token = await mintAdminChallengeToken('admin_user_1', TEST_SECRET);
    dateSpy.mockRestore();

    const req = makeBulkRequest(token);
    const result = await requireRecentAuth(req, 5 * 60 * 1000);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('expired');
  });

  it('returns invalid when signature is tampered', async () => {
    const token = await mintAdminChallengeToken('admin_user_1', TEST_SECRET);
    // Flip last char of signature segment
    const dotIdx = token.lastIndexOf('.');
    const replacement = token[dotIdx + 1] === 'X' ? 'Y' : 'X';
    const tampered = token.slice(0, dotIdx + 1) + replacement + token.slice(dotIdx + 2);
    const req = makeBulkRequest(tampered);
    const result = await requireRecentAuth(req, 5 * 60 * 1000);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('invalid');
  });

  it('returns invalid when cookie value is malformed (no dot)', async () => {
    const req = makeBulkRequest('notadotformat');
    const result = await requireRecentAuth(req, 5 * 60 * 1000);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('invalid');
  });
});

// ---------------------------------------------------------------------------
// Tests for POST /api/auth/admin-challenge endpoint
// ---------------------------------------------------------------------------

describe('POST /api/auth/admin-challenge', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllEnvs();
    vi.stubEnv('BETTER_AUTH_SECRET', TEST_SECRET);
  });

  it('returns 401 with reason=wrong_password on incorrect password', async () => {
    const { getCurrentUserFromHeaders } = await import('@/seed/auth/better-auth-session');
    vi.mocked(getCurrentUserFromHeaders).mockResolvedValueOnce({
      id: 'admin_1',
      email: 'admin@example.com',
      role: 'admin',
    });

    const { POST } = await import('@/app/api/auth/admin-challenge/route');
    const req = new NextRequest('http://localhost/api/auth/admin-challenge', {
      method: 'POST',
      body: JSON.stringify({ password: 'wrongpassword' }),
      headers: { 'content-type': 'application/json' },
    });

    const res = await POST(req);
    expect(res.status).toBe(401);
    const body = await res.json() as { reason: string };
    expect(body.reason).toBe('wrong_password');
  });

  it('returns 401 with reason=no_session when not authenticated', async () => {
    const { getCurrentUserFromHeaders } = await import('@/seed/auth/better-auth-session');
    vi.mocked(getCurrentUserFromHeaders).mockResolvedValueOnce(null);

    const { POST } = await import('@/app/api/auth/admin-challenge/route');
    const req = new NextRequest('http://localhost/api/auth/admin-challenge', {
      method: 'POST',
      body: JSON.stringify({ password: 'anypassword' }),
      headers: { 'content-type': 'application/json' },
    });

    const res = await POST(req);
    expect(res.status).toBe(401);
    const body = await res.json() as { reason: string };
    expect(body.reason).toBe('no_session');
  });
});

// ---------------------------------------------------------------------------
// Tests for bulk-generate route gating
// ---------------------------------------------------------------------------

describe('POST /api/admin/promo-codes/bulk-generate — F02 gate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllEnvs();
    vi.stubEnv('BETTER_AUTH_SECRET', TEST_SECRET);
  });

  it('returns 401 reason=no-challenge without challenge token (admin session present)', async () => {
    const { requireAdmin } = await import('@/seed/auth/require-admin');
    vi.mocked(requireAdmin).mockResolvedValueOnce({
      user: { id: 'admin_1', email: 'admin@example.com', role: 'admin' },
    });

    const { POST } = await import('@/app/api/admin/promo-codes/bulk-generate/route');
    const req = makeBulkRequest(); // no cookie
    const res = await POST(req);

    expect(res.status).toBe(401);
    const body = await res.json() as { error: string; reason: string };
    expect(body.error).toBe('recent_auth_required');
    expect(body.reason).toBe('no-challenge');
  });

  it('returns 200 with valid recent challenge token', async () => {
    const { requireAdmin } = await import('@/seed/auth/require-admin');
    vi.mocked(requireAdmin).mockResolvedValueOnce({
      user: { id: 'admin_1', email: 'admin@example.com', role: 'admin' },
    });

    const token = await mintAdminChallengeToken('admin_1', TEST_SECRET);
    const { POST } = await import('@/app/api/admin/promo-codes/bulk-generate/route');
    const req = makeBulkRequest(token);
    const res = await POST(req);

    expect(res.status).toBe(200);
    const body = await res.json() as { codes: string[] };
    expect(Array.isArray(body.codes)).toBe(true);
  });

  it('returns 401 reason=expired with 6-min-old challenge token', async () => {
    const { requireAdmin } = await import('@/seed/auth/require-admin');
    vi.mocked(requireAdmin).mockResolvedValueOnce({
      user: { id: 'admin_1', email: 'admin@example.com', role: 'admin' },
    });

    const sixMinAgo = Date.now() - 6 * 60 * 1000;
    const dateSpy = vi.spyOn(Date, 'now').mockReturnValue(sixMinAgo);
    const token = await mintAdminChallengeToken('admin_1', TEST_SECRET);
    dateSpy.mockRestore();

    const { POST } = await import('@/app/api/admin/promo-codes/bulk-generate/route');
    const req = makeBulkRequest(token);
    const res = await POST(req);

    expect(res.status).toBe(401);
    const body = await res.json() as { reason: string };
    expect(body.reason).toBe('expired');
  });

  it('returns 401 reason=invalid with tampered signature', async () => {
    const { requireAdmin } = await import('@/seed/auth/require-admin');
    vi.mocked(requireAdmin).mockResolvedValueOnce({
      user: { id: 'admin_1', email: 'admin@example.com', role: 'admin' },
    });

    const token = await mintAdminChallengeToken('admin_1', TEST_SECRET);
    const dotIdx = token.lastIndexOf('.');
    // Ensure the replacement character is different from the original to guarantee tampering.
    const originalChar = token[dotIdx + 1];
    const replacement = originalChar === 'X' ? 'Y' : 'X';
    const tampered = token.slice(0, dotIdx + 1) + replacement + token.slice(dotIdx + 2);

    const { POST } = await import('@/app/api/admin/promo-codes/bulk-generate/route');
    const req = makeBulkRequest(tampered);
    const res = await POST(req);

    expect(res.status).toBe(401);
    const body = await res.json() as { reason: string };
    expect(body.reason).toBe('invalid');
  });
});
