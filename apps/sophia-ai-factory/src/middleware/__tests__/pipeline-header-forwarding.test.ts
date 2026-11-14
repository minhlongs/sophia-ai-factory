/**
 * Regression suite verifying that `handlePublicPipeline` and `handleDashboardPipeline`
 * preserve mutated upstream request headers (`x-csp-nonce`, `x-tenant-id`,
 * `x-next-intl-locale`) inside `x-middleware-override-headers` after `intlMiddleware`
 * runs, preventing per-request CSP nonces and tenant context from being dropped on
 * Server Component renders.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('next/server', async () => await vi.importActual('next/server'));

import { NextRequest } from 'next/server';

const mockGetSessionFromHeaders = vi.fn();
const mockIsSessionMfaPending = vi.fn();

vi.mock('@/seed/auth/better-auth-session', () => ({
  getSessionFromHeaders: (...args: unknown[]) => mockGetSessionFromHeaders(...args),
}));

vi.mock('@/seed/auth/mfa/login-challenge', () => ({
  isSessionMfaPending: (...args: unknown[]) => mockIsSessionMfaPending(...args),
}));

vi.mock('@/seed/db/client', () => ({
  getD1: vi.fn().mockResolvedValue(null),
}));

import { handlePublicPipeline } from '../public-pipeline';
import { handleDashboardPipeline } from '../dashboard-pipeline';

describe('middleware pipeline request-header forwarding', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('preserves x-csp-nonce and x-tenant-id in handlePublicPipeline after intlMiddleware', async () => {
    const req = new NextRequest('http://localhost/vi/pricing');
    const requestHeaders = new Headers(req.headers);
    requestHeaders.set('x-csp-nonce', 'nonce-public-123');
    requestHeaders.set('x-tenant-id', 'org-acme-01');

    const res = await handlePublicPipeline(
      req,
      null,
      requestHeaders,
      'nonce-public-123',
      false,
    );

    expect(res.status).toBe(200);
    const overrides = (res.headers.get('x-middleware-override-headers') ?? '').split(',');
    expect(overrides).toContain('x-csp-nonce');
    expect(overrides).toContain('x-tenant-id');
    expect(res.headers.get('x-middleware-request-x-csp-nonce')).toBe('nonce-public-123');
    expect(res.headers.get('x-middleware-request-x-tenant-id')).toBe('org-acme-01');
    expect(res.headers.get('x-middleware-request-x-next-intl-locale')).toBe('vi');
  });

  it('preserves x-csp-nonce and x-tenant-id in handleDashboardPipeline after intlMiddleware', async () => {
    mockGetSessionFromHeaders.mockResolvedValueOnce({
      session: { id: 'sess_1' },
      user: { id: 'usr_1', email: 'founder@sophia.test' },
    });
    mockIsSessionMfaPending.mockResolvedValueOnce(false);

    const req = new NextRequest('http://localhost/en/dashboard');
    const requestHeaders = new Headers(req.headers);
    requestHeaders.set('x-csp-nonce', 'nonce-dash-456');
    requestHeaders.set('x-tenant-id', 'org-acme-02');

    const res = await handleDashboardPipeline(
      req,
      'en',
      requestHeaders,
      'nonce-dash-456',
      false,
    );

    expect(res).not.toBeNull();
    expect(res?.status).toBe(200);
    const overrides = (res?.headers.get('x-middleware-override-headers') ?? '').split(',');
    expect(overrides).toContain('x-csp-nonce');
    expect(overrides).toContain('x-tenant-id');
    expect(res?.headers.get('x-middleware-request-x-csp-nonce')).toBe('nonce-dash-456');
    expect(res?.headers.get('x-middleware-request-x-tenant-id')).toBe('org-acme-02');
    expect(res?.headers.get('x-middleware-request-x-next-intl-locale')).toBe('en');
  });
});
