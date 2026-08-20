/**
 * D1 Database Client — drop-in replacement for Supabase client
 *
 * Uses getCloudflareContext() from @opennextjs/cloudflare to access
 * the D1 binding at runtime. DB binding: sophia-raas-db
 */

import { D1Client } from '@/seed/db/d1-client-rpc';
import { toError } from '@/seed/utils/to-error';

// node-sqlite-d1.ts statically imports node:sqlite/node:fs/node:path, which
// Turbopack strips from the edge chunk (they are externalized but fail to load
// in the workerd runtime). Import lazily so the edge chunk never pulls in the
// shim; it is only needed by the Node chunk in local dev.
async function getLocalNodeSqliteD1(): Promise<D1Database | null> {
  // Guard: node:sqlite is a Node 22 built-in. The edge runtime (workerd) has
  // no node:sqlite and forbids new Function(), so only attempt the shim in a
  // real Node context. In production __env__.DB is always present and this
  // function is never reached; this guard is purely for local dev.
  if (!(globalThis as unknown as { process?: { versions?: { node?: string } } }).process?.versions?.node) {
    return null;
  }
  try {
    // Load via a fully-dynamic specifier so Turbopack cannot statically
    // analyze the import at bundle time. node-sqlite-d1.ts imports
    // node:sqlite/node:fs/node:path, which Turbopack rejects in the browser
    // chunk ("does not support external modules (node:sqlite)"). The shim is
    // dev/test-only and is never reached in production (getD1() resolves
    // __env__.DB first), so a runtime-only loader is safe.
    const mod = await (new Function('specifier', 'return import(specifier)')(
      '@/seed/db/node-sqlite-d1',
    )) as { getLocalNodeSqliteD1?: () => D1Database | null };
    return mod.getLocalNodeSqliteD1?.() ?? null;
  } catch {
    return null;
  }
}

/**
 * Resolve the local dev D1 binding (better-sqlite3 mock or node:sqlite shim).
 *
 * Both candidates are Node-only: the edge chunk (middleware) has no require()
 * and stubs node:module, so createRequire() always fails there, and the
 * node:sqlite shim is blocked by the edge runtime's DynamicCodeEvaluation
 * restriction. This helper therefore short-circuits on the Node marker and
 * returns null on the edge runtime — which is correct, because in dev the
 * edge chunk is the ONLY place a binding is needed (it runs on Node.js under
 * next dev, so the mock loader below is what actually satisfies it).
 *
 * The mock loader is resolved at module load via createRequire when running
 * under Node/tsx (see _isNodeRuntime below); on the edge runtime it stays null
 * and this helper returns null, so callers fail closed instead of throwing.
 */
async function loadLocalD1(): Promise<D1Database | null> {
  if (!(globalThis as unknown as { process?: { versions?: { node?: string } } }).process?.versions?.node) {
    return null;
  }
  // node:sqlite shim (preferred — only needs the node:sqlite built-in)
  const nodeSqlite = await getLocalNodeSqliteD1();
  if (nodeSqlite) return nodeSqlite;
  // better-sqlite3 mock (fallback)
  if (_mockLoader) {
    try {
      const mockDb = (_mockLoader() as () => unknown)();
      if (mockDb && typeof (mockDb as D1Database).prepare === 'function') {
        return mockDb as D1Database;
      }
    } catch {
      // ignore
    }
  }
  return null;
}
import type { D1Database } from '@cloudflare/workers-types';
export type { D1Database };
export { D1Client };

