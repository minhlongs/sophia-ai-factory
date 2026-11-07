import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/forest/middleware/tenant-isolation', () => ({
  tenantIsolationMiddleware: vi.fn().mockResolvedValue(null),
}));

vi.mock('@/forest/middleware/agy-tenant-isolation', () => ({
  agyTenantIsolationMiddleware: vi.fn().mockResolvedValue(null),
}));

vi.mock('@/seed/security/rate-limiting-middleware', () => ({
  checkRateLimit: vi.fn().mockResolvedValue({
    success: true,
    reset: Date.now() + 60_000,
  }),
  getClientIdentifier: vi.fn().mockReturnValue('test-client'),
  RATE_LIMITS: {
    api: { maxRequests: 100, windowMs: 60_000 },
    auth: { maxRequests: 20, windowMs: 60_000 },
    webhook: { maxRequests: 100, windowMs: 60_000 },
    discovery: { maxRequests: 50, windowMs: 60_000 },
  },
}));

vi.mock('@/seed/auth/better-auth-session', () => {
  class AuthSystemError extends Error {
    constructor(message: string, public readonly cause?: unknown) {
      super(message);
      this.name = 'AuthSystemError';
    }
  }

  return {
    AuthSystemError,
    getCurrentUserFromHeaders: vi.fn(),
  };
});

vi.mock('@/seed/db/resolve-user-tier', () => ({
  resolveUserTier: vi.fn(),
}));

vi.mock('@/forest/middleware/auth-guard', () => ({
  isPublicApiRoute: vi.fn().mockReturnValue(false),
}));

vi.mock('@/tree/usage-metering', () => ({
  emitUsageEvent: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/seed/utils/logger-utility', () => ({
  logger: {
    error: vi.fn(),
  },
}));

vi.mock('@/seed/security/verify-internal-secret', () => ({
  verifyInternalSecret: vi.fn().mockReturnValue(true),
}));

vi.mock('@/tree/signals/track', () => ({
  track: vi.fn(),
}));

import {
  AuthSystemError,
  getCurrentUserFromHeaders,
} from '@/seed/auth/better-auth-session';
import { resolveUserTier } from '@/seed/db/resolve-user-tier';
import { emitUsageEvent } from '@/tree/usage-metering';
import { handleApiRoute } from '../api-handler';

const PATHNAME = '/api/v1/missions';

type AuthenticatedUser = NonNullable<
  Awaited<ReturnType<typeof getCurrentUserFromHeaders>>
>;

function request(): NextRequest {
  return new NextRequest(`http://localhost${PATHNAME}`);
}

async function expectServiceUnavailable(error: unknown): Promise<void> {
  vi.mocked(getCurrentUserFromHeaders).mockRejectedValueOnce(error);

  const response = await handleApiRoute(request(), PATHNAME, Date.now());

  expect(response?.status).toBe(503);
  await expect(response?.json()).resolves.toMatchObject({
    error: 'Service unavailable',
    retryAfter: 30,
  });
  expect(resolveUserTier).not.toHaveBeenCalled();
}

describe('handleApiRoute auth guard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(emitUsageEvent).mockResolvedValue(undefined);
  });

  it('returns 503 when session lookup throws an AuthSystemError', async () => {
    await expectServiceUnavailable(
      new AuthSystemError('session database unavailable'),
    );
  });

  it('returns 503 when session lookup throws an unexpected error', async () => {
    await expectServiceUnavailable(new Error('unexpected auth adapter failure'));
  });

  it('returns 503 when tier resolution throws unexpectedly', async () => {
    vi.mocked(getCurrentUserFromHeaders).mockResolvedValueOnce({
      id: 'user-1',
      email: 'user@example.test',
      role: 'user',
    } as AuthenticatedUser);
    vi.mocked(resolveUserTier).mockRejectedValueOnce(
      new Error('tier database unavailable'),
    );

    const req = request();
    const response = await handleApiRoute(req, PATHNAME, Date.now());

    expect(response?.status).toBe(503);
    expect(req.headers.get('x-user-id')).toBe('user-1');
    expect(req.headers.get('x-user-tier')).toBeNull();
  });

  it('keeps the blocking 503 response when usage emission fails', async () => {
    vi.mocked(emitUsageEvent).mockRejectedValueOnce(
      new Error('usage sink unavailable'),
    );

    await expectServiceUnavailable(new Error('auth unavailable'));

    await vi.waitFor(() => {
      expect(emitUsageEvent).toHaveBeenCalledWith(
        expect.any(NextRequest),
        expect.objectContaining({ status: 503 }),
        { tier: 'BASIC' },
      );
    });
  });

  it('returns 401 when no authenticated user exists', async () => {
    vi.mocked(getCurrentUserFromHeaders).mockResolvedValueOnce(null);

    const response = await handleApiRoute(request(), PATHNAME, Date.now());

    expect(response?.status).toBe(401);
    expect(resolveUserTier).not.toHaveBeenCalled();
  });

  it('decorates an authenticated request and allows the pipeline to continue', async () => {
    vi.mocked(getCurrentUserFromHeaders).mockResolvedValueOnce({
      id: 'user-1',
      email: 'user@example.test',
      role: 'admin',
    } as AuthenticatedUser);
    vi.mocked(resolveUserTier).mockResolvedValueOnce('PREMIUM');

    const req = request();
    const response = await handleApiRoute(req, PATHNAME, Date.now());

    expect(response).toBeNull();
    expect(req.headers.get('x-user-id')).toBe('user-1');
    expect(req.headers.get('x-user-role')).toBe('admin');
    expect(req.headers.get('x-user-tier')).toBe('PREMIUM');
  });
});
