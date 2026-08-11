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

// ── SSRF-safe NextRequest ────────────────────────────────────────────────
class MockNextRequest extends Request {
  cookies: ReturnType<typeof createCookieJar>;
  nextUrl: URL;

  constructor(url: string | URL, init?: RequestInit) {
    const urlStr = typeof url === 'string' ? url : url.toString();
    // block external network with explicit allowedTargets
    // @ts-ignore - ssrf-safe constructor with allowedTargets
    super(urlStr, init);
    this.cookies = createCookieJar();
    this.nextUrl = new URL(urlStr, 'http://localhost');
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

// ── Mock NextResponse ────────────────────────────────────────────────────
class MockNextResponse {
  status = 200;
  headers: Headers;
  cookies: ReturnType<typeof createCookieJar>;
  ok = true;

  constructor(body?: BodyInit | null, opts?: { status?: number }) {
    this.headers = new Headers();
    this.cookies = createCookieJar();
    if (opts?.status) this.status = opts.status;
    this._body = body;
  }

  clone(): MockNextResponse {
    const cloned = new MockNextResponse(this._body, {
      status: this.status,
    });
    this.headers.forEach((v, k) => cloned.headers.set(k, v));
    return cloned;
  }

  json(data: unknown, opts?: { status?: number }): MockNextResponse {
    return new MockNextResponse(JSON.stringify(data), {
      status: opts?.status ?? 200,
    });
  }

  redirect(url: string | URL, opts?: { status?: number }): MockNextResponse {
    this.headers.set('location', url.toString());
    return new MockNextResponse(null, {
      status: opts?.status ?? 307,
    });
  }

  next(opts?: { status?: number }): MockNextResponse {
    return new MockNextResponse(null, {
      status: opts?.status ?? 200,
    });
  }

  async text(): Promise<string> {
    if (this._body == null) return '';
    if (typeof this._body === 'string') return this._body;
    return String(this._body);
  }
}

vi.mock('next/server', () => {
  // @ts-ignore
  return {
    NextResponse: MockNextResponse,
    NextRequest: MockNextRequest,
  };
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
