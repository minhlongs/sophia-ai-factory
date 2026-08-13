/**
 * Langfuse client — Phase 4D external LLM observability.
 *
 * Ships per-step LLM call metadata to Langfuse /api/public/ingestion.
 * Env-gated: skips silently when LANGFUSE_PUBLIC_KEY + LANGFUSE_SECRET_KEY missing.
 * Fire-and-forget: never throws, never blocks caller.
 *
 * PDF Giai đoạn 4 "Advanced Observability: OpenTelemetry + Langfuse" bullet.
 * Complements existing D1 LLM_CALL_TRACE emission in llm-trace.ts.
 */

import type { LlmCallTrace } from './llm-trace'
import { buildTraceId } from './llm-trace'
import { scrubPIIDeep } from './pii-scrubber'
import { shouldAllowRequest, recordSuccess, recordFailure } from '@/seed/security/circuit-breaker'
import { classifyError } from '@/seed/types/failure-kind'

export const DEFAULT_HOST = 'https://cloud.langfuse.com'
const DEFAULT_TIMEOUT_MS = 2000

export interface LangfuseConfig {
  publicKey:  string
  secretKey:  string
  host?:      string
}

/**
 * Read Langfuse config from env. Returns null when not configured
 * (both keys must be present — otherwise caller skips cleanly).
 */
export function readLangfuseConfig(): LangfuseConfig | null {
  const publicKey = process.env.LANGFUSE_PUBLIC_KEY ?? ''
  const secretKey = process.env.LANGFUSE_SECRET_KEY ?? ''
  if (!publicKey || !secretKey) return null
  return {
    publicKey,
    secretKey,
    host: process.env.LANGFUSE_HOST,
  }
}

/**
 * Send one generation-create event to Langfuse.
 * Fire-and-forget: swallows all errors (telemetry must never break caller).
 */
export async function sendToLangfuse(
  trace:   LlmCallTrace,
  actor:   string,
  orgId?:  string,
  config?: LangfuseConfig | null,
): Promise<void> {
  const cfg = config ?? readLangfuseConfig()
  if (!cfg) return

  const traceId = buildTraceId(trace.workflowId, trace.stepOrder)
  const host = cfg.host?.trim() || DEFAULT_HOST
  const auth = `Basic ${btoa(`${cfg.publicKey}:${cfg.secretKey}`)}`

  const event = {
    id:        `${traceId}-evt`,
    type:      'generation-create',
    timestamp: new Date().toISOString(),
    body: {
      id:              traceId,
      traceId:         trace.workflowId,
      name:            `${trace.stepType}-step-${trace.stepOrder}`,
      model:           trace.model,
      modelParameters: { provider: trace.provider },
      usage: {
        input:      trace.inputTokens,
        output:     trace.outputTokens,
        unit:       'TOKENS',
        totalCost:  trace.costUsd,
      },
      metadata: {
        actor,
        orgId,
        stepOrder:   trace.stepOrder,
        stepType:    trace.stepType,
        durationMs:  trace.durationMs,
        ok:          trace.ok,
        errorClass:  trace.errorClass,
        inputTokens:  trace.inputTokens,
        outputTokens: trace.outputTokens,
      },
    },
  }

  // Defence-in-depth: errorClass/metadata strings may carry leaked API keys
  // (e.g. "Invalid key sk-ant-…"). Scrub before shipping to external sink.
  const scrubbed = scrubPIIDeep(event)

  try {
    if (!shouldAllowRequest('langfuse')) {
      // Circuit open — fail-soft, don't block caller
      return
    }
    await fetch(`${host}/api/public/ingestion`, {
      method:  'POST',
      headers: {
        'Authorization': auth,
        'Content-Type':  'application/json',
      },
      body:   JSON.stringify({ batch: [scrubbed] }),
      signal: AbortSignal.timeout(DEFAULT_TIMEOUT_MS),
    })
    recordSuccess('langfuse')
  } catch (error) {
    recordFailure('langfuse', classifyError(error))
    // Swallow — telemetry must never block caller.
    // Covers: network failure, AbortSignal.timeout, btoa non-ASCII throw.
  }
}
