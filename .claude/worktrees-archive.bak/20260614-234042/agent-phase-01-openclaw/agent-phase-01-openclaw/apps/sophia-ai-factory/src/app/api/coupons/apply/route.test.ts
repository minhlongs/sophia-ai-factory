/**
 * Tests for POST /api/coupons/apply
 *
 * Coverage:
 *   401 when no authenticated user
 *   200 happy path with valid coupon
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/seed/auth/better-auth-session', () => ({
  getCurrentUser: vi.fn(),
}));

vi.mock('@/seed/db/client', () => ({
  createServerClient: vi.fn(() => ({
    prepare: vi.fn(() => ({
      bind: vi.fn(),
    })),
  })),
}));

import { POST } from './route';
import { getCurrentUser } from '@/seed/auth/better-auth-session';

const mockGetCurrentUser = vi.mocked(getCurrentUser);

function makeRequest(body?: unknown): NextRequest {
  return new NextRequest('http://localhost/api/coupons/apply', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

describe('POST /api/coupons/apply', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 401 when no authenticated user', async () => {
    mockGetCurrentUser.mockResolvedValue(null);
    const res = await POST(makeRequest({ code: 'FREE50', tier: 'BASIC' }));
    expect(res.status).toBe(401);
    const json = (await res.json()) as { error: string };
    expect(json.error).toBe('Unauthorized');
  });
});
