/**
 * D1 Signal Layer — Event types and per-event Zod schemas
 *
 * Separate from PostHog event-types.ts to avoid coupling.
 * Whitelist-based schemas prevent PII / API key leakage into props_json.
 */

import { z } from 'zod'

// ── Event enum ────────────────────────────────────────────────────────────────
export const D1Events = {
  TIER_CONVERSION:          'tier_conversion',
  PAYMENT_SUCCESS:          'payment_success',
  PAYMENT_FAILED:           'payment_failed',
  AGENT_DISPATCH:           'agent_dispatch',
  API_RATE_LIMIT_HIT:       'api_rate_limit_hit',
  BYOK_CALL:                'byok_call',
  BYOK_TIMEOUT:             'byok_timeout',           // reserved — Phase 5
  LOCAL_MODE_PROVISIONED:   'local_mode_provisioned', // Phase D
  LOCAL_MODE_HEALTHY:       'local_mode_healthy',     // Phase F — cron ping success
  LOCAL_MODE_UNHEALTHY:     'local_mode_unhealthy',   // Phase F — cron ping failure
  LOCAL_MODE_DISABLED:      'local_mode_disabled',    // Phase F — auto-disabled after 3 fails
  WORKFLOW_STARTED:         'workflow_started',        // Supervisor: workflow created + queued
  WORKFLOW_STEP_COMPLETED:  'workflow_step_completed', // Supervisor: one step mission done
  WORKFLOW_COMPLETED:       'workflow_completed',      // Supervisor: all 3 steps done
  WORKFLOW_FAILED:          'workflow_failed',         // Supervisor: step mission failed
  PROMPT_INJECTION_DETECTED: 'prompt_injection_detected', // Phase 4A: guard flagged prompt at ingress
  LLM_CALL_TRACE:            'llm_call_trace',            // Phase 4B: per-step LLM call observability
  BYOK_KEY_SET:              'byok_key_set',              // Phase 8C: user-facing BYOK admin — store/rotate
  BYOK_KEY_CLEARED:          'byok_key_cleared',          // Phase 8C: user-facing BYOK admin — delete
  DISCOVERY_SCORE_REQUESTED: 'discovery_score_requested', // R10: audit trail for OpenRouter-backed scoring
} as const

export type D1EventType = typeof D1Events[keyof typeof D1Events]

// ── Per-event Zod schemas (whitelist — blocks PII / key material) ─────────────

/** tier_conversion — fired after IPN tier activation */
const TierConversionSchema = z.object({
  from_tier:    z.string(),
  to_tier:      z.string(),
  amount_usd:   z.number().nonnegative(),
  provider:     z.string(),              // 'nowpayments' | 'payos'
})

/** payment_success — fired when payment IPN status = finished */
const PaymentSuccessSchema = z.object({
  amount_usd:   z.number().nonnegative(),
  currency:     z.string(),
  provider:     z.string(),
  payment_id:   z.string(),
})

/** payment_failed — fired when IPN indicates failed/expired payment */
const PaymentFailedSchema = z.object({
  amount_usd:   z.number().nonnegative().optional(),
  currency:     z.string().optional(),
  provider:     z.string(),
  payment_id:   z.string(),
  reason:       z.string().optional(),
})

/** agent_dispatch — fired on each OpenClaw channel distribute() call */
const AgentDispatchSchema = z.object({
  campaign_id:  z.string(),
  channel_count: z.number().int().nonnegative(),
  command:      z.string().optional(),
})

/** api_rate_limit_hit — fired in middleware 429 branch */
const ApiRateLimitHitSchema = z.object({
  path:         z.string(),
  identifier:   z.string(),   // hashed IP / API key prefix — no raw values
  limit_type:   z.enum(['api', 'auth', 'webhook', 'discovery']),
})

/** byok_call — fired per outbound BYOK provider call */
const ByokCallSchema = z.object({
  provider:     z.string(),   // 'elevenlabs' | 'openrouter' | 'did' | etc.
  status_code:  z.number().int(),
  latency_ms:   z.number().nonnegative(),
  error_class:  z.string().optional(),  // Error.name if call failed
})

/** byok_timeout — reserved for Phase 5 */
const ByokTimeoutSchema = z.object({
  provider:     z.string(),
  timeout_ms:   z.number().nonnegative(),
})

/** local_mode_provisioned — fired when customer's mekongd tunnel is registered (Phase D) */
const LocalModeProvisionedSchema = z.object({
  user_id:       z.string(),
  hostname_hash: z.number().int(), // FNV-1a hash of hostname — no raw URL stored
})

/** local_mode_healthy — cron ping succeeded for user's tunnel */
const LocalModeHealthySchema = z.object({
  user_id:    z.string(),
  latency_ms: z.number().nonnegative(),
})

/** local_mode_unhealthy — cron ping failed or timed out */
const LocalModeUnhealthySchema = z.object({
  user_id:       z.string(),
  endpoint_hash: z.number().int(), // FNV-1a hash — no raw URL stored
  status:        z.union([z.number().int(), z.string()]).optional(),
})

/** local_mode_disabled — tunnel auto-disabled after 3 consecutive failures */
const LocalModeDisabledSchema = z.object({
  user_id: z.string(),
  reason:  z.string(),
})

