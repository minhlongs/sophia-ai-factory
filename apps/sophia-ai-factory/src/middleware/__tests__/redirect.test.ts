import { NextRequest, NextResponse } from 'next/server';
import { describe, expect, it, vi, beforeEach } from 'vitest';

const mockGetSessionFromHeaders = vi.fn();
const mockIsSessionMfaPending = vi.fn();
const mockGetD1 = vi.fn();

vi.mock('@/seed/auth/better-auth-session', () => ({
  getSessionFromHeaders: (...args: unknown[]) => mockGetSessionFromHeaders(...args),
}));

vi.mock('@/seed/auth/mfa/login-challenge', () => ({
  isSessionMfaPending: (...args: unknown[]) => mockIsSessionMfaPending(...args),
}));

vi.mock('@/seed/db/client', () => ({
  getD1: () => mockGetD1(),
}));

import { handlePublicPipeline } from '../public-pipeline';
import { handleDashboardPipeline } from '../dashboard-pipeline';
import { pathnameWithoutLocale } from '../helpers';
import { SUPPORTED_LOCALES } from '../middleware-shared-config';

describe('middleware redirect behavior', () => {
  it('produces a 307 redirect to /login', () => {
    const res = NextResponse.redirect('/login');
    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toBe('/login');
  });

  it('produces a 307 redirect to /signup', () => {
    const res = NextResponse.redirect('/signup');
    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toBe('/signup');
  });

  it('redirects to bare /login path (not locale-prefixed)', () => {
    const res = NextResponse.redirect('/login');
    expect(res.headers.get('location')).toBe('/login');
    expect(res.headers.get('location')).not.toContain('/vi');
  });

  it('NextResponse.next returns 200 with no location header', () => {
    const res = NextResponse.next();
    expect(res.status).toBe(200);
    expect(res.headers.get('location')).toBeNull();
  });
});

describe('middleware /dashboard/login redirect', () => {
  const runPublic = (path: string) =>
    handlePublicPipeline(
      new NextRequest(`http://localhost${path}`),
      'undefined' as unknown as string,
      new Headers(),
      'nonce',
      false,
    );

  it('redirects bare /dashboard/login to /login', async () => {
    const res = await runPublic('/dashboard/login');
    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toBe('http://localhost/login');
    expect(res.headers.get('content-security-policy')).toContain('nonce-nonce');
    expect(res.headers.get('strict-transport-security')).toContain('max-age=31536000');
  });

  it('redirects bare /dashboard/signup to /signup', async () => {
    const res = await runPublic('/dashboard/signup');
    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toBe('http://localhost/signup');
    expect(res.headers.get('content-security-policy')).toContain('nonce-nonce');
  });

  it('does not redirect bare /dashboard to /dashboard/login', async () => {
    const res = await runPublic('/dashboard');
    expect(res.status).not.toBe(307);
  });

  it('does not redirect /vi/dashboard/login in loop', async () => {
    const res = await runPublic('/vi/dashboard/login');
    expect(res.status).not.toBe(307);
  });
});

describe('middleware /setup-wizard canonical onboarding redirect across all 12 locales', () => {
  it('redirects bare /setup-wizard and /setup-wizard/ to /vi/setup', async () => {
    for (const rawPath of ['/setup-wizard', '/setup-wizard/']) {
      const req = new NextRequest(`http://localhost${rawPath}`);
      const res = await handlePublicPipeline(req, null, new Headers(), 'nonce', true);
      expect(res.status).toBe(307);
      expect(res.headers.get('location')).toBe('http://localhost/vi/setup');
      expect(res.headers.get('content-security-policy')).toContain('nonce-nonce');
      expect(res.headers.get('strict-transport-security')).toContain('max-age=31536000');
      expect(res.headers.get('set-cookie')).toContain('csrf');
    }
  });

  it('redirects /[locale]/setup-wizard and /[locale]/setup-wizard/ to /[locale]/setup for every SUPPORTED_LOCALES entry', async () => {
    expect(SUPPORTED_LOCALES).toHaveLength(12);
    for (const locale of SUPPORTED_LOCALES) {
      for (const suffix of ['/setup-wizard', '/setup-wizard/']) {
        const req = new NextRequest(`http://localhost/${locale}${suffix}`);
        const res = await handlePublicPipeline(req, null, new Headers(), 'nonce', false);
        expect(res.status).toBe(307);
        expect(res.headers.get('location')).toBe(`http://localhost/${locale}/setup`);
        expect(res.headers.get('content-security-policy')).toContain('nonce-nonce');
      }
    }
  });
});

