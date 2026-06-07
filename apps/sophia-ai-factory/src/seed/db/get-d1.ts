/**
 * getD1 — shared D1 binding accessor for dashboard server components.
 *
 * Mirrors the inline helper previously duplicated in 17+ dashboard files.
 * Returns the D1Database binding when available, null otherwise.
 */

import type { D1Database } from '@cloudflare/workers-types';
export type { D1Database };

export function getD1(): D1Database | null {
  try {
    // Primary: globalThis.__env (set by opennextjs-cloudflare worker)
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

    return null;
  } catch {
    return null;
  }
}
