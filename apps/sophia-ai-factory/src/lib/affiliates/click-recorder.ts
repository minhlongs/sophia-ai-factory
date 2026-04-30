/**
 * Click Recorder
 *
 * Dual-write pattern: KV (hot path, 5min TTL) + D1 (analytics store).
 * GDPR compliant: stores ip_hash (SHA-256) and truncated UA only, never raw IP/email.
 *
 * @module affiliates/click-recorder
 */

import type { KVNamespace } from '@cloudflare/workers-types'
import { logger } from '@/lib/utils/logger-utility'

export interface ClickData {
  clickId: string
  tenantId: string
  linkId: string
  offerId: string
  ip: string | null
  userAgent: string | null
  referrer: string | null
  country: string | null
}

interface ClickEventRow {
  id: string
  tenant_id: string
  link_id: string
  offer_id: string
  ip_hash: string | null
  ua: string | null
  referrer: string | null
  country: string | null
  clicked_at: number
}

/** SHA-256 hash of raw IP for GDPR compliance */
async function hashIp(ip: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(ip))
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('')
}

/** Truncate UA string to first 120 chars (no fingerprinting) */
function truncateUa(ua: string | null): string | null {
  if (!ua) return null
  return ua.slice(0, 120)
}

function getD1(): D1Database | null {
  const env = (globalThis as unknown as { __env?: Record<string, unknown> }).__env
  if (env?.DB) return env.DB as D1Database
  const g = (globalThis as Record<string, unknown>).__D1_DB as D1Database | undefined
  return g ?? null
}

function getKv(): KVNamespace | null {
  const env = (globalThis as unknown as { __env?: Record<string, unknown> }).__env
  if (env?.AFFILIATE_KV) return env.AFFILIATE_KV as KVNamespace
  const g = (globalThis as Record<string, unknown>).__AFFILIATE_KV as KVNamespace | undefined
  return g ?? null
}

/**
 * Record a click event.
 * Both KV and D1 writes are awaited for durability; errors are logged but not thrown.
 *
 * @returns The generated click ID
 */
export async function recordClick(data: ClickData): Promise<string> {
  const now = Math.floor(Date.now() / 1000)
  const ipHash = data.ip ? await hashIp(data.ip) : null
  const ua = truncateUa(data.userAgent)

  const row: ClickEventRow = {
    id: data.clickId,
    tenant_id: data.tenantId,
    link_id: data.linkId,
    offer_id: data.offerId,
    ip_hash: ipHash,
    ua,
    referrer: data.referrer,
    country: data.country,
    clicked_at: now,
  }

  // KV write — hot path cache (5 min TTL, keyed by clickId for attribution lookup)
  const kvWrite = (async () => {
    const kv = getKv()
    if (!kv) return
    try {
      await kv.put(
        `click:${data.clickId}`,
        JSON.stringify({ linkId: data.linkId, tenantId: data.tenantId, offerId: data.offerId }),
        { expirationTtl: 300 }
      )
    } catch (err) {
      logger.warn('[click-recorder] KV write failed', {
        error: err instanceof Error ? err.message : String(err),
      })
    }
  })()

  // D1 write — analytics store
  const d1Write = (async () => {
    const db = getD1()
    if (!db) return
    try {
      await db.prepare(
        `INSERT OR IGNORE INTO click_events
          (id, tenant_id, link_id, offer_id, ip_hash, ua, referrer, country, clicked_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).bind(
        row.id, row.tenant_id, row.link_id, row.offer_id,
        row.ip_hash, row.ua, row.referrer, row.country, row.clicked_at
      ).run()
    } catch (err) {
      logger.warn('[click-recorder] D1 write failed', {
        error: err instanceof Error ? err.message : String(err),
      })
    }
  })()

  await Promise.all([kvWrite, d1Write])
  return data.clickId
}
