/**
 * Vitest Test Setup
 * Mocks Next.js modules, env vars, and Cloudflare bindings
 */

import * as React from 'react';
import { vi, beforeEach, afterEach } from 'vitest';

// ── D1 / R2 / KV mocks ───────────────────────────────────────────────────
function createD1Mock() {
  return {
    prepare: vi.fn().mockReturnValue({
      bind: vi.fn().mockImplementation((..._vals: unknown[]) => ({
        first: async () => null,
        all: async () => ({ results: [], meta: { changes: 0, duration: 1 } }),
        run: async () => ({ success: true, meta: { changes: 0, duration: 1 } }),
      })),
      first: async () => null as any,
      all: async () => ({ results: [], meta: { changes: 0, duration: 1 } }),
      run: async () => ({ success: true, meta: { changes: 0, duration: 1 } }),
    }),
    batch: async (_stmts: unknown[]) => {},
    exec: async (_sql: string) => ({ results: [], meta: { changes: 0 } }),
    dump: async () => ({ data: '' }),
    transaction: { statements: [] },
  };
}

const d1Mock = createD1Mock();
const r2Mock = {
  put: vi.fn().mockResolvedValue(undefined),
  get: vi.fn().mockResolvedValue(null),
  delete: vi.fn().mockResolvedValue({}),
  list: vi.fn().mockResolvedValue({ objects: [], truncated: false }),
  head: vi.fn().mockResolvedValue(null),
};
const kvMock = {
  get: vi.fn(),
  put: vi.fn(),
  delete: vi.fn(),
  list: vi.fn(),
};

(globalThis as Record<string, unknown>).__env = {
  KV: kvMock,
  DB: d1Mock,
  R2: r2Mock,
};

// ── NextResponse mock ─────────────────────────────────────────────────────
//
// Tests need three things from the NextResponse mock:
//
// 1. Static factory methods used across the codebase:
//
//      NextResponse.json(data, { status })
//      NextResponse.redirect(url, { status })
//      NextResponse.next({ status })
//
// 2. Constructor usage:
//
//      new NextResponse(body?, init?)
//
//    This is required by:
//    - `src/middleware/middleware-api-handler.ts` (new NextResponse(…, { status }))
//    - many API route tests that write:
//        new NextResponse(JSON.stringify({ error }), { status: 401 })
//    - the SSE mission stream route (`src/app/api/v1/missions/[id]/stream/route.ts`)
//      which returns an event-stream body typed as `NextResponse`.
//
// 3. instanceof checks:
//
//      if (authResult instanceof NextResponse) return authResult;
//
//    Used in middleware pipelines and admin guards.
//    When tests use vi.mock('next/server', …) with a function-based mock the
//    binding that instanceof sees is the same function object, so we make
//    the mock function's prototype equal to the Response prototype.
//
// Both (2) and (3) are satisfied by making the mock function itself the
// Response constructor (because in jsdom `new Response(...)` is callable)
// and assigning its prototype to `Response.prototype`.
// ─────────────────────────────────────────────────────────────────────────

const GlobalResponse =
  // jsdom always has a global Response; vitest is fine with it.
  // Keep the explicit cast to satisfy TS when the global is missing.
  globalThis.Response;

function nextResponseFactoryFn(
  this: Response,
  body?: BodyInit | null,
  init?: ResponseInit,
): Response {
  if (body instanceof Response) return body;
  return new GlobalResponse(body, init);
}

// Make `instanceof NextResponse` true for any Response produced by this mock.
Object.setPrototypeOf(nextResponseFactoryFn, GlobalResponse);
Object.setPrototypeOf(nextResponseFactoryFn.prototype, GlobalResponse.prototype);

// Attach the static factory methods
const withResponseProperties = (response: Response, body: BodyInit | null, init: ResponseInit = {}) => {
  Object.defineProperties(response, {
    body: { value: body, enumerable: true, writable: true, configurable: true },
    headers: { value: new Headers((init.headers as Record<string, string> | undefined) ?? {}), enumerable: true, writable: true, configurable: true },
    status: { value: (init.status as number | undefined) ?? 200, enumerable: true, writable: true, configurable: true },
    statusText: { value: init.statusText ?? '', enumerable: true, writable: true, configurable: true },
    ok: { get() { const s = (init.status as number | undefined) ?? 200; return s >= 200 && s < 300; }, enumerable: true, configurable: true },
  });
  (response as unknown as Record<string, unknown>).json = () => Promise.resolve(typeof body === 'string' ? JSON.parse(body) : body);
};

nextResponseFactoryFn.json = (data: unknown, init?: { status?: number }): Response => {
  const body = typeof data === 'string' ? data : JSON.stringify(data);
  const response = Object.create(nextResponseFactoryFn.prototype) as Response;
  withResponseProperties(response, body, { status: init?.status ?? 200, headers: { 'content-type': 'application/json' } });
  return response;
};