// Lazy load of local D1 mock to provide a fallback when the Cloudflare D1
// binding (__env__.DB) is unavailable — which happens in local dev, where the
// edge chunk (middleware/proxy) runs on Node.js but has no CF context.
//
// createRequire is synchronous and resolves .ts under tsx + Next.js dev
// (Turbopack), unlike ESM dynamic import() which Turbopack compiles to an async
// loader that resolves after getD1()'s first synchronous call.
//
// Deliberately NOT gated on process.env.NEXT_RUNTIME: Turbopack statically
// replaces NEXT_RUNTIME with the literal 'edge' in the edge chunk and
// dead-code-eliminates the branch, which silently dropped _mockLoader and made
// every D1-backed check fail-closed (429) in dev. Wrapping in try/catch instead
// means the loader is set whenever createRequire works (dev), and is a no-op
// when it doesn't (production CF Workers, where __env__.DB is always present so
// the mock is never reached anyway). local-d1-mock.ts only touches better-sqlite3
// inside its constructor, so requiring the module is safe on any runtime.
//
// createRequire is obtained via require('node:module').createRequire() rather
// than a static `import { createRequire } from 'module'`: Turbopack stubs the
// `module` package in the edge chunk (unsupported edge import 'module'), which
// made the static import resolve to a no-op and silently left _mockLoader null.
// require() itself IS available in the edge chunk (Turbopack externalizes
// node:buffer via __turbopack_context__.x("node:buffer", () =>
// require("node:buffer"))), so reaching through node:module works.
// Build the node:module specifier at runtime so Turbopack's static analysis
// cannot match the literal and replace it with the `module` stub. The edge
// chunk externalizes node:async_hooks and node:buffer (require() works for
// those), but stubs node:module; a computed string bypasses the stub.
// Resolve createRequire from node:module. Three facts that shape this:
//   1. `globalThis.require` is undefined under tsx AND in the edge chunk, so
//      any path keyed on it silently no-ops.
//   2. `import('node:module')` works under tsx but Turbopack statically analyzes
//      the specifier at bundle time and rejects node:module in the edge chunk.
//   3. `new Function(...)` is banned in the edge runtime (DynamicCodeEvaluation),
//      but this block only runs when _isNodeRuntime is true, which is false in
//      the edge chunk — so the Function is never invoked there.
// Wrapping the import in new Function() satisfies both: Turbopack cannot
// statically analyze a Function body, and the real import happens at runtime
// only where Node's module system exists.
function nodeModuleSpecifier(): string {
  const parts = ['node', ':', 'module'];
  return parts.reduce((a, b) => a + b, '');
}

async function resolveCreateRequireAsync(): Promise<((url: string | URL) => (id: string) => unknown) | undefined> {
  // 1. Turbopack edge chunk: __turbopack_context__.x wraps a factory whose
  //    require("node:module") call is evaluated at runtime, bypassing the
  //    static `module` stub.
  const turbopack = (globalThis as unknown as Record<string, unknown>).__turbopack_context__ as
    | { x?: (name: string, factory: () => unknown) => unknown }
    | undefined;
  if (turbopack?.x) {
    try {
      const spec = nodeModuleSpecifier();
      const factory = () => new Function('r', 's', 'return r(s)')(require, spec);
      const mod = turbopack.x(spec, factory) as
        | { createRequire?: (url: string | URL) => (id: string) => unknown }
        | undefined;
      if (mod?.createRequire) return mod.createRequire;
    } catch {
      // fall through
    }
  }
  // 2. Node / tsx: import node:module via new Function so Turbopack's static
  //    analyzer never sees the specifier. (A bare `import('node:module')`
  //    would be rejected at bundle time in the edge chunk.)
  try {
    const nodeModule = await (new Function('s', 'return import(s)') as (s: string) => Promise<{ createRequire?: (url: string | URL) => (id: string) => unknown }>)(nodeModuleSpecifier());
    if (nodeModule?.createRequire) return nodeModule.createRequire;
  } catch {
    // fall through
  }
  return undefined;
}

let getLocalD1Mock: (() => unknown) | null = null;
let _mockLoader: (() => unknown) | null = null;
// Guard on the Node runtime marker rather than NEXT_RUNTIME: Turbopack
// statically replaces NEXT_RUNTIME with the literal 'edge' in the edge chunk
// and dead-code-eliminates the branch, which silently dropped _mockLoader and
// made every D1-backed check fail-closed (429) in dev. process.versions.node is
// a runtime property access Turbopack cannot fold, so the branch survives in
// both chunks and only fires where Node's module system actually exists.
// NOTE: deliberately NOT gated on process.versions.node. In next dev the
// middleware runs in the edge chunk, where Turbopack strips process.versions
// (it reports only process.env.NEXT_RUNTIME='edge'). Gating the loader on a
// Node marker that is false in the very chunk that needs the mock kept the
// whole IIFE dead and every D1-backed check fail-closed (429) in dev.
// Instead attempt the load unconditionally and let the try/catch decide.
// Production is unaffected: getD1()/getD1Sync() resolve __env__.DB first and
// never reach this path.
void (async () => {
  const _createRequire = await resolveCreateRequireAsync();
  if (!_createRequire) return;
  try {
    const _mockMod = _createRequire(import.meta.url)('./local-d1-mock') as
      | { getLocalD1Mock?: () => unknown }
      | undefined;
    if (typeof _mockMod?.getLocalD1Mock === 'function') {
      getLocalD1Mock = _mockMod.getLocalD1Mock as () => unknown;
      _mockLoader = () => getLocalD1Mock;
    }
  } catch {
    // ignore if mock file missing or incompatible
  }
})();

