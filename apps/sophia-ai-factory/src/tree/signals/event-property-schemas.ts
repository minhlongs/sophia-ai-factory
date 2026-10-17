/**
 * PostHog per-event property Zod schemas (whitelist — blocks PII injection)
 *
 * Layer: tree/signals
 */

import { z } from 'zod'

export const SignupSchema = z.object({
	plan: z.string().optional(),
	locale: z.string().optional(),
	referrer: z.string().optional(),
	niche: z.string().optional(),
})

export const PageviewSchema = z.object({
	path: z.string(),
	locale: z.string().optional(),
})

export const CtaClickSchema = z.object({
	element: z.string(),
	page: z.string().optional(),
})

export const WizardStepSchema = z.object({
	step: z.number().int().min(1),
	step_name: z.string(),
})

export const WizardCompletedSchema = z.object({
	duration_ms: z.number().optional(),
})

export const ByokConfiguredSchema = z.object({
	service: z.enum(['openrouter', 'elevenlabs', 'did', 'heygen']),
})

export const CampaignCreatedSchema = z.object({
	campaign_type: z.string().optional(),
})

export const CampaignPublishedSchema = z.object({
	campaign_type: z.string().optional(),
	channels: z.string().optional(),
})

export const FirstVideoStartedSchema = z.object({
	campaign_id: z.string().optional(),
	tier: z.string().optional(),
})

export const FirstVideoCompletedSchema = z.object({
	campaign_id: z.string().optional(),
	duration_s: z.number().optional(),
	tier: z.string().optional(),
})

export const ExperimentAssignedSchema = z.object({
	experiment: z.string(),
	variant: z.string(),
})

export const FreeQuotaExhaustionSchema = z.object({
	tier: z.string(),
	used: z.number(),
	limit: z.number(),
})

export const VideoRenderedSchema = z.object({
	duration_s: z.number().optional(),
	resolution: z.string().optional(),
})

export const TierUpgradedSchema = z.object({
	tier: z.string(),
	amount: z.number(),
	currency: z.string(),
})

export const PaymentSucceededSchema = z.object({
	amount: z.number(),
	currency: z.string(),
})

export const ChurnSignalSchema = z.object({
	reason: z.string().optional(),
	tier: z.string().optional(),
})

export const SopInstalledSchema = z.object({
	sop_id: z.string(),
	sop_name: z.string().optional(),
	sop_author: z.string().optional(),
})

export const ReferralSignupSchema = z.object({
	referrer: z.string(),
	referred_user_id: z.string().optional(),
	source: z.string().optional(),
})
