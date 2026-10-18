/**
 * KV and D1 Binding Accessors for Cloudflare Workers Storage
 * Layer: seed/kv
 */

export function getKvBinding(): KVNamespace | null {
  const g = globalThis as Record<string, unknown>
  if (g.KV_KV && typeof (g.KV_KV as KVNamespace).get === 'function') {
    return g.KV_KV as KVNamespace
  }
  if (g.EXPERIMENT_KV && typeof (g.EXPERIMENT_KV as KVNamespace).get === 'function') {
    return g.EXPERIMENT_KV as KVNamespace
  }
  return null
}

/** D1 check — only reads the binding (no "await" — CREATE_SERVER_CLIENT IS SYNC). */
export function getD1Database(): D1Database | null {
  const g = globalThis as Record<string, unknown>
  const db = g.DB
  if (db && typeof (db as D1Database).prepare === 'function') {
    return db as D1Database
  }
  return null
}
