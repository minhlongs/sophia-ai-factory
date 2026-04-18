/**
 * GET /api/admin/llm-trace-stats — Phase 4I LLM call trace aggregates.
 *
 * Reads llm_call_trace events from D1 signals_events (24h window),
 * computes in-memory aggregates via pure `aggregateTraceStats()` from
 * `@/lib/admin/trace-aggregator` (Phase 4M), returns JSON.
 * CRON_SECRET-guarded. D1 failure → 200 ok:false.
 */

import { NextRequest, NextResponse } from 'next/server'
import {
  aggregateTraceStats,
  type TraceRow,
} from '@/lib/admin/trace-aggregator'

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
  return request.headers.get('authorization') === `Bearer ${secret}`
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
    const result = await db
      .prepare(
        `SELECT props FROM signals_events WHERE event_type='llm_call_trace' AND created_at >= datetime('now','-24 hours')`,
      )
      .bind()
      .all()

    const rows: TraceRow[] = (result.results ?? []) as TraceRow[]
    const stats = aggregateTraceStats(rows)

    return NextResponse.json(
      { ok: true, ts: new Date().toISOString(), windowHours: 24, stats },
      { status: 200 },
    )
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ ok: false, reason: 'D1_ERROR', error: message }, { status: 200 })
  }
}
