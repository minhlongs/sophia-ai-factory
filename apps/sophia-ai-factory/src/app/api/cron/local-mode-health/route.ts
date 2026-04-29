/**
 * Local Mode Health Cron — Phase F
 *
 * Pings each provisioned mekongd tunnel every 15 min.
 * Emits local_mode_healthy / local_mode_unhealthy signals.
 * Auto-disables after 3 consecutive failures in 45-min window.
 *
 * Schedule: every-15-min — wrangler.toml triggers.crons
 */

import { NextRequest, NextResponse } from 'next/server'
import { decryptSecret } from '@/lib/crypto/encrypt-secret'
import { track } from '@/lib/signals/track'
import { D1Events } from '@/lib/signals/d1-event-types'
import { logger } from '@/lib/utils/logger-utility'
import { recordCronRun, wasRecentlyRun } from '@/lib/cron/run-tracker'

export const dynamic = 'force-dynamic'

const CRON_NAME = 'local-mode-health'
/** Every 15 min — skip if ran within last 5 minutes */
const IDEMPOTENCY_WINDOW_MS = 5 * 60 * 1000

/** FNV-1a 32-bit — fingerprints endpoint without storing raw URL */
export function fnv1a(str: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < str.length; i++) h = (((h ^ str.charCodeAt(i)) * 0x01000193) >>> 0)
  return h
}

interface UserRow { id: string; local_mode_endpoint: string; local_mode_bearer_encrypted: string }
interface CountRow { cnt: number }
export interface HealthSummary { checked: number; healthy: number; unhealthy: number; disabled: number }

const ZERO: HealthSummary = { checked: 0, healthy: 0, unhealthy: 0, disabled: 0 }

function getDb(): D1Database {
  const env = (globalThis as Record<string, unknown>).__env as Record<string, unknown> | undefined
  const db = env?.DB as D1Database | undefined
  if (!db) throw new Error('D1 binding not available')
  return db
}

function getDek(): string | undefined {
  const env = (globalThis as Record<string, unknown>).__env as Record<string, string | undefined> | undefined
  return env?.LOCAL_MODE_DEK ?? process.env.LOCAL_MODE_DEK
}

function isAuthorised(req: NextRequest): boolean {
  const s = process.env.CRON_SECRET
  return !s || req.headers.get('authorization') === `Bearer ${s}`
}

/** Ping one user's tunnel; mutates healthy/unhealthy counters and unhealthyIds. */
async function pingUser(
  row: UserRow, dek: string | undefined,
  counters: { healthy: number; unhealthy: number },
  unhealthyIds: string[],
): Promise<void> {
  let bearer: string
  try {
    bearer = await decryptSecret(row.local_mode_bearer_encrypted, dek)
  } catch {
    logger.warn('[local-mode-health] decrypt failed', { userId: row.id })
    counters.unhealthy++; unhealthyIds.push(row.id)
    track(D1Events.LOCAL_MODE_UNHEALTHY, row.id, { user_id: row.id, endpoint_hash: fnv1a(row.local_mode_endpoint), status: 'decrypt_failed', source: 'cron' })
    return
  }
  const start = Date.now()
  try {
    const res = await fetch(`${row.local_mode_endpoint}/v1/messages`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${bearer}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'ping', messages: [{ role: 'user', content: '.' }], max_tokens: 1 }),
      signal: AbortSignal.timeout(5000),
    })
    if (res.ok) {
      counters.healthy++
      track(D1Events.LOCAL_MODE_HEALTHY, row.id, { user_id: row.id, latency_ms: Date.now() - start, source: 'cron' })
    } else {
      counters.unhealthy++; unhealthyIds.push(row.id)
      track(D1Events.LOCAL_MODE_UNHEALTHY, row.id, { user_id: row.id, endpoint_hash: fnv1a(row.local_mode_endpoint), status: res.status, source: 'cron' })
    }
  } catch {
    counters.unhealthy++; unhealthyIds.push(row.id)
    track(D1Events.LOCAL_MODE_UNHEALTHY, row.id, { user_id: row.id, endpoint_hash: fnv1a(row.local_mode_endpoint), status: 'timeout_or_error', source: 'cron' })
  }
}

/** Core health-check logic — exported for unit tests. */
export async function runHealthCheck(db: D1Database, dek: string | undefined): Promise<HealthSummary> {
  let rows: UserRow[]
  try {
    const res = await db
      .prepare('SELECT id, local_mode_endpoint, local_mode_bearer_encrypted FROM users WHERE local_mode_endpoint IS NOT NULL LIMIT 50')
      .all() as { results?: UserRow[] }
    rows = res.results ?? []
  } catch { return ZERO }

  if (rows.length === 0) return ZERO

  const counters = { healthy: 0, unhealthy: 0 }
  const unhealthyIds: string[] = []
  await Promise.allSettled(rows.map((r) => pingUser(r, dek, counters, unhealthyIds)))

  // Auto-disable after 3 consecutive unhealthy in 45-min window
  let disabled = 0
  if (unhealthyIds.length > 0) {
    const cutoff = Date.now() - 45 * 60 * 1000
    await Promise.allSettled(unhealthyIds.map(async (userId) => {
      try {
        const row = await db
          .prepare(`SELECT COUNT(*) as cnt FROM signals_events WHERE event_type='local_mode_unhealthy' AND actor=? AND ts > ?`)
          .bind(userId, cutoff).first() as CountRow | null
        if ((row?.cnt ?? 0) >= 3) {
          await db.prepare('UPDATE users SET local_mode_endpoint=NULL WHERE id=?').bind(userId).run()
          disabled++
          track(D1Events.LOCAL_MODE_DISABLED, userId, { user_id: userId, reason: '3_consecutive_unhealthy', source: 'cron' })
        }
      } catch (err) { logger.warn('[local-mode-health] auto-disable failed', { userId, err }) }
    }))
  }

  return { checked: rows.length, ...counters, disabled }
}

export async function GET(req: NextRequest): Promise<NextResponse> { return handler(req) }
export async function POST(req: NextRequest): Promise<NextResponse> { return handler(req) }

async function handler(req: NextRequest): Promise<NextResponse> {
  if (!isAuthorised(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  let db: D1Database
  try { db = getDb() } catch { return NextResponse.json({ error: 'D1 unavailable' }, { status: 500 }) }

  if (await wasRecentlyRun(db, CRON_NAME, IDEMPOTENCY_WINDOW_MS)) {
    return NextResponse.json({ ok: true, skipped: 'recent_run' })
  }

  try {
    const summary = await runHealthCheck(db, getDek())
    await recordCronRun(db, CRON_NAME, 'success')
    return NextResponse.json(summary)
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    await recordCronRun(db, CRON_NAME, 'failure', msg)
    throw err
  }
}
