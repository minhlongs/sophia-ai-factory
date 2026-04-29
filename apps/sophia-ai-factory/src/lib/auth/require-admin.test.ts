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

vi.mock('@/lib/better-auth-session', () => ({
  getCurrentUserFromHeaders: vi.fn(),
}));

import { requireAdmin } from './require-admin';
import { getCurrentUserFromHeaders } from '@/lib/better-auth-session';

const mockGetCurrentUserFromHeaders = vi.mocked(getCurrentUserFromHeaders);

function makeRequest(): NextRequest {
  return new NextRequest('http://localhost/api/admin/test');
}

beforeEach(() => {
  vi.clearAllMocks();
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
  });

  it('returns 403 NextResponse when user role is "user" (not admin)', async () => {
    mockGetCurrentUserFromHeaders.mockResolvedValue({
      id: 'user-1',
      email: 'user@test.com',
      role: 'user',
    });

    const result = await requireAdmin(makeRequest());

    expect(result).toBeInstanceOf(NextResponse);
    const res = result as NextResponse;
    expect(res.status).toBe(403);
    const body = await res.json() as { error: string };
    expect(body.error).toBe('Forbidden: admin role required');
  });

  it('returns { user } when role is "admin"', async () => {
    const adminUser = { id: 'admin-1', email: 'admin@test.local', role: 'admin' };
    mockGetCurrentUserFromHeaders.mockResolvedValue(adminUser);

    const result = await requireAdmin(makeRequest());

    expect(result).not.toBeInstanceOf(NextResponse);
    const { user } = result as { user: typeof adminUser };
    expect(user).toEqual(adminUser);
  });

  it('also works with plain Request (not NextRequest)', async () => {
    const adminUser = { id: 'admin-2', email: 'admin2@test.local', role: 'admin' };
    mockGetCurrentUserFromHeaders.mockResolvedValue(adminUser);

    const req = new Request('http://localhost/api/admin/test');
    const result = await requireAdmin(req);

    expect(result).not.toBeInstanceOf(NextResponse);
    const { user } = result as { user: typeof adminUser };
    expect(user.role).toBe('admin');
  });

  it('returns 401 when underlying session lookup rejects (defensive contract)', async () => {
    // getCurrentUserFromHeaders has internal try/catch returning null on throw.
    // This locks in the contract that requireAdmin treats null as 401.
    mockGetCurrentUserFromHeaders.mockResolvedValue(null);

    const result = await requireAdmin(makeRequest());
    expect(result).toBeInstanceOf(NextResponse);
    expect((result as NextResponse).status).toBe(401);
  });
});
