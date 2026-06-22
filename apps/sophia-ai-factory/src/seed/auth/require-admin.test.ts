/**
 * Unit tests for requireAdmin()
 *
 * Coverage:
 *   - Returns 401 when getCurrentUserFromHeaders returns null
 *   - Returns 403 when user role is 'user' (not admin)
 *   - Returns { user } when role is 'admin'
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';

vi.mock('@/seed/auth/better-auth-session', () => ({
  getCurrentUserFromHeaders: vi.fn(),
}));

vi.mock('@/seed/auth/is-user-admin', () => ({
  isUserAdmin: vi.fn(),
}));

import { requireAdmin } from '@/seed/auth/require-admin';
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

    expect(result).toBeInstanceOf(NextResponse);
    const res = result as NextResponse;
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

    expect(result).toBeInstanceOf(NextResponse);
    const res = result as NextResponse;
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

    expect(result).not.toBeInstanceOf(NextResponse);
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

    expect(result).not.toBeInstanceOf(NextResponse);
    const { user } = result as { user: typeof adminUser };
    expect(user.role).toBe('admin');
    expect(mockIsUserAdmin).toHaveBeenCalledTimes(1);
    expect(mockIsUserAdmin).toHaveBeenCalledWith(adminUser);
  });

  it('returns 503 when getCurrentUserFromHeaders throws', async () => {
    mockGetCurrentUserFromHeaders.mockRejectedValue(new Error('DB down'));

    const result = await requireAdmin(makeRequest());

    expect(result).toBeInstanceOf(NextResponse);
    const res = result as NextResponse;
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

    expect(result).toBeInstanceOf(NextResponse);
    const res = result as NextResponse;
    expect(res.status).toBe(503);
    const body = await res.json() as { error: string };
    expect(body.error).toBe('Authentication service temporarily unavailable');
  });
});
