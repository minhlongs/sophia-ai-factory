/**
 * POST /api/affiliates/convert-to-campaign
 *
 * Converts a ranked affiliate offer into an autonomous video mission.
 * Validates offer input, enforces user authentication, and triggers
 * the auto-video mission pipeline.
 *
 * Rate limited to 20 req/min.
 *
 * Request body: { offer: RankedDiscoveredOffer, ...options } or RankedDiscoveredOffer
 * Response: Result<AutoVideoMissionResult, ConvertOfferActionError>
 *
 * @module api/affiliates/convert-to-campaign
 */

import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/seed/auth/better-auth-session'
import { withRateLimit } from '@/forest/middleware/rate-limit-wrapper'
import {
  convertOfferToCampaign,
  convertOfferInputSchema,
  type CampaignBridgeErrorCode,
} from '@/land/affiliates/campaign-bridge'
import { failure } from '@/seed/types/result'
import { logger } from '@/seed/utils/logger-utility'

function resolveStatusCode(code: CampaignBridgeErrorCode): number {
  switch (code) {
    case 'INVALID_OFFER':
    case 'EMPTY_TOPIC':
      return 400
    case 'UNAUTHORIZED':
      return 401
    case 'BYOK_REQUIRED':
      return 422
    default:
      return 500
  }
}

async function parseRequestBody(req: NextRequest): Promise<unknown> {
  try {
    const raw: unknown = await req.json()
    if (typeof raw === 'object' && raw !== null && 'offer' in raw) {
      return raw
    }
    return { offer: raw }
  } catch {
    return null
  }
}

export const POST = withRateLimit(
  async function POST(req: NextRequest): Promise<NextResponse> {
    try {
      const user = await getCurrentUser()
      if (!user?.id) {
        return NextResponse.json(
          failure({
            code: 'UNAUTHORIZED',
            message: 'Authentication required to convert an affiliate offer to a campaign',
          }),
          { status: 401 },
        )
      }

      const body = await parseRequestBody(req)
      if (body === null) {
        return NextResponse.json(
          failure({
            code: 'INVALID_INPUT',
            message: 'Request body must be valid JSON',
          }),
          { status: 400 },
        )
      }

      const parsed = convertOfferInputSchema.safeParse(body)
      if (!parsed.success) {
        return NextResponse.json(
          failure({
            code: 'INVALID_INPUT',
            message: parsed.error.issues.map((i) => i.message).join('; '),
          }),
          { status: 400 },
        )
      }

      const result = await convertOfferToCampaign(parsed.data.offer, {
        userId: user.id,
        primaryLanguage: parsed.data.primaryLanguage,
        secondaryLanguage: parsed.data.secondaryLanguage,
        channelId: parsed.data.channelId,
        scheduledAt: parsed.data.scheduledAt,
        maxAffiliateLinks: parsed.data.maxAffiliateLinks,
        nicheHint: parsed.data.nicheHint,
        topicOverride: parsed.data.topicOverride,
      })

      if (!result.ok) {
        return NextResponse.json(result, { status: resolveStatusCode(result.error.code) })
      }

      return NextResponse.json(result, { status: 200 })
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Unknown error during campaign conversion'
      logger.error('[api/affiliates/convert-to-campaign] unexpected error', {
        error: message,
      })
      return NextResponse.json(
        failure({
          code: 'CAMPAIGN_CREATION_FAILED',
          message,
        }),
        { status: 500 },
      )
    }
  },
  { config: { intervalMs: 60_000, maxRequests: 20 } },
)
