/**
 * LLM Call Trace aggregator — Phase 4M
 *
 * Pure function + shared types for computing 24h LLM trace aggregates.
 * Consumed by:
 *   - `/api/admin/llm-trace-stats` route (Phase 4I JSON endpoint)
 *   - `getTraceStats()` SSR helper in monitoring-queries (Phase 4K dashboard embed)
 *
 * Extracted from the 4I route in Phase 4M to remove lib↔app-route coupling.
 */

// ── Row shape (D1 signals_events.props is stored as JSON text) ───────────────

export interface TraceRow { props: string }

// ── Internal: parsed props shape ─────────────────────────────────────────────

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

// ── Aggregate output shape ───────────────────────────────────────────────────

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

// ── Pure aggregator ──────────────────────────────────────────────────────────

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
