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
  CAMPAIGN_PUBLISHED: 'campaign_published',
  VIDEO_RENDERED: 'video_rendered',
  FIRST_VIDEO_STARTED: 'first_video_started',
  FIRST_VIDEO_COMPLETED: 'first_video_completed',
  // Experiment assignment events
  EXPERIMENT_ASSIGNED: 'experiment_assigned',
  // Server-only financial / usage events
  TIER_UPGRADED: 'tier_upgraded',
  PAYMENT_SUCCEEDED: 'payment_succeeded',
  CHURN_SIGNAL: 'churn_signal',
  FREE_QUOTA_EXHAUSTION: 'free_quota_exhaustion',
  // Marketplace events
  SOP_INSTALLED: 'sop_installed',
  SOP_UNINSTALLED: 'sop_uninstalled',
  SOP_LISTING_VIEWED: 'sop_listing_viewed',
  REFERRAL_SIGNUP: 'referral_signup',
} as const

export type EventName = (typeof Events)[keyof typeof Events]

// Server-only event set
export const SERVER_ONLY_EVENTS = new Set<EventName>([
  Events.TIER_UPGRADED,
  Events.PAYMENT_SUCCEEDED,
  Events.CHURN_SIGNAL,
  Events.FREE_QUOTA_EXHAUSTION,
  Events.SOP_INSTALLED,
  Events.SOP_UNINSTALLED,
  Events.SOP_LISTING_VIEWED,
  Events.REFERRAL_SIGNUP,
])

// ---- Per-event property schemas (whitelist — blocks PII injection) ----

const SignupSchema = z.object({
  plan: z.string().optional(),
  locale: z.string().optional(),
  referrer: z.string().optional(),
  niche: z.string().optional(),
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

const CampaignPublishedSchema = z.object({
  campaign_type: z.string().optional(),
  channels: z.string().optional(),
})

const FirstVideoStartedSchema = z.object({
  campaign_id: z.string().optional(),
  tier: z.string().optional(),
})

const FirstVideoCompletedSchema = z.object({
  campaign_id: z.string().optional(),
  duration_s: z.number().optional(),
  tier: z.string().optional(),
})

const ExperimentAssignedSchema = z.object({
  experiment: z.string(),
  variant: z.string(),
})

const FreeQuotaExhaustionSchema = z.object({
  tier: z.string(),
  used: z.number(),
  limit: z.number(),
})

const SopInstalledSchema = z.object({
  listing_id: z.string(),
  template_id: z.string(),
  price_cents: z.number(),
})

const SopUninstalledSchema = z.object({
  listing_id: z.string(),
  template_id: z.string(),
})

const SopListingViewedSchema = z.object({
  listing_id: z.string(),
  template_id: z.string(),
  source: z.string().optional(),
})

const ReferralSignupSchema = z.object({
  affiliate_id: z.string(),
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
  [Events.CAMPAIGN_PUBLISHED]: CampaignPublishedSchema,
  [Events.VIDEO_RENDERED]: VideoRenderedSchema,
  [Events.FIRST_VIDEO_STARTED]: FirstVideoStartedSchema,
  [Events.FIRST_VIDEO_COMPLETED]: FirstVideoCompletedSchema,
  [Events.EXPERIMENT_ASSIGNED]: ExperimentAssignedSchema,
  [Events.TIER_UPGRADED]: TierUpgradedSchema,
  [Events.PAYMENT_SUCCEEDED]: PaymentSucceededSchema,
  [Events.CHURN_SIGNAL]: ChurnSignalSchema,
  [Events.FREE_QUOTA_EXHAUSTION]: FreeQuotaExhaustionSchema,
  [Events.SOP_INSTALLED]: SopInstalledSchema,
  [Events.SOP_UNINSTALLED]: SopUninstalledSchema,
  [Events.SOP_LISTING_VIEWED]: SopListingViewedSchema,
  [Events.REFERRAL_SIGNUP]: ReferralSignupSchema,
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
