/**
 * GET|POST /api/cron/llm-cache-purge — Phase 4E.3 ops hygiene.
 *
 * Daily 07:00 UTC. DELETE expired `llm_cache` rows; return count.
 * CRON_SECRET-guarded. D1 failure → 200 ok:false (never page founder —
 * cache is best-effort; next day's run retries).
 *
 * Implements the Phase 4E.3 purge job specified by migration 0008.
 */

import { NextRequest, NextResponse } from 'next/server'
import { getErrorMessage } from '@/seed/utils/to-error'
import { recordCronRun, wasRecentlyRun } from '@/lib/cron/run-tracker'
import { verifyCronAuth } from '@/seed/security/cron-auth'

export const dynamic = 'force-dynamic'

const CRON_NAME = 'llm-cache-purge'
/** Daily — skip if ran within last 12 hours */
const IDEMPOTENCY_WINDOW_MS = 12 * 60 * 60 * 1000

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

async function purgeExpired(db: D1Binding): Promise<number> {
  const result = await db
    .prepare(`DELETE FROM llm_cache WHERE expires_at < datetime('now')`)
    .bind()
    .run()
  return result.meta?.changes ?? 0
}

async function handler(request: NextRequest): Promise<NextResponse> {
  const authError = verifyCronAuth(request);
  if (authError) return authError;

  const db = (globalThis as unknown as GlobalEnv).DB
  if (!db) {
    return NextResponse.json({ ok: false, reason: 'D1_UNAVAILABLE' }, { status: 200 })
  }

  if (await wasRecentlyRun(db as unknown as D1Database, CRON_NAME, IDEMPOTENCY_WINDOW_MS)) {
    return NextResponse.json({ ok: true, skipped: 'recent_run' })
  }

  try {
    const deleted = await purgeExpired(db)
    await recordCronRun(db as unknown as D1Database, CRON_NAME, 'success')
    return NextResponse.json({
      ok:      true,
      deleted,
      ts:      new Date().toISOString(),
    })
  } catch (err) {
    const message = getErrorMessage(err)
    await recordCronRun(db as unknown as D1Database, CRON_NAME, 'failure', message)
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
