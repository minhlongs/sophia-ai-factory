import { describe, expect, it, vi, beforeEach } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';
import { handleApiPipeline } from '../api-pipeline';

vi.mock('../api-handler', () => ({
  handleApiRoute: vi.fn(),
}));

vi.mock('@/forest/middleware/auth-guard', () => ({
  withAuth: vi.fn(),
  isPublicApiRoute: vi.fn(),
}));

vi.mock('@/tree/usage-metering', () => ({
  emitUsageEvent: vi.fn().mockResolvedValue(undefined),
}));

import { handleApiRoute } from '../api-handler';
import { withAuth, isPublicApiRoute } from '@/forest/middleware/auth-guard';

describe('API Pipeline middleware', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns null for non-API routes', async () => {
    const req = new NextRequest('http://localhost/dashboard');
    const headers = new Headers();
    const res = await handleApiPipeline(req, '/dashboard', 'vi', Date.now(), headers, 'nonce-1', false);
    expect(res).toBeNull();
  });

  it('rejects invalid cron requests with 403', async () => {
    const req = new NextRequest('http://localhost/api/cron/test');
    const headers = new Headers();
    const res = await handleApiPipeline(req, '/api/cron/test', 'vi', Date.now(), headers, 'nonce-1', false);
    expect(res?.status).toBe(403);
  });

  it('propagates resolved user session and tier headers downstream without redundant withAuth call', async () => {
    const req = new NextRequest('http://localhost/api/v1/missions');
    const headers = new Headers();

    vi.mocked(isPublicApiRoute).mockReturnValue(false);
    vi.mocked(handleApiRoute).mockImplementation(async (request) => {
      // Simulating handleApiRoute authenticating the user and decorating request headers
      request.headers.set('x-user-id', 'usr_abc123');
      request.headers.set('x-user-role', 'admin');
      request.headers.set('x-user-tier', 'PRO');
      return null;
    });

    const res = await handleApiPipeline(req, '/api/v1/missions', 'vi', Date.now(), headers, 'nonce-1', false);

    expect(res?.status).toBe(200);
    // withAuth should NOT be called because userId is already resolved by handleApiRoute
    expect(withAuth).not.toHaveBeenCalled();
    // Headers must be propagated to requestHeaders
    expect(headers.get('x-user-id')).toBe('usr_abc123');
    expect(headers.get('x-user-role')).toBe('admin');
    expect(headers.get('x-user-tier')).toBe('PRO');
  });

  it('calls withAuth if handleApiRoute did not authenticate user on protected route and did not block', async () => {
    const req = new NextRequest('http://localhost/api/v1/missions');
    const headers = new Headers();

    vi.mocked(isPublicApiRoute).mockReturnValue(false);
    vi.mocked(handleApiRoute).mockResolvedValue(null);
    vi.mocked(withAuth).mockResolvedValue(NextResponse.json({ error: 'Unauthorized' }, { status: 401 }));

    const res = await handleApiPipeline(req, '/api/v1/missions', 'vi', Date.now(), headers, 'nonce-1', false);

    expect(res?.status).toBe(401);
    expect(withAuth).toHaveBeenCalledTimes(1);
  });
});
