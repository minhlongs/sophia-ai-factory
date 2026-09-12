/**
 * Vitest Test Setup
 * Mocks Next.js modules, env vars, and Cloudflare bindings
 */

import * as React from 'react';
import { vi } from 'vitest';

// ── D1 / R2 / KV mocks ───────────────────────────────────────────────────
function createD1Mock() {
  return {
    prepare: vi.fn().mockReturnValue({
      bind: vi.fn().mockImplementation((..._vals: unknown[]) => ({
        first: async () => null,
        all: async () => ({ results: [], meta: { changes: 0, duration: 1 } }),
        run: async () => ({ success: true, meta: { changes: 0, duration: 1 } }),
      })),
      first: async () => null as unknown as Record<string, unknown>,
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
  EXPERIMENT_KV: kvMock,
  DB: d1Mock,
  R2: r2Mock,
  NEXT_INC_CACHE_R2_BUCKET: r2Mock,
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
// Both (2) and (3) are satisfied by making the mock a class extending Response.
// This ensures `instanceof NextResponse` works for both constructor and static methods.
// The class-based form is kept because it provides the `.cookies` Map and
// `getSetCookie()` that middleware and route tests depend on, which the
// function-based alternative did not expose.
// ─────────────────────────────────────────────────────────────────────────

const GlobalResponse = globalThis.Response;

// Base class that properly extends Response
class NextResponseClass extends GlobalResponse {
  cookies: Map<string, string> = new Map();

  constructor(body?: BodyInit | null, init?: ResponseInit) {
    super(body, init);
  }

  // Override getSetCookie to return empty array (compatible with tests)
  getSetCookie(): string[] { return []; }
}

// Attach static factory methods (cast to avoid Response base-class type conflicts)
{
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const NRC = NextResponseClass as any;

  NRC.json = function(data: unknown, init?: { status?: number; headers?: Record<string, string> }): NextResponseClass {
    const body = typeof data === 'string' ? data : JSON.stringify(data);
    // Merge headers: user headers take precedence over defaults (case-insensitive)
    const userHeaders = init?.headers ?? {};
    const hasContentType = Object.keys(userHeaders).some(k => k.toLowerCase() === 'content-type');
    const headers: Record<string, string> = {
      ...(hasContentType ? {} : { 'content-type': 'application/json' }),
      ...userHeaders,
    };
    return new NextResponseClass(body, { status: init?.status ?? 200, headers });
  };

  NRC.redirect = function(url: string | URL, init?: { status?: number }): NextResponseClass {
    return new NextResponseClass(null, { status: init?.status ?? 307, headers: { location: typeof url === 'string' ? url : url.toString() } });
  };

  NRC.next = function(init?: { status?: number }): NextResponseClass {
    const res = new NextResponseClass(null, { status: init?.status ?? 200 });
    res.cookies = new Map();
    return res;
  };

  NRC.rewrite = function(_url: URL, _init?: { request?: { headers: Headers } }): NextResponseClass {
    const res = new NextResponseClass(null, { status: 200 });
    res.cookies = new Map();
    return res;
  };
}

// Exported mock binding
const NextResponseMock = NextResponseClass;

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
    super(urlStr, init);
    this.cookies = createCookieJar();
    this.nextUrl = new URL(urlStr, 'http://localhost');
    // Node.js URL has no native .clone(); add it to match real NextRequest.nextUrl contract
    // so that public-pipeline.ts `request.nextUrl.clone()` does not throw.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (this.nextUrl as any).clone = () => new URL(this.nextUrl.toString());
  }

  // @ts-expect-error - Cloudflare Request<…, Cf Properties<…>> LSP mismatch unavoidable for test mock; runtime clone() is correct — inversion verified, no compile error expected
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

// ── Headers polyfill for jsdom ──────────────────────────────────────────────
// jsdom's Headers stores values in a flat map but has spec mismatches
// (notably around case-insensitivity + MultiMap behavior) that cause
// .get()/forEach() to return null when values were set via NextResponse.json()
// headers option. Always override with a spec-compliant implementation.
// Refs: EVIDS-2026-001
type HeaderInit = [string, string][] | Record<string, string> | Headers;
class SpecCompliantHeaders {
  private _store = new Map<string, string[]>();
  constructor(init?: HeaderInit) {
    if (!init) return;
    if (Array.isArray(init)) {
      for (const [k, v] of init) this.append(k, v);
    } else if (init instanceof SpecCompliantHeaders) {
      init.forEach((v, k) => this.append(k, v));
    } else if (typeof init === 'object') {
      for (const [k, v] of Object.entries(init)) {
        if (Array.isArray(v)) {
          for (const val of v) this.append(k, val);
        } else {
          this.append(k, v);
        }
      }
    }
  }
  private normalize(name: string) { return name.toLowerCase(); }
  append(name: string, value: string) {
    const key = this.normalize(name);
    const cur = this._store.get(key) ?? [];
    cur.push(value);
    this._store.set(key, cur);
  }
  // set replaces instead of appending (for headers like content-type that should be single-valued)
  set(name: string, value: string) {
    this._store.set(this.normalize(name), [value]);
  }
  get(name: string) {
    const cur = this._store.get(this.normalize(name));
    return cur ? cur[cur.length - 1] : null;
  }
  has(name: string) { return this._store.has(this.normalize(name)); }
  delete(name: string) { return this._store.delete(this.normalize(name)); }
  forEach(
    callback: (value: string, key: string, parent: Headers) => void,
    thisArg?: unknown,
  ) {
    for (const [k, v] of this._store) {
      callback.call(thisArg, v[v.length - 1], k, this as unknown as Headers);
    }
  }
  keys() {
    const store = this._store;
    return {
      *[Symbol.iterator]() {
        for (const k of store.keys()) yield k;
      },
    };
  }
  values() {
    const store = this._store;
    return {
      *[Symbol.iterator]() {
        for (const v of store.values()) yield v[v.length - 1];
      },
    };
  }
  entries() {
    const store = this._store;
    return {
      *[Symbol.iterator]() {
        for (const [k, v] of store.entries()) yield [k, v[v.length - 1]];
      },
    };
  }
  [Symbol.iterator]() { return this.entries()[Symbol.iterator](); }
  get size() { return this._store.size; }
  // compat: native Headers has this enum-style property; Spec impl does not use it
  getSetCookie(): string[] { return []; }
}
(globalThis as unknown as { Headers: typeof SpecCompliantHeaders }).Headers = SpecCompliantHeaders;

// ── Suppress noisy console output ────────────────────────────────────────
globalThis.console = {
  ...globalThis.console,
  warn: vi.fn(),
  log: vi.fn(),
  error: globalThis.console.error,
};
