/**
 * Vitest Test Setup
 * Mocks Next.js modules, env vars, and Cloudflare bindings
 */

import * as React from 'react';
import { vi, beforeEach } from 'vitest';

// Clear shared singletons before EVERY test across the suite.
// Prevents flaky failures from cross-file state leaks — most notably
// `globalRateLimiter` which is a module-level singleton: tests that
// don't explicitly call .clear() can see entries from prior test files
// and trip assertions like rate-limiter.test.ts line 242 (`allowed: true`).
//
// Dynamic import to avoid hoist-order issue: `rate-limiter.ts` imports
// `next/server` which is mocked below — a top-level import would resolve
// before the mock is wired.
beforeEach(async () => {
  const { globalRateLimiter } = await import('@/forest/middleware/rate-limiter');
  globalRateLimiter.clear();
});

// ── Environment Variables ──────────────────────────────────────────────
process.env.JWT_SECRET=REDACTED = 'test-jwt-secret-for-unit-tests-32chars!';
process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key-eyJhbGciOiJIUzI1NiJ9';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key';
process.env.INTERNAL_API_SECRET = 'test-internal-secret';
process.env.UPSTASH_REDIS_REST_URL = 'https://test-redis.upstash.io';
process.env.UPSTASH_REDIS_REST_TOKEN = 'test-redis-token';
process.env.RAAS_LICENSE_SECRET = 'test-raas-license-secret';
process.env.HEALTH_CHECK_SECRET = 'test-health-secret';
process.env.NEXT_PUBLIC_APP_URL = 'http://localhost:3000';
process.env.NEXT_PUBLIC_IS_CONFIGURED = 'true';

// ── Cloudflare KV Mock (functional in-memory store) ───────────────────
// Uses a real Map so rateLimitGate and other KV-backed code works correctly in tests.
const _kvStore = new Map<string, string>();
const kvMock = {
  get: vi.fn(async (key: string) => _kvStore.get(key) ?? null),
  put: vi.fn(async (key: string, value: string) => { _kvStore.set(key, value); }),
  delete: vi.fn(async (key: string) => { _kvStore.delete(key); }),
  list: vi.fn().mockResolvedValue({ keys: [], list_complete: true }),
};
// Expose store reset helper for beforeEach usage in tests
(globalThis as Record<string, unknown>).__kvStore = _kvStore;
(globalThis as Record<string, unknown>).KV_KV = kvMock;

// ── Cloudflare D1 Mock ─────────────────────────────────────────────────
// Must be a truthy object with .prepare() to satisfy getD1Sync() check.
const d1Mock = {
  prepare: vi.fn().mockReturnValue({
    bind: vi.fn().mockReturnThis(),
    first: vi.fn().mockResolvedValue(null),
    all: vi.fn().mockResolvedValue({ results: [], success: true }),
    run: vi.fn().mockResolvedValue({ success: true, meta: {} }),
  }),
  dump: vi.fn().mockResolvedValue(new ArrayBuffer(0)),
  batch: vi.fn().mockResolvedValue([]),
  exec: vi.fn().mockResolvedValue({ count: 0, duration: 0 }),
};
(globalThis as Record<string, unknown>).__env = { KV: kvMock, DB: d1Mock };

// ── Mock next/link ─────────────────────────────────────────────────────
type LinkProps = Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, 'href'> & {
  href?: string | (() => string);
  children?: React.ReactNode;
};
vi.mock('next/link', () => ({
  default: ({ children, href, ...props }: LinkProps) => {
    const h = typeof href === 'function' ? href() : href;
    return <a href={h} {...props}>{children}</a>;
  },
}));

// ── Mock next/image ────────────────────────────────────────────────────
vi.mock('next/image', () => ({
  default: ({ src, alt, ...props }: React.ImgHTMLAttributes<HTMLImageElement>) => {
    return <img src={src} alt={alt} {...props} />;
  },
}));

// ── Mock next/navigation ───────────────────────────────────────────────
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(), replace: vi.fn(), prefetch: vi.fn(),
    back: vi.fn(), refresh: vi.fn(),
  }),
  usePathname: () => '/',
  useSearchParams: () => new URLSearchParams(),
  redirect: (url: string) => { throw new Error(`Redirect: ${url}`); },
  permanentRedirect: (url: string) => { throw new Error(`Permanent Redirect: ${url}`); },
  notFound: () => { throw new Error('Not Found'); },
}));

// ── Mock next/server (NextResponse as proper class) ────────────────────
class MockNextResponse extends Response {
  // Make instanceof checks work properly by returning MockNextResponse instances
  static json(data: unknown, init?: ResponseInit) {
    const headers = new Headers({ 'content-type': 'application/json', ...init?.headers });
    return new MockNextResponse(JSON.stringify(data), {
      ...init,
      headers,
    });
  }
  static redirect(url: string, status?: number) {
    return new MockNextResponse(null, { status: status ?? 302, headers: { location: url } });
  }
  static rewrite() { return new MockNextResponse(null, { status: 200 }); }
  static next() { return new MockNextResponse(null, { status: 200 }); }
}

// Wraps URLSearchParams so .get() returns undefined instead of null for missing keys
// This matches how Zod .optional() schema expects undefined, not null
class NullSafeSearchParams extends URLSearchParams {
  get(name: string): string | null {
    const val = super.get(name);
    return val === null ? (undefined as unknown as null) : val;
  }
}

class MockNextRequest extends Request {
  cookies = { get: vi.fn(), getAll: vi.fn(() => []), set: vi.fn() };
  nextUrl: { pathname: string; searchParams: NullSafeSearchParams };

  constructor(url: string | URL, init?: RequestInit & { method?: string; headers?: Record<string, string> | Headers }) {
    const urlStr = typeof url === 'string' ? url : url.toString();
    super(urlStr, init);
    const parsed = new URL(urlStr, 'http://localhost');
    this.nextUrl = { pathname: parsed.pathname, searchParams: new NullSafeSearchParams(parsed.search) };
  }
}

vi.mock('next/server', () => ({
  NextResponse: MockNextResponse,
  NextRequest: MockNextRequest,
}));

// ── Suppress noisy console output ──────────────────────────────────────
globalThis.console = {
  ...globalThis.console,
  error: vi.fn(),
  warn: vi.fn(),
  log: vi.fn(),
};
