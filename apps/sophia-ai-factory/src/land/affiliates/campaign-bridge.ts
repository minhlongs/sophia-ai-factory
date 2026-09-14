/**
 * Autonomous Discovery-to-Campaign Pipeline Bridge
 *
 * Converts a ranked affiliate offer discovered across ClickBank, Awin,
 * or ShareASale into an autonomous video mission (AutoVideoMissionInput).
 *
 * Chains autonomous SEO script generation, optional translation,
 * affiliate-enriched description injection, HeyGen video render, and scheduled publishing.
 *
 * Layer: land (business domain workflow)
 * @module land/affiliates/campaign-bridge
 */

import {
  runAutoVideoMission,
  AutoVideoMissionError,
  type AutoVideoMissionInput,
  type AutoVideoMissionResult,
} from '@/land/missions/auto-video-mission'
import type { RankedDiscoveredOffer } from './discovery-wave'
import { success, failure, type Result } from '@/seed/types/result'
import { logger } from '@/seed/utils/logger-utility'

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

export async function convertOfferToCampaign(
  offer: RankedDiscoveredOffer,
  options: ConvertOfferOptions,
): Promise<Result<AutoVideoMissionResult, CampaignBridgeError>> {
  if (!options.userId?.trim()) {
    return failure({
      code: 'UNAUTHORIZED',
      message: 'User ID is required to convert offer to campaign',
    })
  }

  if (!offer || !offer.title?.trim()) {
    return failure({
      code: 'INVALID_OFFER',
      message: 'A valid offer with a title is required to convert to campaign',
    })
  }

  try {
    const missionInput = mapOfferToMissionInput(offer, options)
    const result = await runAutoVideoMission(missionInput)
    return success(result)
  } catch (err) {
    if (err instanceof AutoVideoMissionError) {
      return failure({
        code: err.code,
        message: err.message,
        missionId: err.missionId,
      })
    }

    const message = err instanceof Error ? err.message : String(err)
    logger.error('[campaign-bridge] convertOfferToCampaign failed unexpectedly', {
      error: message,
      externalId: offer.externalId,
      network: offer.network,
    })

    return failure({
      code: 'CAMPAIGN_CREATION_FAILED',
      message,
    })
  }
}
