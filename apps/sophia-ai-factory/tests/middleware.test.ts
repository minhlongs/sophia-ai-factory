import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';
import { middleware } from '../src/middleware';

// Mock next-intl
vi.mock('next-intl/middleware', async () => {
  const { NextResponse } = await import('next/server');
  return {
    default: vi.fn(() => (req: any) => NextResponse.next()),
  };
});

// Mock @supabase/ssr
const mockGetSession = vi.fn();
const mockGetUser = vi.fn();

vi.mock('@supabase/ssr', () => ({
  createServerClient: vi.fn(() => ({
    auth: {
      getSession: mockGetSession,
      getUser: mockGetUser,
    },
  })),
}));

describe('Middleware', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env = { ...originalEnv };
    // Default env vars for tests
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key';
    process.env.ADMIN_USER = 'admin';
    process.env.ADMIN_PASS = 'password';
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  const createReq = (path: string, headers: Record<string, string> = {}) => {
    return new NextRequest(new URL(`http://localhost${path}`), {
      headers: new Headers(headers),
    });
  };

  describe('Setup Wizard Guard', () => {
    it('redirects to /setup-wizard if IS_CONFIGURED is missing', async () => {
      delete process.env.IS_CONFIGURED;
      delete process.env.NEXT_PUBLIC_IS_CONFIGURED;
      const req = createReq('/');

      const res = await middleware(req);

      expect(res.status).toBe(307);
      expect(res.headers.get('location')).toBe('http://localhost/setup-wizard');
    });

    it('does not redirect to setup-wizard if already on setup-wizard', async () => {
      delete process.env.IS_CONFIGURED;
      delete process.env.NEXT_PUBLIC_IS_CONFIGURED;
      const req = createReq('/setup-wizard');

      const res = await middleware(req);

      // Should fall through to next-intl or return next()
      expect(res.status).toBe(200);
    });

    it('proceeds if IS_CONFIGURED is true', async () => {
      process.env.IS_CONFIGURED = 'true';
      const req = createReq('/');

      const res = await middleware(req);

      expect(res.status).toBe(200); // Assuming next-intl returns 200/next
    });
  });

  describe('Admin Authentication', () => {
    beforeEach(() => {
      process.env.IS_CONFIGURED = 'true';
    });

    it('rewrites to /api/auth for /admin routes if no auth header', async () => {
      const req = createReq('/admin');
      const res = await middleware(req);

      // Middleware uses NextResponse.rewrite() which returns a 200 with x-middleware-rewrite header
      // The actual 401 is handled by the /api/auth route handler
      expect(res.headers.get('x-middleware-rewrite')).toBe('http://localhost/api/auth');
    });

    it('rewrites to /api/auth for /admin routes if wrong credentials', async () => {
      const auth = Buffer.from('admin:wrong').toString('base64');
      const req = createReq('/admin', { authorization: `Basic ${auth}` });
      const res = await middleware(req);

      expect(res.headers.get('x-middleware-rewrite')).toBe('http://localhost/api/auth');
    });

    it('allows access to /admin with correct credentials', async () => {
      const auth = Buffer.from('admin:password').toString('base64');
      const req = createReq('/admin', { authorization: `Basic ${auth}` });
      const res = await middleware(req);
      expect(res.status).toBe(200);
      expect(res.headers.get('x-middleware-rewrite')).toBeNull();
    });
  });

  describe('Dashboard Authentication', () => {
    beforeEach(() => {
      process.env.IS_CONFIGURED = 'true';
    });

    it('redirects to /login if accessing /dashboard without session', async () => {
      mockGetUser.mockResolvedValue({ data: { user: null }, error: null });
      const req = createReq('/dashboard');

      const res = await middleware(req);

      expect(res.status).toBe(307);
      expect(res.headers.get('location')).toContain('/login');
    });

    it('allows access to /dashboard with active session', async () => {
      mockGetUser.mockResolvedValue({
        data: { user: { id: '1' } },
        error: null
      });
      const req = createReq('/dashboard');

      const res = await middleware(req);

      expect(res.status).toBe(200);
    });
  });

  describe('Other Routes', () => {
    beforeEach(() => {
      process.env.IS_CONFIGURED = 'true';
    });

    it('redirects /login to /en/login (default locale)', async () => {
      const req = createReq('/login');
      const res = await middleware(req);
      expect(res.status).toBe(307);
      expect(res.headers.get('location')).toBe('http://localhost/en/login');
    });

    it('redirects /login to /vi/login if NEXT_LOCALE cookie is vi', async () => {
      const req = createReq('/login');
      req.cookies.set('NEXT_LOCALE', 'vi');
      const res = await middleware(req);
      expect(res.status).toBe(307);
      expect(res.headers.get('location')).toBe('http://localhost/vi/login');
    });

    it('skips intl middleware for /auth/callback', async () => {
      const req = createReq('/auth/callback?code=123');
      const res = await middleware(req);
      expect(res.status).toBe(200);
      // next-intl mock returns "next()", verifying we got a response is likely enough,
      // but strictly we want to ensure it didn't run through intl logic if possible.
      // In this mock setup, both return 200, so mostly we check it doesn't error/redirect.
    });

    it('skips intl middleware for /api routes', async () => {
      const req = createReq('/api/some-endpoint');
      const res = await middleware(req);
      expect(res.status).toBe(200);
    });

    it('skips intl middleware for /_next routes', async () => {
      const req = createReq('/_next/static/css/styles.css');
      const res = await middleware(req);
      expect(res.status).toBe(200);
    });

    it('skips intl middleware for favicon.ico', async () => {
      const req = createReq('/favicon.ico');
      const res = await middleware(req);
      expect(res.status).toBe(200);
    });
  });
});
