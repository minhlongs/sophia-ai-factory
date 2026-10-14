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
  type AutoVideoMissionResult,
} from '@/land/missions/auto-video-mission'
import type { RankedDiscoveredOffer } from './discovery-wave'
import { success, failure, type Result } from '@/seed/types/result'
import { logger } from '@/seed/utils/logger-utility'
import {
  mapOfferToMissionInput,
  type CampaignBridgeError,
  type ConvertOfferOptions,
} from './campaign-bridge-helpers'

export {
  rankedDiscoveredOfferSchema,
  convertOfferInputSchema,
  buildTopicFromOffer,
  extractKeywordsFromOffer,
  mapOfferToMissionInput,
  type ConvertOfferToCampaignInput,
  type CampaignBridgeErrorCode,
  type CampaignBridgeError,
  type ConvertOfferOptions,
} from './campaign-bridge-helpers'

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