nextResponseFactoryFn.redirect = (url: string | URL, init?: { status?: number }): Response => {
  const response = Object.create(nextResponseFactoryFn.prototype) as Response;
  withResponseProperties(response, null, { status: init?.status ?? 307, headers: { location: typeof url === 'string' ? url : url.toString() } });
  return response;
};

nextResponseFactoryFn.next = (init?: { status?: number }): Response => {
  const response = Object.create(nextResponseFactoryFn.prototype) as Response;
  withResponseProperties(response, null, { status: init?.status ?? 200 });
  return response;
};

// Exported mock binding
const NextResponseMock = nextResponseFactoryFn;

// ── Mock NextRequest on next/server ───────────────────────────────────────
// Needed because vi.mock('next/server') replaces the whole module with plain JSON.
// Tests still construct `new NextRequest(url)` from `next/server`.
vi.mock('next/server', () => ({
  NextResponse: NextResponseMock,
  NextRequest: MockNextRequest,
}));

// ── Minimal NextRequest factory ───────────────────────────────────────────
let mockNextResponseImplementation: {
  json: (data: unknown, init?: { status?: number }) => Response;
  redirect: (url: string | URL, init?: { status?: number }) => Response;
  next: (init?: { status?: number }) => Response;
} = {
  json: (data: unknown, init?: { status?: number }) => {
    const body = typeof data === 'string' ? data : JSON.stringify(data);
    return new Response(body, {
      status: init?.status ?? 200,
      headers: { 'content-type': 'application/json' },
    });
  },
  redirect: (url: string | URL, init?: { status?: number }) => {
    return new Response(null, {
      status: init?.status ?? 307,
      headers: { location: typeof url === 'string' ? url : url.toString() },
    });
  },
  next: (init?: { status?: number }) => {
    return new Response(null, { status: init?.status ?? 200 });
  },
};

export function configureNextResponse(
  overrides: Partial<{
    json: (data: unknown, init?: { status?: number }) => Response;
    redirect: (url: string | URL, init?: { status?: number }) => Response;
    next: (init?: { status?: number }) => Response;
  }>,
) {
  mockNextResponseImplementation = {
    ...mockNextResponseImplementation,
    ...overrides,
  };
}

// ── SSRF-safe NextRequest ────────────────────────────────────────────────
class MockNextRequest extends Request {
  cookies: ReturnType<typeof createCookieJar>;
  nextUrl: URL;

  constructor(url: string | URL, init?: RequestInit) {
    const urlStr = typeof url === 'string' ? url : url.toString();
    // @ts-ignore - ssrf-safe constructor with allowedTargets
    super(urlStr, init);
    this.cookies = createCookieJar();
    this.nextUrl = new URL(urlStr, 'http://localhost');
    // Node.js URL has no native .clone(); add it to match real NextRequest.nextUrl contract
    // so that public-pipeline.ts `request.nextUrl.clone()` does not throw.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (this.nextUrl as any).clone = () => new URL(this.nextUrl.toString());
  }

  // @ts-ignore - Cloudflare Request<…, Cf Properties<…>> LSP mismatch unavoidable for test mock; runtime clone() is correct
  clone(): Request {
    const cloneUrl = this.nextUrl.toString();
    const cloned = new MockNextRequest(cloneUrl);
    return cloned as unknown as Request;
  }
}

function createCookieJar() {
  const store = new Map();
  return {
    get: (name: string) => {
      const v = store.get(name);
      return v ? { name, value: v } : undefined;
    },
    getAll: () => Array.from(store.entries()).map(([name, value]) => ({ name, value })),
    set: (name: string, value: string) => {
      store.set(name, value);
    },
    delete: (name: string) => {
      store.delete(name);
    },
    deleteAll: () => {
      store.clear();
    },
    has: (name: string) => {
      return store.has(name);
    },
    [Symbol.iterator]: function* () {
      for (const [name, value] of store) {
        yield { name, value };
      }
    },
    *entries() {
      for (const [name, value] of store) {
        yield [name, value] as [string, string];
      }
    },
    get size() {
      return store.size;
    },
  };
}

// ── Mock next/link ────────────────────────────────────────────────────────
type LinkProps = Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, 'href'> & {
  href?: string | (() => string);
  children?: React.ReactNode;
};
vi.mock('next/link', () => ({
  __esModule: true,
  default: ({ children, href, ...props }: LinkProps) => {
    const h = typeof href === 'function' ? href() : href;
    return <a href={h} {...props}>{children}</a>;
  },
}));

// ── Suppress noisy console output ────────────────────────────────────────
globalThis.console = {
  ...globalThis.console,
  warn: vi.fn(),
  log: vi.fn(),
  error: globalThis.console.error,
};
