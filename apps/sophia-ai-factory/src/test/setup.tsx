/**
 * Vitest Test Setup
 * Mocks Next.js modules, env vars, and Cloudflare bindings
 */

import * as React from 'react';
import { vi, beforeEach, afterEach } from 'vitest';

// ── D1 / R2 / KV mocks ───────────────────────────────────────────────────
function createD1Mock() {
  return {
    prepare: (_sql: string) => ({
      bind: (..._vals: unknown[]) => ({
        first: async () => null,
        all: async () => ({ results: [], meta: { changes: 0, duration: 1 } }),
        run: async () => ({ success: true, meta: { changes: 0, duration: 1 } }),
      }),
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

// ── Minimal NextResponse factory ─────────────────────────────────────────
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
  }>
) {
  mockNextResponseImplementation = {
    ...mockNextResponseImplementation,
    ...overrides,
  };
}

// vi.mock('next/server') mocks everything on next/server with one vi.fn()-based object.
// NextResponse.json and NextResponse.redirect are *property access*, but Module._e mocked it as a function. fs_react runs into the same error handling static/unbound behavior.
// With MockResponsePolicy above everything else can stay regular.
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

// ── Mock NextRequest on next/server ───────────────────────────────────────
// Needed because vi.mock('next/server') replaces the whole module with plain JSON.
// Tests still construct `new NextRequest(url)` from `next/server`.
vi.mock('next/server', () => {
  const base = {
    NextResponse: mockNextResponseImplementation,
  } as Record<string, unknown>;

  return {
    ...base,
    NextRequest: MockNextRequest,
  } as Record<string, unknown>;
});

// ── Mock next/link ───────────────────────────────────────────────────────
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
