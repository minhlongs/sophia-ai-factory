/**
 * GET /api/admin/llm-trace-stats — Phase 4I LLM call trace aggregates.
 *
 * Reads llm_call_trace events from D1 signals_events (24h window),
 * computes in-memory aggregates via pure `aggregateTraceStats()` from
 * `@/tree/admin/trace-aggregator` (Phase 4M), returns JSON.
 * CRON_SECRET-guarded. D1 failure → 200 ok:false.
 */

import { NextRequest, NextResponse } from 'next/server'
import {
  aggregateTraceStats,
  type TraceRow,
} from '@/tree/admin/trace-aggregator'
import { getErrorMessage } from '@/seed/utils/to-error'
import { timingSafeEqual } from '@/seed/security/crypto-utils'

export const dynamic = 'force-dynamic'

// ── D1 binding interface ──────────────────────────────────────────────────────

interface D1SelectMeta {
  results?: TraceRow[]
}

interface D1Binding {
  prepare: (sql: string) => {
    bind: (...args: unknown[]) => {
      all: () => Promise<D1SelectMeta>
    }
  }
}

// ── Auth helper ───────────────────────────────────────────────────────────────

function verifyCronSecret(request: NextRequest): boolean {
  if (process.env.NODE_ENV === 'development') return true
  const secret = process.env.CRON_SECRET
  if (!secret) return false
  const provided = request.headers.get('authorization') ?? ''
  const expected = `Bearer ${secret}`
  return timingSafeEqual(provided, expected)
}

// ── Handler ───────────────────────────────────────────────────────────────────

export async function GET(request: NextRequest): Promise<NextResponse> {
  if (!verifyCronSecret(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const db = (globalThis as unknown as { DB?: D1Binding }).DB
  if (!db) {
    return NextResponse.json({ ok: false, reason: 'D1_UNAVAILABLE' }, { status: 200 })
  }

  try {
    const cutoffMs = Date.now() - 24 * 3600 * 1000
    const result = await db
      .prepare(
        `SELECT props_json AS props FROM signals_events WHERE event_type = 'llm_call_trace' AND ts >= ?`,
      )
      .bind(cutoffMs)
      .all()

    const rows: TraceRow[] = (result.results ?? []) as TraceRow[]
    const stats = aggregateTraceStats(rows)

    return NextResponse.json(
      { ok: true, ts: new Date().toISOString(), windowHours: 24, stats },
      { status: 200 },
    )
  } catch (err) {
    const message = getErrorMessage(err)
    return NextResponse.json({ ok: false, reason: 'D1_ERROR', error: message }, { status: 200 })
  }
}
