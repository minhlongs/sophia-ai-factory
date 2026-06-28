/**
 * PostHog event type definitions + zod schemas
 * RED-TEAM #11: financial events marked _serverOnly: true — client capture refused
 */

import { z } from 'zod'

// ---- Event name enum ----
export const Events = {
  // Client-safe events
  SIGNUP: 'signup',
  PAGEVIEW: 'pageview',
  CTA_CLICK: 'cta_click',
  WIZARD_STEP: 'wizard_step',
  WIZARD_COMPLETED: 'wizard_completed',
  BYOK_CONFIGURED: 'byok_configured',
  CAMPAIGN_CREATED: 'campaign_created',
  VIDEO_RENDERED: 'video_rendered',
  // Server-only financial events
  TIER_UPGRADED: 'tier_upgraded',
  PAYMENT_SUCCEEDED: 'payment_succeeded',
  CHURN_SIGNAL: 'churn_signal',
} as const

export type EventName = (typeof Events)[keyof typeof Events]

// Server-only event set
export const SERVER_ONLY_EVENTS = new Set<EventName>([
  Events.TIER_UPGRADED,
  Events.PAYMENT_SUCCEEDED,
  Events.CHURN_SIGNAL,
])

// ---- Per-event property schemas (whitelist — blocks PII injection) ----

const SignupSchema = z.object({
  plan: z.string().optional(),
  locale: z.string().optional(),
  referrer: z.string().optional(),
})

const PageviewSchema = z.object({
  path: z.string(),
  locale: z.string().optional(),
})

const CtaClickSchema = z.object({
  element: z.string(),
  page: z.string().optional(),
})

const WizardStepSchema = z.object({
  step: z.number().int().min(1),
  step_name: z.string(),
})

const WizardCompletedSchema = z.object({
  duration_ms: z.number().optional(),
})

const ByokConfiguredSchema = z.object({
  service: z.enum(['openrouter', 'elevenlabs', 'did', 'heygen']),
})

const CampaignCreatedSchema = z.object({
  campaign_type: z.string().optional(),
})

const VideoRenderedSchema = z.object({
  duration_s: z.number().optional(),
  resolution: z.string().optional(),
})

const TierUpgradedSchema = z.object({
  tier: z.string(),
  amount: z.number(),
  currency: z.string(),
})

const PaymentSucceededSchema = z.object({
  amount: z.number(),
  currency: z.string(),
})

const ChurnSignalSchema = z.object({
  reason: z.string().optional(),
  tier: z.string().optional(),
})

// ---- Schema registry ----
export const EVENT_SCHEMAS: Record<EventName, z.ZodTypeAny> = {
  [Events.SIGNUP]: SignupSchema,
  [Events.PAGEVIEW]: PageviewSchema,
  [Events.CTA_CLICK]: CtaClickSchema,
  [Events.WIZARD_STEP]: WizardStepSchema,
  [Events.WIZARD_COMPLETED]: WizardCompletedSchema,
  [Events.BYOK_CONFIGURED]: ByokConfiguredSchema,
  [Events.CAMPAIGN_CREATED]: CampaignCreatedSchema,
  [Events.VIDEO_RENDERED]: VideoRenderedSchema,
  [Events.TIER_UPGRADED]: TierUpgradedSchema,
  [Events.PAYMENT_SUCCEEDED]: PaymentSucceededSchema,
  [Events.CHURN_SIGNAL]: ChurnSignalSchema,
}

/** Check if event is restricted to server-side emission only */
export function isServerOnly(event: string): boolean {
  return SERVER_ONLY_EVENTS.has(event as EventName)
}

/** Validate event properties against whitelist schema — throws on invalid */
export function validateEventProps(event: EventName, properties: unknown): Record<string, unknown> {
  const schema = EVENT_SCHEMAS[event]
  if (!schema) return {}
  return schema.parse(properties) as Record<string, unknown>
}