// ─── Error types ──────────────────────────────────────────────────────────────

/**
 * Thrown when a D1 binding is unavailable at runtime.
 * Named export so routes like the Telegram webhook can catch it
 * specifically instead of matching a generic Error string.
 */
export class D1NotAvailableError extends Error {
  constructor() {
    super('D1 database binding not available')
    this.name = 'D1NotAvailableError'
  }
}

// ─── D1Database accessors ─────────────────────────────────────────────────────

/**
 * Get D1Database binding synchronously from CF request context.
 * Returns null if binding is unavailable (non-fatal).
 * Consolidated here as the single canonical accessor.
 */
export async function getD1(): Promise<D1Database | null> {
  try {
    // Primary: globalThis.__env__ (set by OpenNext Cloudflare worker)
    // NOTE: OpenNext uses double-underscore __env__, not single __env.
    const envDouble = (globalThis as unknown as Record<string, Record<string, unknown>>).__env__;
    if (envDouble?.DB) return envDouble.DB as D1Database;

    // Fallback: legacy single underscore (pre-OpenNext adapters)
    const env = (globalThis as unknown as Record<string, Record<string, unknown>>).__env;
    if (env?.DB) return env.DB as D1Database;

    // Fallback: Cloudflare context symbol
    const ctx = (globalThis as Record<symbol, { env?: Record<string, unknown> }>)[
      Symbol.for('__cloudflare-context__')
    ];
    if (ctx?.env?.DB) return ctx.env.DB as D1Database;

    // Fallback: global test binding
    const globalDb = (globalThis as Record<string, unknown>).__D1_DB as D1Database | undefined;
    if (globalDb) return globalDb;

    // Fallback: local dev D1 binding (node:sqlite shim, then better-sqlite3
    // mock). See loadLocalD1() — it guards on the Node runtime marker so the
    // edge chunk never attempts new Function() / node:sqlite, which the edge
    // runtime rejects (DynamicCodeEvaluationWarning) and which Turbopack
    // strips from the chunk anyway.
    const localDb = await loadLocalD1();
    if (localDb) {
      (globalThis as Record<string, unknown>).__D1_DB = localDb;
      return localDb;
    }

    return null;
  } catch {
    return null;
  }
}

/**
 * @deprecated Use getD1() — async wrapper for backward compatibility.
 */
export async function getD1Raw(): Promise<D1Database> {
  const db = await getD1();
  if (!db) throw new Error('D1 database binding not available');
  return db;
}

/**
 * @deprecated Use getD1() — async wrapper for backward compatibility.
 */
export async function getD1Safe(): Promise<D1Database | null> {
  return await getD1();
}

/**
 * @deprecated Use createServerClient() instead.
 */
export async function getD1Client(override?: D1Database): Promise<D1Client> {
  const db = override ?? (await getD1());
  if (!db) throw new Error('D1 database binding not available');
  return new D1Client(db);
}

/**
 * Get D1 database binding synchronously from CF request context.
 */
