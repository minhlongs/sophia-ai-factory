/**
 * GET /api/admin/llm-trace-stats — Phase 4I LLM call trace aggregates.
 *
 * Reads llm_call_trace events from D1 signals_events (24h window),
 * computes in-memory aggregates, returns JSON.
 * CRON_SECRET-guarded. D1 failure → 200 ok:false.
 */

import { NextRequest, NextResponse } from 'next/server'

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

// ── Trace props shape as stored in D1 props JSON column ──────────────────────

interface TraceProps {
  trace_id:      string
  workflow_id:   string
  step_order:    number
  step_type:     string
  provider:      string
  model:         string
  duration_ms:   number
  ok:            boolean
  error_class?:  string
  input_tokens?: number
  output_tokens?: number
  cost_usd?:     number
}

// ── Public interfaces (exported for tests) ───────────────────────────────────

export interface TraceRow { props: string }

export interface ProviderCount { provider: string; count: number }
export interface ModelCount    { model: string;    count: number }

export interface AggregateStats {
  total:         number
  success:       number
  failure:       number
  successRate:   number
  avgDurationMs: number
  byProvider:    ProviderCount[]
  byModel:       ModelCount[]
}

// ── Pure aggregator (exported so tests call it directly) ─────────────────────

export function aggregateTraceStats(rows: TraceRow[]): AggregateStats {
  let success    = 0
  let sumDuration = 0
  const providerCounts: Record<string, number> = {}
  const modelCounts:    Record<string, number> = {}

  for (const row of rows) {
    let props: TraceProps
    try {
      props = JSON.parse(row.props as string) as TraceProps
    } catch {
      continue  // skip malformed JSON rows
    }

    if (props.ok === true) success++
    sumDuration += props.duration_ms ?? 0

    const prov = props.provider ?? 'unknown'
    providerCounts[prov] = (providerCounts[prov] ?? 0) + 1

    const mdl = props.model ?? 'unknown'
    modelCounts[mdl] = (modelCounts[mdl] ?? 0) + 1
  }

  const total = rows.length
  const failure = total - success

  const byProvider: ProviderCount[] = Object.entries(providerCounts)
    .map(([provider, count]) => ({ provider, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5)

  const byModel: ModelCount[] = Object.entries(modelCounts)
    .map(([model, count]) => ({ model, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5)

  return {
    total,
    success,
    failure,
    successRate:   total === 0 ? 0 : success / total,
    avgDurationMs: total === 0 ? 0 : sumDuration / total,
    byProvider,
    byModel,
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
