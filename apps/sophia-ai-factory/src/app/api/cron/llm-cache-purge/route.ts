/**
 * GET|POST /api/cron/llm-cache-purge — Phase 4E.3 ops hygiene.
 *
 * Daily 07:00 UTC. DELETE expired `llm_cache` rows; return count.
 * CRON_SECRET-guarded. D1 failure → 200 ok:false (never page founder —
 * cache is best-effort; next day's run retries).
 *
 * Closes migration 0008 TODO: "purge job deferred to Phase 4E.3".
 */

import { NextRequest, NextResponse } from 'next/server'
import { getErrorMessage } from '@/lib/utils/to-error'

export const dynamic = 'force-dynamic'

interface D1DeleteMeta {
  changes?: number
}

interface D1Binding {
  prepare: (sql: string) => {
    bind: (...args: unknown[]) => {
      run: () => Promise<{ meta?: D1DeleteMeta }>
    }
  }
}

interface GlobalEnv {
  DB?: D1Binding
}

function verifyCronSecret(request: NextRequest): boolean {
  if (process.env.NODE_ENV === 'development') return true
  const secret = process.env.CRON_SECRET
  if (!secret) return false
  return request.headers.get('authorization') === `Bearer ${secret}`
}

async function purgeExpired(db: D1Binding): Promise<number> {
  const result = await db
    .prepare(`DELETE FROM llm_cache WHERE expires_at < datetime('now')`)
    .bind()
    .run()
  return result.meta?.changes ?? 0
}

async function handler(request: NextRequest): Promise<NextResponse> {
  if (!verifyCronSecret(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const db = (globalThis as unknown as GlobalEnv).DB
  if (!db) {
    return NextResponse.json({ ok: false, reason: 'D1_UNAVAILABLE' }, { status: 200 })
  }

  try {
    const deleted = await purgeExpired(db)
    return NextResponse.json({
      ok:      true,
      deleted,
      ts:      new Date().toISOString(),
    })
  } catch (err) {
    const message = getErrorMessage(err)
    return NextResponse.json(
      { ok: false, reason: 'D1_ERROR', error: message },
      { status: 200 },
    )
  }
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  return handler(request)
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  return handler(request)
}
