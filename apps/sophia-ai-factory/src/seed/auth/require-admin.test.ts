/**
 * Unit tests for requireAdmin()
 *
 * Coverage:
 *   - Returns 401 when getCurrentUserFromHeaders returns null
 *   - Returns 403 when user role is 'user' (not admin)
 *   - Returns { user } when role is 'admin'
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';

vi.mock('@/seed/auth/better-auth-session', () => ({
  getCurrentUserFromHeaders: vi.fn(),
}));

vi.mock('@/seed/auth/is-user-admin', () => ({
  isUserAdmin: vi.fn(),
}));

import {
  mintAdminChallengeToken,
  requireAdmin,
  requireAdminWithRecentAuth,
} from '@/seed/auth/require-admin';
import { getCurrentUserFromHeaders } from '@/seed/auth/better-auth-session';
import { isUserAdmin } from '@/seed/auth/is-user-admin';

const mockGetCurrentUserFromHeaders = vi.mocked(getCurrentUserFromHeaders);
const mockIsUserAdmin = vi.mocked(isUserAdmin);

function makeRequest(): NextRequest {
  return new NextRequest('http://localhost/api/admin/test');
}

beforeEach(() => {
  vi.clearAllMocks();
  mockIsUserAdmin.mockReset();
});

describe('requireAdmin', () => {
  it('returns 401 NextResponse when getCurrentUserFromHeaders returns null', async () => {
    mockGetCurrentUserFromHeaders.mockResolvedValue(null);

    const result = await requireAdmin(makeRequest());

    expect(result).toBeInstanceOf(Response);
    const res = result as Response;
    expect(res.status).toBe(401);
    const body = await res.json() as { error: string };
    expect(body.error).toBe('Unauthorized');
    expect(mockIsUserAdmin).not.toHaveBeenCalled();
  });

  it('returns 403 NextResponse when user is not admin in DB', async () => {
    mockGetCurrentUserFromHeaders.mockResolvedValue({
      id: 'user-1',
      email: 'user@test.com',
      role: 'user',
    });
    mockIsUserAdmin.mockResolvedValue(false);

    const result = await requireAdmin(makeRequest());

    expect(result).toBeInstanceOf(Response);
    const res = result as Response;
    expect(res.status).toBe(403);
    const body = await res.json() as { error: string };
    expect(body.error).toBe('Forbidden: admin role required');
    expect(mockIsUserAdmin).toHaveBeenCalledTimes(1);
    expect(mockIsUserAdmin).toHaveBeenCalledWith({
      id: 'user-1',
      email: 'user@test.com',
      role: 'user',
    });
  });

  it('returns { user } when user is admin in DB', async () => {
    const adminUser = { id: 'admin-1', email: 'admin@test.local', role: 'admin' };
    mockGetCurrentUserFromHeaders.mockResolvedValue(adminUser);
    mockIsUserAdmin.mockResolvedValue(true);

    const result = await requireAdmin(makeRequest());

    expect(result).not.toBeInstanceOf(Response);
    const { user } = result as { user: typeof adminUser };
    expect(user).toEqual(adminUser);
    expect(mockIsUserAdmin).toHaveBeenCalledTimes(1);
    expect(mockIsUserAdmin).toHaveBeenCalledWith(adminUser);
  });

  it('also works with plain Request (not NextRequest)', async () => {
    const adminUser = { id: 'admin-2', email: 'admin2@test.local', role: 'admin' };
    mockGetCurrentUserFromHeaders.mockResolvedValue(adminUser);
    mockIsUserAdmin.mockResolvedValue(true);

    const req = new Request('http://localhost/api/admin/test');
    const result = await requireAdmin(req);

    expect(result).not.toBeInstanceOf(Response);
    const { user } = result as { user: typeof adminUser };
    expect(user.role).toBe('admin');
    expect(mockIsUserAdmin).toHaveBeenCalledTimes(1);
    expect(mockIsUserAdmin).toHaveBeenCalledWith(adminUser);
  });

  it('returns 503 when getCurrentUserFromHeaders throws', async () => {
    mockGetCurrentUserFromHeaders.mockRejectedValue(new Error('DB down'));

    const result = await requireAdmin(makeRequest());

    expect(result).toBeInstanceOf(Response);
    const res = result as Response;
    expect(res.status).toBe(503);
    const body = await res.json() as { error: string };
    expect(body.error).toBe('Authentication service temporarily unavailable');
    expect(mockIsUserAdmin).not.toHaveBeenCalled();
  });

  it('returns 503 when admin check (isUserAdmin) throws', async () => {
    const adminUser = { id: 'admin-1', email: 'admin@test.local', role: 'admin' };
    mockGetCurrentUserFromHeaders.mockResolvedValue(adminUser);
    mockIsUserAdmin.mockRejectedValue(new Error('DB error'));

    const result = await requireAdmin(makeRequest());

    expect(result).toBeInstanceOf(Response);
    const res = result as Response;
    expect(res.status).toBe(503);
    const body = await res.json() as { error: string };
    expect(body.error).toBe('Authentication service temporarily unavailable');
  });
});

const TEST_CHALLENGE_SECRET = 'test-admin-guard-hmac-secret';
const sessionAdmin = { id: 'admin-1', email: 'admin@test.local', role: 'admin' };

function makeRecentAuthRequest(token?: string): NextRequest {
  const request = makeRequest();
  if (token) request.headers.set('cookie', `admin_challenge_token=${token}`);
  return request;
}

describe('requireAdminWithRecentAuth', () => {
  beforeEach(() => {
    vi.stubEnv('ADMIN_CHALLENGE_SECRET', TEST_CHALLENGE_SECRET);
    mockGetCurrentUserFromHeaders.mockResolvedValue(sessionAdmin);
    mockIsUserAdmin.mockResolvedValue(true);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });

  it('accepts a valid recent challenge for the authenticated session admin', async () => {
    const token = await mintAdminChallengeToken(sessionAdmin.id, TEST_CHALLENGE_SECRET);
    const result = await requireAdminWithRecentAuth(makeRecentAuthRequest(token));
    expect(result).toEqual({ user: sessionAdmin, recentAuth: true });
    expect(mockIsUserAdmin).toHaveBeenCalledWith(sessionAdmin);
  });

  it('rejects a different admin token despite a matching submitted operator ID', async () => {
    const token = await mintAdminChallengeToken('admin-2', TEST_CHALLENGE_SECRET);
    const request = makeRecentAuthRequest(token);
    request.headers.set('X-Deploy-Operator', 'admin-2');
    const result = await requireAdminWithRecentAuth(request);
    expect(result).toBeInstanceOf(NextResponse);
    const response = result as NextResponse;
    expect(response.status).toBe(403);
    expect(await response.json()).toMatchObject({
      error: 'Re-authentication required', reason: 'invalid',
    });
  });

  it('rejects missing challenge cookies', async () => {
    const result = await requireAdminWithRecentAuth(makeRecentAuthRequest());
    expect(result).toBeInstanceOf(NextResponse);
    const response = result as NextResponse;
    expect(response.status).toBe(401);
    expect(await response.json()).toMatchObject({ reason: 'no-challenge' });
  });

  it('rejects expired identity-matching challenge cookies', async () => {
    const dateSpy = vi.spyOn(Date, 'now').mockReturnValue(Date.now() - 6 * 60 * 1000);
    const token = await mintAdminChallengeToken(sessionAdmin.id, TEST_CHALLENGE_SECRET);
    dateSpy.mockRestore();
    const result = await requireAdminWithRecentAuth(makeRecentAuthRequest(token));
    expect(result).toBeInstanceOf(NextResponse);
    const response = result as NextResponse;
    expect(response.status).toBe(403);
    expect(await response.json()).toMatchObject({ reason: 'expired' });
  });

  it('rejects tampered identity-matching challenge cookies', async () => {
    const token = await mintAdminChallengeToken(sessionAdmin.id, TEST_CHALLENGE_SECRET);
    const dot = token.lastIndexOf('.');
    const replacement = token[dot + 1] === 'X' ? 'Y' : 'X';
    const tampered = token.slice(0, dot + 1) + replacement + token.slice(dot + 2);
    const result = await requireAdminWithRecentAuth(makeRecentAuthRequest(tampered));
    expect(result).toBeInstanceOf(NextResponse);
    const response = result as NextResponse;
    expect(response.status).toBe(403);
    expect(await response.json()).toMatchObject({ reason: 'invalid' });
  });

  it('rejects valid deploy-token authentication without an authenticated session', async () => {
    vi.stubEnv('DEPLOY_GUARD_API_TOKEN', 'test-only-deploy-token');
    mockGetCurrentUserFromHeaders.mockResolvedValue(null);
    const token = await mintAdminChallengeToken(sessionAdmin.id, TEST_CHALLENGE_SECRET);
    const request = makeRecentAuthRequest(token);
    request.headers.set('X-Deploy-Guard-Token', 'test-only-deploy-token');
    request.headers.set('X-Deploy-Operator', sessionAdmin.id);
    const result = await requireAdminWithRecentAuth(request);
    expect(result).toBeInstanceOf(NextResponse);
    expect((result as NextResponse).status).toBe(401);
    expect(mockIsUserAdmin).not.toHaveBeenCalled();
  });

  it('rejects a revoked admin even with an identity-matching recent challenge', async () => {
    mockIsUserAdmin.mockResolvedValue(false);
    const token = await mintAdminChallengeToken(sessionAdmin.id, TEST_CHALLENGE_SECRET);
    const result = await requireAdminWithRecentAuth(makeRecentAuthRequest(token));
    expect(result).toBeInstanceOf(NextResponse);
    const response = result as NextResponse;
    expect(response.status).toBe(403);
    expect(await response.json()).toMatchObject({ error: 'Forbidden: admin role required' });
  });

  it.each(['session', 'role'] as const)('fails closed when the %s lookup is unavailable', async (lookup) => {
    const dependency = lookup === 'session' ? mockGetCurrentUserFromHeaders : mockIsUserAdmin;
    dependency.mockRejectedValue(new Error('Auth unavailable'));
    const result = await requireAdminWithRecentAuth(makeRecentAuthRequest());
    expect(result).toBeInstanceOf(NextResponse);
    expect((result as NextResponse).status).toBe(503);
  });
});
