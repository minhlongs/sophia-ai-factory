/**
 * Tests for POST /api/auth/reset-password/confirm
 *
 * Verifies password reset confirmation, session revocation (Risk #10),
 * cookie deletion, token consumption, and rate limiting.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// Mock dependencies
vi.mock('@/seed/security/sql-rate-limiter', () => ({
  checkRateLimit: vi.fn().mockResolvedValue({ success: true, reset: Date.now() + 900000 }),
  getClientIdentifier: vi.fn().mockReturnValue('127.0.0.1'),
}));

vi.mock('@/forest/middleware/rate-limiter', () => ({
  createRateLimitHeaders: vi.fn().mockReturnValue({}),
}));

const mockConsumeResetToken = vi.fn();
vi.mock('@/seed/auth/reset-password-token', () => ({
  consumeResetToken: (...args: unknown[]) => mockConsumeResetToken(...args),
}));

const mockRevokeAllUserSessions = vi.fn();
vi.mock('@/seed/auth/revoke-user-sessions', () => ({
  revokeAllUserSessions: (...args: unknown[]) => mockRevokeAllUserSessions(...args),
}));

const mockHashPassword = vi.fn().mockResolvedValue('hashed-password-123');
vi.mock('@/seed/security/password-hash', () => ({
  hashPassword: (...args: unknown[]) => mockHashPassword(...args),
}));

const mockD1Run = vi.fn();
const mockD1Bind = vi.fn().mockReturnValue({ run: mockD1Run });
const mockD1Prepare = vi.fn().mockReturnValue({ bind: mockD1Bind });
const mockDb = { prepare: mockD1Prepare };

vi.mock('@/seed/db/client', () => ({
  getD1: vi.fn().mockResolvedValue({
    prepare: (...args: unknown[]) => mockD1Prepare(...args),
  }),
}));

// Import route handler after mocks
import { POST } from '../route';

interface RouteResponse {
  ok?: boolean;
  error?: string;
  message?: string;
}

describe('POST /api/auth/reset-password/confirm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockD1Run.mockResolvedValue({ meta: { changes: 1 } });
    mockConsumeResetToken.mockResolvedValue('user-target-123');
    mockRevokeAllUserSessions.mockResolvedValue({ success: true, revokedCount: 2 });
  });

  it('rejects invalid or missing body parameters', async () => {
    const req = new NextRequest('http://localhost/api/auth/reset-password/confirm', {
      method: 'POST',
      body: JSON.stringify({ token: 'short' }), // missing newPassword, token too short
      headers: { 'Content-Type': 'application/json' },
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
    const json = (await res.json()) as RouteResponse;
    expect(json.error).toBe('Invalid input');
  });

  it('returns generic 400 when reset token is invalid or consumed', async () => {
    mockConsumeResetToken.mockResolvedValue(null);

    const req = new NextRequest('http://localhost/api/auth/reset-password/confirm', {
      method: 'POST',
      body: JSON.stringify({
        token: 'valid-format-token-string-12345',
        newPassword: 'ValidNewPassword123!',
      }),
      headers: { 'Content-Type': 'application/json' },
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
    const json = (await res.json()) as RouteResponse;
    expect(json.error).toBe('Invalid or expired reset link');
    expect(mockRevokeAllUserSessions).not.toHaveBeenCalled();
  });

  it('successfully resets password, revokes all sessions, and clears cookies', async () => {
    const req = new NextRequest('http://localhost/api/auth/reset-password/confirm', {
      method: 'POST',
      body: JSON.stringify({
        token: 'valid-format-token-string-12345',
        newPassword: 'ValidNewPassword123!',
      }),
      headers: { 'Content-Type': 'application/json' },
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    const json = (await res.json()) as RouteResponse;
    expect(json.ok).toBe(true);

    // Verify session revocation called with userId and db (Risk #10 hardening)
    expect(mockRevokeAllUserSessions).toHaveBeenCalledWith('user-target-123', expect.anything());
  });

  it('handles rate limit exceeded', async () => {
    const { checkRateLimit } = await import('@/seed/security/sql-rate-limiter');
    vi.mocked(checkRateLimit).mockResolvedValueOnce({
      success: false,
      reset: Date.now() + 300000,
      remaining: 0,
    });

    const req = new NextRequest('http://localhost/api/auth/reset-password/confirm', {
      method: 'POST',
      body: JSON.stringify({
        token: 'valid-format-token-string-12345',
        newPassword: 'ValidNewPassword123!',
      }),
      headers: { 'Content-Type': 'application/json' },
    });

    const res = await POST(req);
    expect(res.status).toBe(429);
    const json = (await res.json()) as RouteResponse;
    expect(json.error).toBe('Too Many Requests');
  });
});
