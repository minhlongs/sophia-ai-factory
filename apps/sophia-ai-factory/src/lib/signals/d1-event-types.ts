/**
 * D1 Signal Layer — Event types and per-event Zod schemas
 *
 * Separate from PostHog event-types.ts to avoid coupling.
 * Whitelist-based schemas prevent PII / API key leakage into props_json.
 */

import { z } from 'zod'

// ── Event enum ────────────────────────────────────────────────────────────────
export const D1Events = {
  TIER_CONVERSION:        'tier_conversion',
  PAYMENT_SUCCESS:        'payment_success',
  PAYMENT_FAILED:         'payment_failed',
  AGENT_DISPATCH:         'agent_dispatch',
  API_RATE_LIMIT_HIT:     'api_rate_limit_hit',
  BYOK_CALL:              'byok_call',
  BYOK_TIMEOUT:           'byok_timeout',          // reserved — Phase 5
  LOCAL_MODE_PROVISIONED: 'local_mode_provisioned', // Phase D
  LOCAL_MODE_HEALTHY:    'local_mode_healthy',      // Phase F — cron ping success
  LOCAL_MODE_UNHEALTHY:  'local_mode_unhealthy',    // Phase F — cron ping failure
  LOCAL_MODE_DISABLED:   'local_mode_disabled',     // Phase F — auto-disabled after 3 fails
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
  limit_type:   z.enum(['api', 'auth', 'webhook']),
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

// ── Schema registry ───────────────────────────────────────────────────────────
const SCHEMAS: Record<D1EventType, z.ZodTypeAny> = {
  [D1Events.TIER_CONVERSION]:        TierConversionSchema,
  [D1Events.PAYMENT_SUCCESS]:        PaymentSuccessSchema,
  [D1Events.PAYMENT_FAILED]:         PaymentFailedSchema,
  [D1Events.AGENT_DISPATCH]:         AgentDispatchSchema,
  [D1Events.API_RATE_LIMIT_HIT]:     ApiRateLimitHitSchema,
  [D1Events.BYOK_CALL]:              ByokCallSchema,
  [D1Events.BYOK_TIMEOUT]:           ByokTimeoutSchema,
  [D1Events.LOCAL_MODE_PROVISIONED]: LocalModeProvisionedSchema,
  [D1Events.LOCAL_MODE_HEALTHY]:     LocalModeHealthySchema,
  [D1Events.LOCAL_MODE_UNHEALTHY]:   LocalModeUnhealthySchema,
  [D1Events.LOCAL_MODE_DISABLED]:    LocalModeDisabledSchema,
}

/**
 * Return the Zod schema for a given D1 event type.
 * Used by track() to validate + strip props before insert.
 */
export function schemaForEvent(event: D1EventType): z.ZodTypeAny {
  return SCHEMAS[event]
}