describe('middleware 12-locale dashboard guard & (app)-only route rewrites', () => {
  beforeEach(() => {
    mockGetSessionFromHeaders.mockReset();
    mockIsSessionMfaPending.mockReset();
    mockGetD1.mockReset();
  });

  it('strips all 12 SUPPORTED_LOCALES in pathnameWithoutLocale while leaving unknown prefixes intact', () => {
    for (const locale of SUPPORTED_LOCALES) {
      expect(pathnameWithoutLocale(`/${locale}/dashboard/niche-studio`)).toBe('/dashboard/niche-studio');
      expect(pathnameWithoutLocale(`/${locale}`)).toBe('/');
    }
    expect(pathnameWithoutLocale('/foo/dashboard')).toBe('/foo/dashboard');
  });

  it('does NOT strip invalid locale prefixes like /foo/dashboard in handlePublicPipeline', async () => {
    const headers = new Headers();
    const req = new NextRequest('http://localhost/foo/dashboard');
    const res = await handlePublicPipeline(req, null, headers, 'nonce-1', false);
    expect(headers.get('x-next-intl-locale')).toBeNull();
    expect(res.cookies.get('NEXT_LOCALE')).toBeUndefined();
  });

  it('enforces auth redirect to /{locale}/login for all 12 locales on /{locale}/dashboard/*', async () => {
    mockGetSessionFromHeaders.mockResolvedValue(null);
    for (const locale of SUPPORTED_LOCALES) {
      const req = new NextRequest(`http://localhost/${locale}/dashboard/ceo-agent`);
      const res = await handleDashboardPipeline(req, locale, new Headers(), 'nonce-auth', false);
      expect(res).not.toBeNull();
      expect(res?.status).toBe(307);
      expect(res?.headers.get('location')).toBe(`http://localhost/${locale}/login`);
    }
  });

  it('rewrites authenticated /{locale}/dashboard/admin/byok-rotation to /dashboard/admin/byok-rotation with x-next-intl-locale forwarded while keeping [locale] routes untouched', async () => {
    const rewriteSpy = vi.spyOn(NextResponse, 'rewrite');
    mockGetSessionFromHeaders.mockResolvedValue({
      user: { id: 'admin-1', email: 'admin@sophia.test', role: 'admin' },
      session: { id: 'sess-1' },
    });
    mockIsSessionMfaPending.mockResolvedValue(false);
    mockGetD1.mockResolvedValue({
      prepare: (sql: string) => ({
        bind: () => ({
          first: async () =>
            sql.includes('subscriptions') ? { tier: 'MASTER', plan: 'MASTER' } : { role: 'admin' },
        }),
      }),
    });

    const appOnlyHeaders = new Headers();
    const appOnlyReq = new NextRequest('http://localhost/en/dashboard/admin/byok-rotation?tab=keys');
    const appOnlyRes = await handleDashboardPipeline(appOnlyReq, 'en', appOnlyHeaders, 'nonce-admin', false);

    expect(appOnlyRes).not.toBeNull();
    expect(appOnlyHeaders.get('x-next-intl-locale')).toBe('en');
    expect(rewriteSpy).toHaveBeenCalledTimes(1);
    const rewrittenUrl = rewriteSpy.mock.calls[0]?.[0] as URL;
    expect(rewrittenUrl.toString()).toBe(
      'http://localhost/dashboard/admin/byok-rotation?tab=keys',
    );
    expect(appOnlyRes?.cookies.get('NEXT_LOCALE')).toBe('en');
    expect(appOnlyRes?.headers.get('content-security-policy')).toContain('nonce-nonce-admin');

    // A [locale]-owned dashboard route must NOT be rewritten away from /[locale]/...
    rewriteSpy.mockClear();
    const localeOwnedHeaders = new Headers();
    const localeOwnedReq = new NextRequest('http://localhost/en/dashboard/niche-studio');
    const localeOwnedRes = await handleDashboardPipeline(
      localeOwnedReq,
      'en',
      localeOwnedHeaders,
      'nonce-studio',
      false,
    );
    expect(localeOwnedRes).not.toBeNull();
    expect(rewriteSpy).not.toHaveBeenCalled();
    rewriteSpy.mockRestore();
  });
});