/** workflow_started — fired when POST /api/raas/workflows creates workflow + 3 step missions */
const WorkflowStartedSchema = z.object({
  workflow_id: z.string(),
  org_id:      z.string(),
  step_count:  z.number().int().nonnegative().optional(),
})

/** workflow_step_completed — fired by cron stepper when a step mission completes */
const WorkflowStepCompletedSchema = z.object({
  workflow_id:  z.string(),
  step_order:   z.number().int().min(1).max(3),
  step_type:    z.string(),
  duration_ms:  z.number().nonnegative().optional(),
})

/** workflow_completed — fired when all 3 step missions complete */
const WorkflowCompletedSchema = z.object({
  workflow_id: z.string(),
  org_id:      z.string(),
  duration_ms: z.number().nonnegative().optional(),
})

/** workflow_failed — fired when a step mission fails, blocking the workflow */
const WorkflowFailedSchema = z.object({
  workflow_id:  z.string(),
  step_order:   z.number().int().min(1).max(3).optional(),
  step_type:    z.string().optional(),
  error_class:  z.string().optional(),
})

/** prompt_injection_detected — fired when guard flags prompt at LLM ingress */
const PromptInjectionDetectedSchema = z.object({
  severity:      z.enum(['low', 'medium', 'high']),
  reasons:       z.array(z.string()),      // pattern IDs only — NO raw prompt
  prompt_length: z.number().int().nonnegative(),
  blocked:       z.boolean(),              // true = request rejected (severity=high)
  endpoint:      z.string(),               // e.g. 'POST /api/raas/workflows'
})

/** byok_key_set / byok_key_cleared — Phase 8C audit of user-facing BYOK admin.
 *  Props whitelist: provider only (plaintext keys NEVER enter signals_events). */
const ByokKeyAdminSchema = z.object({
  provider: z.enum(['openrouter', 'anthropic', 'elevenlabs', 'd-id']),
})

/** discovery_score_requested — R10: OpenRouter-backed affiliate scoring audit trail. */
const DiscoveryScoreRequestedSchema = z.object({
  program_id: z.string(),
  niche_len:  z.number().int().nonnegative(),
  score_null: z.boolean(),
})

/** llm_call_trace — per-step LLM call observability (Phase 4B Advanced Observability) */
const LlmCallTraceSchema = z.object({
  trace_id:       z.string(),              // derived from workflow_id + step_order
  workflow_id:    z.string(),
  step_order:     z.number().int().min(1).max(3),
  step_type:      z.string(),              // plan | execute | test
  provider:       z.string(),              // stub | openrouter | anthropic | local-mekongd
  model:          z.string(),              // mvp-stub | gpt-4o-mini | claude-sonnet-4
  duration_ms:    z.number().nonnegative(),
  ok:             z.boolean(),
  error_class:    z.string().optional(),
  input_tokens:   z.number().int().nonnegative().optional(),
  output_tokens:  z.number().int().nonnegative().optional(),
  cost_usd:       z.number().nonnegative().optional(),
})

// ── Schema registry ───────────────────────────────────────────────────────────
const SCHEMAS: Record<D1EventType, z.ZodTypeAny> = {
  [D1Events.TIER_CONVERSION]:         TierConversionSchema,
  [D1Events.PAYMENT_SUCCESS]:         PaymentSuccessSchema,
  [D1Events.PAYMENT_FAILED]:          PaymentFailedSchema,
  [D1Events.AGENT_DISPATCH]:          AgentDispatchSchema,
  [D1Events.API_RATE_LIMIT_HIT]:      ApiRateLimitHitSchema,
  [D1Events.BYOK_CALL]:               ByokCallSchema,
  [D1Events.BYOK_TIMEOUT]:            ByokTimeoutSchema,
  [D1Events.LOCAL_MODE_PROVISIONED]:  LocalModeProvisionedSchema,
  [D1Events.LOCAL_MODE_HEALTHY]:      LocalModeHealthySchema,
  [D1Events.LOCAL_MODE_UNHEALTHY]:    LocalModeUnhealthySchema,
  [D1Events.LOCAL_MODE_DISABLED]:     LocalModeDisabledSchema,
  [D1Events.WORKFLOW_STARTED]:        WorkflowStartedSchema,
  [D1Events.WORKFLOW_STEP_COMPLETED]: WorkflowStepCompletedSchema,
  [D1Events.WORKFLOW_COMPLETED]:      WorkflowCompletedSchema,
  [D1Events.WORKFLOW_FAILED]:         WorkflowFailedSchema,
  [D1Events.PROMPT_INJECTION_DETECTED]: PromptInjectionDetectedSchema,
  [D1Events.LLM_CALL_TRACE]:            LlmCallTraceSchema,
  [D1Events.BYOK_KEY_SET]:              ByokKeyAdminSchema,
  [D1Events.BYOK_KEY_CLEARED]:          ByokKeyAdminSchema,
  [D1Events.DISCOVERY_SCORE_REQUESTED]: DiscoveryScoreRequestedSchema,
}

/**
 * Return the Zod schema for a given D1 event type.
 * Used by track() to validate + strip props before insert.
 * Returns a schema that parses into Record<string, unknown> so callers can
 * inspect fields without TS complaining about accessing unknown.
 */
export function schemaForEvent(event: D1EventType): z.ZodSchema<Record<string, unknown>> {
  return SCHEMAS[event] as z.ZodSchema<Record<string, unknown>>
}
