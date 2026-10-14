import { z } from 'zod'
import type { AutoVideoMissionInput } from '@/land/missions/auto-video-mission'
import type { RankedDiscoveredOffer } from './discovery-wave'

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
  | 'CAMPAIGN_CREATION_FAILED'

export interface CampaignBridgeError {
  code: CampaignBridgeErrorCode
  message: string
  missionId?: string
}

export interface ConvertOfferOptions {
  userId: string
  primaryLanguage?: 'en' | 'vi'
  secondaryLanguage?: 'en' | 'vi'
  channelId?: string
  scheduledAt?: number
  maxAffiliateLinks?: number
  nicheHint?: string
  topicOverride?: string
}

export function buildTopicFromOffer(offer: RankedDiscoveredOffer): string {
  return offer.title.trim()
}

export function extractKeywordsFromOffer(offer: RankedDiscoveredOffer): string[] {
  const keywords = new Set<string>()
  if (offer.niche?.trim()) {
    keywords.add(offer.niche.trim().toLowerCase())
  }
  if (offer.network?.trim()) {
    keywords.add(offer.network.trim().toLowerCase())
  }

  const combinedText = `${offer.title} ${offer.description || ''}`
  const words = combinedText
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
  const topic = options.topicOverride?.trim() || buildTopicFromOffer(offer)
  const keywords = extractKeywordsFromOffer(offer)
  const primaryLanguage =
    options.primaryLanguage ?? (offer.language === 'vi' ? 'vi' : 'en')
  const nicheHint = options.nicheHint?.trim() || offer.niche || 'general'

  return {
    userId: options.userId,
    topic,
    keywords,
    primaryLanguage,
    secondaryLanguage: options.secondaryLanguage,
    channelId: options.channelId,
    scheduledAt: options.scheduledAt,
    nicheHint,
    maxAffiliateLinks: options.maxAffiliateLinks ?? 3,
  }
}
