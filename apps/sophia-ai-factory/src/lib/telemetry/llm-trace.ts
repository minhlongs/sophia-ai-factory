/**
 * LLM Call Trace — Phase 4B Advanced Observability.
 *
 * Emits per-step LLM call metadata to D1 signals_events.
 * Future: wire to Langfuse /api/public/ingestion when LANGFUSE_PUBLIC_KEY env set.
 *
 * PDF Giai đoạn 4 "Advanced Observability: OpenTelemetry + Langfuse" bullet.
 * MVP = D1 emission only. No external dep. Safe fire-and-forget.
 */

import { track } from '@/lib/signals/track'
import { D1Events } from '@/lib/signals/d1-event-types'

export interface LlmCallTrace {
  workflowId:    string
  stepOrder:     number                    // 1 | 2 | 3
  stepType:      string                    // 'plan' | 'execute' | 'test'
  provider:      string                    // 'stub' | 'openrouter' | 'anthropic' | 'local-mekongd'
  model:         string
  durationMs:    number
  ok:            boolean
  errorClass?:   string
  inputTokens?:  number
  outputTokens?: number
  costUsd?:      number
}

/**
 * Derive a deterministic trace id from workflow_id + step_order.
 * Same (workflow, step) always produces the same trace id so retries dedup.
 */
export function buildTraceId(workflowId: string, stepOrder: number): string {
  return `${workflowId}-step-${stepOrder}`
}

/**
 * Record an LLM call trace. Fire-and-forget — never throws, never blocks caller.
 *
 * @param trace  — observability metadata
 * @param actor  — caller id (user.id for POST, workflow.id for cron). Phase F convention.
 * @param orgId  — optional org scope for D1 signal
 */
export function recordLlmCall(
  trace: LlmCallTrace,
  actor: string,
  orgId?: string,
): void {
  const props = {
    trace_id:      buildTraceId(trace.workflowId, trace.stepOrder),
    workflow_id:   trace.workflowId,
    step_order:    trace.stepOrder,
    step_type:     trace.stepType,
    provider:      trace.provider,
    model:         trace.model,
    duration_ms:   trace.durationMs,
    ok:            trace.ok,
    error_class:   trace.errorClass,
    input_tokens:  trace.inputTokens,
    output_tokens: trace.outputTokens,
    cost_usd:      trace.costUsd,
  }

  // Strip undefined keys so Zod strict mode doesn't reject.
  const cleaned = Object.fromEntries(
    Object.entries(props).filter(([, v]) => v !== undefined),
  )

  try {
    track(D1Events.LLM_CALL_TRACE, actor, cleaned, orgId)
  } catch {
    // Telemetry must never break caller. Swallow.
  }
}
