/**
 * D1 Signal Schemas — Business, Payments, Admin & Security
 *
 * Layer: tree/signals/events
 */

import { z } from 'zod';

/** tier_conversion — fired after IPN tier activation */
export const TierConversionSchema = z.object({
  from_tier:    z.string(),
  to_tier:      z.string(),
  amount_usd:   z.number().nonnegative(),
  provider:     z.string(),              // 'nowpayments' | 'payos'
});

/** payment_success — fired when payment IPN status = finished */
export const PaymentSuccessSchema = z.object({
  amount_usd:   z.number().nonnegative(),
  currency:     z.string(),
  provider:     z.string(),
  payment_id:   z.string(),
});

/** payment_failed — fired when IPN indicates failed/expired payment */
export const PaymentFailedSchema = z.object({
  amount_usd:   z.number().nonnegative().optional(),
  currency:     z.string().optional(),
  provider:     z.string(),
  payment_id:   z.string(),
  reason:       z.string().optional(),
});

/** checkout_started — fired in POST /api/checkout when invoice URL is minted */
export const CheckoutStartedSchema = z.object({
  tier:           z.string(),
  period:         z.string().optional(),
  payment_method: z.string(),
  order_id:       z.string(),
  has_promo:      z.boolean().optional(),
});

/** api_rate_limit_hit — fired in middleware 429 branch */
export const ApiRateLimitHitSchema = z.object({
  path:         z.string(),
  identifier:   z.string(),   // hashed IP / API key prefix — no raw values
  limit_type:   z.enum(['api', 'auth', 'webhook', 'discovery']),
});

/** prompt_injection_detected — fired when guard flags prompt at LLM ingress */
export const PromptInjectionDetectedSchema = z.object({
  severity:      z.enum(['low', 'medium', 'high']),
  reasons:       z.array(z.string()),      // pattern IDs only — NO raw prompt
  prompt_length: z.number().int().nonnegative(),
  blocked:       z.boolean(),              // true = request rejected (severity=high)
  endpoint:      z.string(),               // e.g. 'POST /api/raas/workflows'
});

/** byok_key_set / byok_key_cleared — Phase 8C audit of user-facing BYOK admin. */
export const ByokKeyAdminSchema = z.object({
  provider: z.enum(['openrouter', 'anthropic', 'elevenlabs', 'd-id']),
});

/** discovery_score_requested — R10: OpenRouter-backed affiliate scoring audit trail. */
export const DiscoveryScoreRequestedSchema = z.object({
  program_id: z.string(),
  niche_len:  z.number().int().nonnegative(),
  score_null: z.boolean(),
});
