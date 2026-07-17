/**
 * Generic Cloudflare Workers storage helper.
 *
 * Prefers KV, falls back to D1 via createServerClient().
 * Replaces any fs, localStorage, or file-system access in Workers runtime.
 *
 * This is intentionally a SEED utility — used by
 * - src/seed/inference/zunef-client.ts (device ID + token storage)
 */

import { logger } from '@/seed/utils/logger-utility'
import { toError } from '@/seed/utils/to-error'

// ---------------------------------------------------------------------------
// Accessors
// ---------------------------------------------------------------------------

function getKvBinding(): KVNamespace | null {
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
function getD1Database(): D1Database | null {
  const g = globalThis as Record<string, unknown>
  const db = g.DB
  if (db && typeof (db as D1Database).prepare === 'function') {
    return db as D1Database
  }
  return null
}

// ---------------------------------------------------------------------------
// Public helpers — KV-first, D1-fallback
// ---------------------------------------------------------------------------

export async function storageGet(key: string): Promise<string | null> {
  const kv = getKvBinding()
  if (kv) {
    try {
      const val = await kv.get(key)
      if (typeof val === 'string') return val
      if (val && typeof (val as { value?: string }).value === 'string') {
        return (val as { value: string }).value
      }
      return null
    } catch (err) {
      logger.warn('[kv-storage] KV get failed, falling back to D1', {
        key,
        error: toError(err).message,
      })
    }
  }

  const db = getD1Database()
  if (!db) {
    logger.error('[kv-storage] No KV or D1 binding available for read')
    return null
  }
  try {
    const result = await db
      .prepare('SELECT value FROM kv_storage WHERE key = ?1')
      .bind(key)
      .first<{ value: string }>()
    return result?.value ?? null
  } catch (err) {
    logger.error('[kv-storage] D1 read failed', {
      key,
      error: toError(err).message,
    })
    return null
  }
}

export async function storageSet(key: string, value: string): Promise<void> {
  const kv = getKvBinding()
  if (kv) {
    try {
      await kv.put(key, value)
      return
    } catch (err) {
      logger.warn('[kv-storage] KV set failed, falling back to D1', {
        key,
        error: toError(err).message,
      })
    }
  }

  const db = getD1Database()
  if (!db) {
    throw new Error('[kv-storage] No KV or D1 binding available for write')
  }
  try {
    await db
      .prepare(
        `INSERT INTO kv_storage (key, value, changed_at)
         VALUES (?1, ?2, unixepoch())
         ON CONFLICT(key) DO UPDATE SET value = excluded.value, changed_at = excluded.changed_at`,
      )
      .bind(key, value)
      .run()
  } catch (err) {
    logger.error('[kv-storage] D1 write failed', {
      key,
      error: toError(err).message,
    })
    throw err
  }
}

export async function storageDelete(key: string): Promise<void> {
  const kv = getKvBinding()
  if (kv) {
    try {
      await kv.delete(key)
      return
    } catch (err) {
      logger.warn('[kv-storage] KV delete failed, falling back to D1', {
        key,
        error: toError(err).message,
      })
    }
  }

  const db = getD1Database()
  if (!db) {
    logger.warn(
      '[kv-storage] No KV or D1 binding for delete; key will persist until TTL expires',
      { key },
    )
    return
  }
  try {
    await db.prepare('DELETE FROM kv_storage WHERE key = ?1').bind(key).run()
  } catch (err) {
    logger.error('[kv-storage] D1 delete failed', {
      key,
      error: toError(err).message,
    })
  }
}

export function storageExists(key: string): boolean | Promise<boolean> {
  // Nur async version — SSD VERSION remains if needed separately
  return storageGet(key).then((v) => v !== null)
}
