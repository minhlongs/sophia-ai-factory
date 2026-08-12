/**
 * Vitest Test Setup
 * Mocks Next.js modules, env vars, and Cloudflare bindings
 */

import * as React from 'react';
import { vi } from 'vitest';

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

// ── NextResponse mock ─────────────────────────────────────────────────────
//
// Tests need three things from the NextResponse mock:
// 1) Static factory methods: NextResponse.json / .redirect / .next
// 2) Constructor support: new NextResponse(body?, init?)
// 3) instanceof NextResponse checks in middleware/guards
//
// Both 2 and 3 are satisfied by a single mock object whose prototype chain
// reaches the real global Response.  The mock is callable as a function (tests
// do `NextResponse.json(...)`) and constructable (production code does
// `new NextResponse(body, init)`).  `instanceof NextResponse` checks succeed
// because every Response returned by the mock carries NextResponseMock in its
// prototype chain.
// ─────────────────────────────────────────────────────────────────────────

// Declared first because vi.mock (hoisted by vitest) must capture these.
class _NextResponseMock {
  private _res: Response;

  constructor(body?: BodyInit | null, init?: ResponseInit) {
    const GlobalResponse = (globalThis as unknown as Record<string, typeof Response>).Response;
    this._res = new GlobalResponse(body, init);
  }

  static json(data: unknown, init?: { status?: number }): Response {
    const body = typeof data === 'string' ? data : JSON.stringify(data);
    const GlobalResponse = (globalThis as unknown as Record<string, typeof Response>).Response;
    return new GlobalResponse(body, {
      status: init?.status ?? 200,
      headers: { 'content-type': 'application/json' },
    });
  }

  static redirect(url: string | URL, init?: { status?: number }): Response {
    const GlobalResponse = (globalThis as unknown as Record<string, typeof Response>).Response;
    return new GlobalResponse(null, {
      status: init?.status ?? 307,
      headers: { location: typeof url === 'string' ? url : url.toString() },
    });
  }

  static next(init?: { status?: number }): Response {
    const GlobalResponse = (globalThis as unknown as Record<string, typeof Response>).Response;
    return new GlobalResponse(null, { status: init?.status ?? 200 });
  }
}

// Make `instanceof _NextResponseMock` resolve true for any Response created
// through our mock.  We do this by templating a thin wrapper class whose
// prototype chain goes through `_NextResponseMock` but whose instances ARE
// real `Response` objects (so all fetch/body methods continue to work).
const NextResponseMock = (() => {
  const GlobalResponse = (globalThis as unknown as Record<string, typeof Response>).Response;
  let wrapper: new (...args: ConstructorParameters<typeof Response>) => Response;

  // Each time `new NextResponseMock(...)` is called, redirect it through the
  // real Response constructor so Vitest / fetch sees a genuine Response.
  const Real = GlobalResponse;
  function C(this: Response, ...args: ConstructorParameters<typeof Response>) {
    return Reflect.construct(Real, args, new.target);
  }
  // Template link: instances of C are also instances of _NextResponseMock
  C.prototype = Object.create(_NextResponseMock.prototype);
  C.prototype.constructor = _NextResponseMock;

  // Static factory methods: return real Response instances but template the
  // prototype so they pass instanceof checks too.
  C.json = _NextResponseMock.json;
  C.redirect = _NextResponseMock.redirect;
  C.next = _NextResponseMock.next;

  return C as unknown as typeof _NextResponseMock;
})();

// Re-point the wrapper so instanceof works through the final prototype chain.
const _RealRes = (globalThis as unknown as Record<string, typeof Response>).Response;
Object.setPrototypeOf(NextResponseMock, _RealRes);
Object.setPrototypeOf(NextResponseMock.prototype, _RealRes.prototype);

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

// vitest hoists vi.mock to the top of the file during transformation, so
// NextResponseMock and MockNextRequest — referenced inside the factory — must
// already be declared above this call.
vi.mock('next/server', () => ({
  NextResponse: NextResponseMock,
  NextRequest: MockNextRequest,
}));
