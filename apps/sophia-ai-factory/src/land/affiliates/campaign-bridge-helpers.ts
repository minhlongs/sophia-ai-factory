import { z } from 'zod'
import type { AutoVideoMissionInput } from '@/land/missions/auto-video/types'
import type { RankedDiscoveredOffer } from './discovery-wave'
import { computeTtsCost, computeVisualCost } from '@/land/video/pipeline-pricing'

export const MONTHLY_MODEL_A_BUDGET_USD = 200

export function estimatePipelineCost(
  voiceProvider: string = 'fish_speech',
  videoProvider: string = 'wan',
  durationSec: number = 30,
): number {
  return computeTtsCost(voiceProvider) + computeVisualCost(videoProvider, durationSec)
}

export function isWithinModelABudget(
  videosPerMonth: number,
  voiceProvider: string = 'fish_speech',
  videoProvider: string = 'wan',
): boolean {
  return videosPerMonth * estimatePipelineCost(voiceProvider, videoProvider) <= MONTHLY_MODEL_A_BUDGET_USD
}

export const rankedDiscoveredOfferSchema = z.object({
  externalId: z.string().min(1),
  network: z.string().min(1),
  title: z.string().min(1),
  description: z.string().default(''),
  productUrl: z.string().default(''),
  imageUrl: z.string().default(''),
  commissionPct: z.number().nullable().optional().default(null),
  commissionFixedUsd: z.number().nullable().optional().default(null),
  niche: z.string().default('saas'),
  language: z.string().default('en'),
  region: z.string().default('US'),
  isTrending: z.boolean().default(false),
  qualityScore: z.number().default(0),
  passesScamGate: z.boolean().default(true),
  scoreBreakdown: z.record(z.string(), z.number()).default({}),
})

export const convertOfferInputSchema = z.object({
  offer: rankedDiscoveredOfferSchema,
  campaignId: z.string().optional(),
  jurisdiction: z.string().optional(),
  requireCeoApproval: z.boolean().optional(),
  primaryLanguage: z.enum(['en', 'vi']).optional(),
  secondaryLanguage: z.enum(['en', 'vi']).optional(),
  channelId: z.string().optional(),
  scheduledAt: z.number().int().positive().optional(),
  maxAffiliateLinks: z.number().int().min(1).max(10).optional(),
  nicheHint: z.string().max(100).optional(),
  topicOverride: z.string().max(200).optional(),
})

export type ConvertOfferToCampaignInput = z.input<typeof convertOfferInputSchema>

export type CampaignBridgeErrorCode =
  | 'INVALID_OFFER'
  | 'UNAUTHORIZED'
  | 'EMPTY_TOPIC'
  | 'BYOK_REQUIRED'
  | 'SCRIPT_FAILED'
  | 'TRANSLATE_FAILED'
  | 'DESCRIPTION_FAILED'
  | 'VIDEO_RENDER_FAILED'
  | 'SCHEDULE_FAILED'
  | 'PERSIST_FAILED'
  | 'KILL_SWITCH_ACTIVE'
  | 'KILL_SWITCH_UNKNOWN'
  | 'CAMPAIGN_CREATION_FAILED'
  | 'APPROVAL_NOT_GRANTED'
  | 'APPROVAL_INVALIDATED_BY_MUTATION'
  | 'APPROVAL_ABORTED_BY_KILL_SWITCH'
  | 'APPROVAL_REJECTED'
  | 'APPROVAL_REVOKED'
  | 'APPROVAL_EXPIRED'
  | 'APPROVAL_ALREADY_EXECUTED'

export interface CampaignBridgeError {
  code: CampaignBridgeErrorCode
  message: string
  missionId?: string
}

export interface ConvertOfferOptions {
  userId: string
  tenantId?: string
  campaignId?: string
  jurisdiction?: string
  requireCeoApproval?: boolean
  primaryLanguage?: 'en' | 'vi'
  secondaryLanguage?: 'en' | 'vi'
  channelId?: string
  scheduledAt?: number
  maxAffiliateLinks?: number
  nicheHint?: string
  topicOverride?: string
  voiceProvider?: 'fish_speech' | 'elevenlabs'
  videoProvider?: 'wan' | 'heygen' | 'd-id'
}

export function buildTopicFromOffer(offer: RankedDiscoveredOffer): string {
  return offer.title.trim()
}

export function extractKeywordsFromOffer(offer: RankedDiscoveredOffer): string[] {
  const keywords = new Set<string>()
  if (offer.niche?.trim()) keywords.add(offer.niche.trim().toLowerCase())
  if (offer.network?.trim()) keywords.add(offer.network.trim().toLowerCase())
  const words = `${offer.title} ${offer.description || ''}`
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length >= 4)
  for (const word of words) {
    if (keywords.size >= 8) break
    keywords.add(word)
  }
  return Array.from(keywords)
}

export function mapOfferToMissionInput(
  offer: RankedDiscoveredOffer,
  options: ConvertOfferOptions,
): AutoVideoMissionInput {
  const voiceProvider = options.voiceProvider ?? 'fish_speech'
  const videoProvider = options.videoProvider ?? 'wan'
  return {
    userId: options.userId,
    tenantId: options.tenantId ?? options.userId,
    campaignId: options.campaignId,
    jurisdiction: options.jurisdiction ?? offer.region ?? 'US',
    requireCeoApproval: options.requireCeoApproval,
    topic: options.topicOverride?.trim() || buildTopicFromOffer(offer),
    keywords: extractKeywordsFromOffer(offer),
    primaryLanguage: options.primaryLanguage ?? (offer.language === 'vi' ? 'vi' : 'en'),
    secondaryLanguage: options.secondaryLanguage,
    channelId: options.channelId,
    scheduledAt: options.scheduledAt,
    nicheHint: options.nicheHint?.trim() || offer.niche || 'general',
    maxAffiliateLinks: options.maxAffiliateLinks ?? 3,
    voiceProvider,
    videoProvider,
    estimatedCostUsd: estimatePipelineCost(voiceProvider, videoProvider),
  }
}
