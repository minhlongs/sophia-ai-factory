/**
 * PostHog event type definitions + zod schemas
 * RED-TEAM #11: financial events marked _serverOnly: true — client capture refused
 */

import type { z } from 'zod'
import {
  ByokConfiguredSchema,
  CampaignCreatedSchema,
  CampaignPublishedSchema,
  ChurnSignalSchema,
  CtaClickSchema,
  ExperimentAssignedSchema,
  FirstVideoCompletedSchema,
  FirstVideoStartedSchema,
  FreeQuotaExhaustionSchema,
  PageviewSchema,
  PaymentSucceededSchema,
  ReferralSignupSchema,
  SignupSchema,
  SopInstalledSchema,
  TierUpgradedSchema,
  VideoRenderedSchema,
  WizardCompletedSchema,
  WizardStepSchema,
} from './event-property-schemas'

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
  // SOP / referral events
  SOP_INSTALLED: 'sop_installed',
  REFERRAL_SIGNUP: 'referral_signup',
  // Server-only financial / usage events
  TIER_UPGRADED: 'tier_upgraded',
  PAYMENT_SUCCEEDED: 'payment_succeeded',
  CHURN_SIGNAL: 'churn_signal',
  FREE_QUOTA_EXHAUSTION: 'free_quota_exhaustion',
} as const

export type EventName = (typeof Events)[keyof typeof Events]

// Server-only event set
export const SERVER_ONLY_EVENTS = new Set<EventName>([
  Events.TIER_UPGRADED,
  Events.PAYMENT_SUCCEEDED,
  Events.CHURN_SIGNAL,
  Events.FREE_QUOTA_EXHAUSTION,
])

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
