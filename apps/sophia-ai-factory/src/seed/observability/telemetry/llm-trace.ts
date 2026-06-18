/**
 * LLM Call Trace — Phase 4B/4D Advanced Observability.
 *
 * Emits per-step LLM call metadata to D1 signals_events (primary)
 * and to Langfuse /api/public/ingestion (secondary, env-gated).
 *
 * PDF Giai đoạn 4 "Advanced Observability: OpenTelemetry + Langfuse" bullet.
 * Both sinks are fire-and-forget — failures never block caller.
 */

 
import { z } from 'zod';
import { D1Events } from '@/seed/types/d1-events';
import { track } from './track'
import { sendToLangfuse } from './langfuse-client'

const LlmCallTracePropsSchema = z.object({
  trace_id: z.string(),
  workflow_id: z.string(),
  step_order: z.number().int().min(1).max(3),
  step_type: z.string(),
  provider: z.string(),
  model: z.string(),
  duration_ms: z.number().nonnegative(),
  ok: z.boolean(),
  error_class: z.string().optional(),
  input_tokens: z.number().int().nonnegative().optional(),
  output_tokens: z.number().int().nonnegative().optional(),
  cost_usd: z.number().nonnegative().optional(),
});

export interface LlmCallTrace {
  workflowId:    string
  stepOrder:     number                    // 1 | 2 | 3
  stepType:      string                    // 'plan' | 'execute' | 'test'
  provider:      string                    // 'stub' | 'openrouter' | 'anthropic'
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
    const safe = LlmCallTracePropsSchema.parse(cleaned);
    track(D1Events.LLM_CALL_TRACE, actor, safe, orgId);
  } catch {
    // Telemetry must never break caller. Swallow.
  }

  // Phase 4D: secondary emission to Langfuse (env-gated, fire-and-forget).
  // Promise intentionally not awaited — caller is synchronous.
  void sendToLangfuse(trace, actor, orgId).catch(() => {
    // Defensive: sendToLangfuse already swallows; double-guard never throws.
  })
}