export function getD1Sync(): D1Database {
  // Try globalThis.__env__ first (OpenNext Cloudflare)
  const envDouble = (globalThis as unknown as Record<string, Record<string, unknown>>).__env__;
  if (envDouble?.DB && typeof (envDouble.DB as D1Database).prepare === 'function') {
    return envDouble.DB as D1Database;
  }

  // Fallback: globalThis.__env (legacy)
  const env = (globalThis as unknown as Record<string, Record<string, unknown>>).__env;
  if (env?.DB && typeof (env.DB as D1Database).prepare === 'function') {
    return env.DB as D1Database;
  }

  // Fallback: Cloudflare context symbol (set by OpenNext via AsyncLocalStorage)
  const ctx = (globalThis as Record<symbol, { env?: Record<string, unknown> }>)[
    Symbol.for('__cloudflare-context__')
  ];
  if (ctx?.env?.DB && typeof (ctx.env.DB as D1Database).prepare === 'function') {
    return ctx.env.DB as D1Database;
  }

  // Fallback: process.env style (some CF adapters)
  const procEnv = (process as unknown as Record<string, Record<string, unknown>>).env;
  if (procEnv?.DB && typeof (procEnv.DB as D1Database).prepare === 'function') {
    return procEnv.DB as D1Database;
  }

  // Fallback: global test binding (set by getD1() when it resolves a shim)
  const globalDb = (globalThis as Record<string, unknown>).__D1_DB as D1Database | undefined;
  if (globalDb) return globalDb;

  // NOTE: In `next dev` the edge chunk (middleware) is workerd, not Node.js.
  // The OpenNext Cloudflare dev context is populated by
  // initOpenNextCloudflareForDev() in next.config.ts, which writes the
  // resolved platform context to globalThis[Symbol.for('__cloudflare-context__')].
  // If that symbol is present, the CF-context fallback above already resolved
  // the D1 binding; if it is absent, the binding is genuinely unavailable and
  // callers must fail closed (429) rather than attempt Node-only shims here.
  // No Node-only fallbacks (better-sqlite3 / node:sqlite / new Function) are
  // attempted in this chunk — the edge runtime rejects them (DynamicCodeEvaluation)
  // and Turbopack strips node:fs/node:module from the chunk anyway.

  // Fallback: local-dev better-sqlite3 mock. The mock loader is resolved at
  // module load via createRequire (see below), so it is available synchronously
  // without awaiting any import(). This is what makes the rate limiter and other
  // sync callers work in local dev, where __env__.DB is never set and the
  // middleware runs on the edge runtime (which cannot call getD1()).
  if (_mockLoader) {
    const loader = _mockLoader() as () => unknown;
    const mockDb = loader();
    if (mockDb && typeof (mockDb as D1Database).prepare === 'function') {
      (globalThis as Record<string, unknown>).__D1_DB = mockDb;
      return mockDb as D1Database;
    }
  }

  throw new Error('D1 database binding not available — call getD1() first to resolve local shim');
}

/**
 * Safe variant of createServerClient() — never throws.
 * Returns null when no D1 binding is available (e.g. during build-time page data collection).
 * Callers must handle the null case explicitly.
 */
export async function tryCreateServerClient(override?: D1Database): Promise<D1Client | null> {
  const db = override ?? (await getD1());
  if (!db) return null;
  return new D1Client(db);
}

/**
 * Synchronous variant of tryCreateServerClient() — never throws.
 * Returns null when no D1 binding is available. Mirrors the async version but
 * reads the binding via getD1Sync() so it can be called from sync contexts
 * (lazy getters, sync handlers) without awaiting an import().
 */
export function tryCreateServerClientSync(override?: D1Database): D1Client | null {
  let db: D1Database | null;
  try {
    db = override ?? getD1Sync();
  } catch {
    // getD1Sync() throws when no binding is available (local dev edge runtime).
    // Return null instead so sync callers (rate limiter, lazy getters) can
    // fail closed without an exception propagating through the middleware.
    return null;
  }
  if (!db) return null;
  return new D1Client(db);
}

/**
 * Create a server-side D1 client.
 * Drop-in replacement for Supabase createServerClient().
 * @throws Error if no D1 binding is available
 */
export function createServerClient(override?: D1Database): D1Client {
  const db = override ?? getD1Sync();
  if (!db) throw new Error('D1 database binding not available');

  return new D1Client(db);
}

/**
 * Compatibility shim for createAuthClient(token).
 * @deprecated Use getCurrentUser() from '@/seed/auth/better-auth-session' instead.
 */
export function createAuthClient(_token?: string) {
  return {
    auth: {
      async getUser() {
        try {
          const { getCurrentUser } = await import('@/seed/auth/better-auth-session');
          const user = await getCurrentUser();
          if (!user) return { data: { user: null }, error: { message: 'Not authenticated' } };
          return { data: { user }, error: null };
        } catch (e) {
          return { data: { user: null }, error: { message: toError(e).message } };
        }
      },
    },
    from: (table: string) => createServerClient().from(table),
    rpc: (fn: string, params: Record<string, unknown>) => createServerClient().rpc(fn, params),
  };
}

// Re-export compatible types
export type User = {
  id: string;
  email: string;
  full_name?: string;
  avatar_url?: string;
  role?: string;
};

export type Session = {
  access_token: string;
  user: User;
  expires_at: number;
};

export type AuthError = {
  message: string;
  status?: number;
};

export type PostgrestError = {
  message: string;
  code?: string;
};
