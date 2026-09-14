/**
 * Convert Discovered Offer to Campaign Server Action
 *
 * Authenticated Server Action that converts a discovered affiliate offer
 * into an autonomous video mission (SEO script, description, HeyGen video, publish).
 *
 * Layer: land (business workflow)
 * @module affiliates/actions/convert-offer-action
 */

'use server'

import { z } from 'zod'
import { getCurrentUser } from '@/seed/auth/better-auth-session'
import { resolveOrgId } from '@/seed/auth/resolve-org-id'
import { createServerClient } from '@/seed/db/client'
import {
  convertOfferToCampaign,
  type CampaignBridgeErrorCode,
} from '../campaign-bridge'
import type { AutoVideoMissionResult } from '@/land/missions/auto-video-mission'
import { success, failure, type Result } from '@/seed/types/result'
import { logger } from '@/seed/utils/logger-utility'

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

export interface ConvertOfferActionError {
  code:
    | 'UNAUTHORIZED'
    | 'INVALID_INPUT'
    | 'BYOK_REQUIRED'
    | 'EXECUTION_FAILED'
    | CampaignBridgeErrorCode
  message: string
  missionId?: string
}

export async function convertOfferToCampaignAction(
  input: ConvertOfferToCampaignInput,
): Promise<Result<AutoVideoMissionResult, ConvertOfferActionError>> {
  const user = await getCurrentUser()
  if (!user?.id) {
    return failure({
      code: 'UNAUTHORIZED',
      message: 'Authentication required to convert offer to campaign',
    })
  }

  const parsed = convertOfferInputSchema.safeParse(input)
  if (!parsed.success) {
    return failure({
      code: 'INVALID_INPUT',
      message: parsed.error.issues.map((i) => i.message).join('; '),
    })
  }

  try {
    const db = createServerClient()
    await resolveOrgId(user.id, db).catch(() => null)

    const bridgeResult = await convertOfferToCampaign(parsed.data.offer, {
      userId: user.id,
      primaryLanguage: parsed.data.primaryLanguage,
      secondaryLanguage: parsed.data.secondaryLanguage,
      channelId: parsed.data.channelId,
      scheduledAt: parsed.data.scheduledAt,
      maxAffiliateLinks: parsed.data.maxAffiliateLinks,
      nicheHint: parsed.data.nicheHint,
      topicOverride: parsed.data.topicOverride,
    })

    if (!bridgeResult.ok) {
      return failure({
        code: bridgeResult.error.code,
        message: bridgeResult.error.message,
        missionId: bridgeResult.error.missionId,
      })
    }

    return success(bridgeResult.value)
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    logger.error('[convert-offer-action] failed unexpectedly', {
      error: message,
      userId: user.id,
      offerId: input.offer?.externalId,
    })
    return failure({
      code: 'EXECUTION_FAILED',
      message,
    })
  }
}
